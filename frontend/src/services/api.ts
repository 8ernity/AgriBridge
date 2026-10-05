import {
  Plot,
  WeatherData,
  SoilData,
  NDVIData,
  ScanResult,
  RecommendationData,
  AdvisoryMessage,
  CarbonCalculatorRequest,
  CarbonCalculatorResponse
} from '../types';
import {
  saveOfflineScanBlob,
  getAllOfflineScans,
  deleteOfflineScan,
  clearAllOfflineScans,
  getOfflineScansCount
} from './offlineStorage';

export const API_BASE = (import.meta as any).env.VITE_API_BASE_URL 
  ? `${(import.meta as any).env.VITE_API_BASE_URL}/api/v1` 
  : '/api/v1';

// Local storage keys for offline resilience (FR-4.8, FR-8.2)
const STORAGE_PLOTS_KEY = 'agribridge_local_plots';
const STORAGE_SCANS_KEY = 'agribridge_local_scans';
const STORAGE_ADVISORY_KEY = 'agribridge_local_advisories';

export const apiClient = {
  // Plots
  async getPlots(): Promise<Plot[]> {
    try {
      const res = await fetch(`${API_BASE}/plots`);
      if (!res.ok) throw new Error('Failed to fetch plots');
      const data = await res.json();
      localStorage.setItem(STORAGE_PLOTS_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      const cached = localStorage.getItem(STORAGE_PLOTS_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async createPlot(plotData: {
    name: string;
    crop: string;
    sowing_date?: string;
    lat: number;
    lon: number;
    area_ha?: number;
    geom_geojson?: string;
  }): Promise<Plot> {
    try {
      const res = await fetch(`${API_BASE}/plots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plotData)
      });
      if (!res.ok) throw new Error('Plot creation failed');
      const newPlot = await res.json();
      const current = await this.getPlots();
      localStorage.setItem(STORAGE_PLOTS_KEY, JSON.stringify([newPlot, ...current]));
      return newPlot;
    } catch (e) {
      // Offline fallback: save locally
      const localPlot: Plot = {
        id: `plot_local_${Date.now()}`,
        name: plotData.name,
        crop: plotData.crop,
        sowing_date: plotData.sowing_date,
        lat: plotData.lat,
        lon: plotData.lon,
        area_ha: plotData.area_ha || 0.5,
        geom_geojson: plotData.geom_geojson,
        created_at: new Date().toISOString()
      };
      const current = await this.getPlots();
      localStorage.setItem(STORAGE_PLOTS_KEY, JSON.stringify([localPlot, ...current]));
      return localPlot;
    }
  },

  // Environmental Data
  async getPlotWeather(plotId: string): Promise<WeatherData> {
    const res = await fetch(`${API_BASE}/plots/${plotId}/weather`);
    if (!res.ok) throw new Error('Weather query failed');
    return res.json();
  },

  async getPlotSoil(plotId: string): Promise<SoilData> {
    const res = await fetch(`${API_BASE}/plots/${plotId}/soil`);
    if (!res.ok) throw new Error('Soil query failed');
    return res.json();
  },

  async getPlotNDVI(plotId: string): Promise<NDVIData> {
    const res = await fetch(`${API_BASE}/plots/${plotId}/ndvi`);
    if (!res.ok) throw new Error('NDVI query failed');
    return res.json();
  },

  async getPlotRecommendations(plotId: string): Promise<RecommendationData> {
    const res = await fetch(`${API_BASE}/plots/${plotId}/recommendations`);
    if (!res.ok) throw new Error('Recommendations failed');
    return res.json();
  },

  // AI Crop Disease Diagnostics
  async diagnoseLeaf(
    imageBlob: Blob,
    cropHint?: string,
    plotId?: string,
    isOffline: boolean = false,
    language?: string
  ): Promise<ScanResult> {
    if (isOffline) {
      // Persist full image blob to IndexedDB for background sync (FR-8.3)
      const entryId = `queue_${Date.now()}`;
      await saveOfflineScanBlob({
        id: entryId,
        blob: imageBlob,
        cropHint,
        plotId,
        language,
        timestamp: new Date().toISOString()
      });

      // Return offline triage placeholder — actual diagnosis deferred until sync
      return {
        scan_id: entryId,
        plot_id: plotId,
        crop: cropHint ? cropHint.toUpperCase() : 'Crop Leaf',
        top_disease: 'Scan Queued (Offline Mode)',
        confidence: 0.0,
        status: 'uncertain',
        predictions: [],
        symptoms: ['Photo saved to offline queue.'],
        causes: ['Device currently disconnected from cellular network.'],
        management_summary: 'Image stored safely on your device. It will automatically upload and complete AI diagnosis when network returns.',
        cultural_practices: ['Isolate suspected foliage while waiting for full diagnosis.'],
        chemical_warning: 'Do not spray chemicals without confirmed diagnosis.',
        retake_guidance: 'Image queued for cloud diagnosis upon reconnection.',
        sources: [],
        model_version: 'offline-queue-v1',
        is_demo_data: true,
        guidance_is_demo_data: true,
        created_at: new Date().toISOString()
      };
    }

    const formData = new FormData();
    formData.append('file', imageBlob, 'leaf.jpg');
    if (cropHint) formData.append('crop_hint', cropHint);
    if (plotId) formData.append('plot_id', plotId);
    if (language) formData.append('language', language);

    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      body: formData
    });

    const responseBody = await res.text();
    let payload: any;
    try {
      payload = responseBody ? JSON.parse(responseBody) : null;
    } catch {
      payload = null;
    }
    if (!res.ok) {
      throw new Error(
        payload?.detail || responseBody.trim() || `Scan service failed (HTTP ${res.status}).`
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Scan service returned an empty or invalid response. Please retry.');
    }

    const result = payload as ScanResult;
    this.saveScanToHistory(result);
    return result;
  },

  async getScientificReport(scanId: string, language: string = 'en'): Promise<string> {
    const res = await fetch(`${API_BASE}/scans/${scanId}/scientific-report?language=${language}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch report (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.report;
  },

  // Scan History
  getScanHistory(): ScanResult[] {
    const raw = localStorage.getItem(STORAGE_SCANS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  saveScanToHistory(scan: ScanResult) {
    const list = this.getScanHistory();
    const updated = [scan, ...list.slice(0, 19)]; // Keep latest 20 scans
    localStorage.setItem(STORAGE_SCANS_KEY, JSON.stringify(updated));
  },

  // Offline queue helpers — delegate to IndexedDB (FR-8.3)
  async getOfflineQueue(): Promise<any[]> {
    return getAllOfflineScans();
  },

  async clearOfflineQueue(): Promise<void> {
    return clearAllOfflineScans();
  },

  async getOfflineQueueCount(): Promise<number> {
    return getOfflineScansCount();
  },

  // RAG Advisory Chat with SSE Streaming Support
  async askAdvisoryStreaming(
    question: string,
    plotId: string | undefined,
    scanId: string | undefined,
    language: string,
    onToken: (token: string) => void,
    onComplete: (data: any) => void,
    onError: (err: any) => void
  ) {
    try {
      const res = await fetch(`${API_BASE}/advisories?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, plot_id: plotId, scan_id: scanId, language })
      });

      if (!res.ok) throw new Error('Advisory request failed');
      if (!res.body) throw new Error('No streaming response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            onToken(dataStr);
          } else if (line.startsWith('event: end')) {
            // End marker with full JSON
            const dataMatch = line.match(/data: (.*)/);
            if (dataMatch) {
              try {
                const fullPayload = JSON.parse(dataMatch[1]);
                onComplete(fullPayload);
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      onError(e);
    }
  },

  async transcribeVoice(audio: Blob, language: string): Promise<{ transcript: string; language_detected: string; is_demo_data: boolean }> {
    const form = new FormData();
    const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('wav') ? 'wav' : 'webm';
    form.append('audio', audio, `voice.${extension}`);
    form.append('language_hint', language);
    const response = await fetch(`${API_BASE}/voice/transcribe`, { method: 'POST', body: form });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Local Whisper transcription failed.');
    }
    return response.json();
  },

  // Advisory History
  getAdvisoryHistory(): AdvisoryMessage[] {
    const raw = localStorage.getItem(STORAGE_ADVISORY_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  saveAdvisoryHistory(messages: AdvisoryMessage[]) {
    localStorage.setItem(STORAGE_ADVISORY_KEY, JSON.stringify(messages.slice(-30)));
  },

  // Model Registry
  async getModels(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/models`);
    return res.json();
  },

  async getModelCard(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/models/${id}/card`);
    return res.json();
  },

  // Outbreaks
  async getOutbreaks(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/outbreaks`);
    return res.json();
  },

  // Carbon Sequestration & Biomass Calculator
  async calculateCarbon(req: CarbonCalculatorRequest): Promise<CarbonCalculatorResponse> {
    try {
      const res = await fetch(`${API_BASE}/carbon/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('Calculation request failed');
      const data = await res.json();
      localStorage.setItem(`agribridge_carbon_calc_${req.plot_id || 'custom'}`, JSON.stringify(data));
      return data;
    } catch (e) {
      const cached = localStorage.getItem(`agribridge_carbon_calc_${req.plot_id || 'custom'}`);
      if (cached) return JSON.parse(cached);

      // Deterministic client-side approximation for offline mode
      const bd = 1.30;
      const baseSocStock = Math.round(req.soc_g_kg * bd * 30 * 0.1 * 0.95 * 100) / 100;
      let annualRate = 0.0;
      if (req.tillage_practice === 'zero_till') annualRate += 1.55;
      else if (req.tillage_practice === 'reduced') annualRate += 0.75;
      if (req.cover_crop === 'legume') annualRate += 1.25;
      else if (req.cover_crop === 'non_legume') annualRate += 0.65;
      if (req.organic_amendment.includes('biochar')) annualRate += 2.35;
      else if (req.organic_amendment === 'manure') annualRate += 1.10;
      if (req.agroforestry_border) annualRate += 1.60;

      const totalAnnual = Math.round(annualRate * req.area_ha * 100) / 100;
      const trajectory = [];
      const k = 0.16;
      for (let yr = 1; yr <= req.years_projection; yr++) {
        const eff = (1.0 - Math.exp(-k * yr)) / k;
        const cum = Math.round(annualRate * eff * req.area_ha * 100) / 100;
        trajectory.push({
          year: yr,
          soc_stock_t_per_ha: Math.round((baseSocStock + (annualRate * eff / 3.67)) * 100) / 100,
          cumulative_co2e_t: cum,
          carbon_dividend_usd: Math.round(cum * req.carbon_price_per_ton * 100) / 100
        });
      }
      const aboveBiomass = Math.round(1450.0 * Math.exp(1.82 * Math.max(0.2, req.current_ndvi)));
      const offlineFingerprint = `DEMO-OFFLINE-NOT-VERIFIED-${Date.now().toString(16).toUpperCase()}`;
      return {
        baseline_soc_stock_t_per_ha: baseSocStock,
        total_baseline_soc_t: Math.round(baseSocStock * req.area_ha * 100) / 100,
        annual_sequestration_rate_t_co2e_per_ha: Math.round(annualRate * 100) / 100,
        total_annual_co2e_sequestered_t: totalAnnual,
        cumulative_co2e_sequestered_t: trajectory[trajectory.length - 1]?.cumulative_co2e_t || 0,
        avoided_n2o_emissions_kg: req.cover_crop === 'legume' ? Math.round(65 * 5.8 * req.area_ha) : 0,
        soil_microbial_biomass_kg_per_ha: Math.round(baseSocStock * 28),
        aboveground_canopy_biomass_kg_per_ha: aboveBiomass,
        belowground_root_biomass_kg_per_ha: Math.round(aboveBiomass * 0.28),
        annual_carbon_dividend_usd: Math.round(totalAnnual * req.carbon_price_per_ton * 100) / 100,
        annual_carbon_dividend_local: Math.round(totalAnnual * req.carbon_price_per_ton * 84 * 100) / 100,
        local_currency_symbol: '₹',
        stewardship_tier: annualRate >= 4.5 ? 'Platinum Soil Champion' : annualRate >= 2.5 ? 'Gold' : 'Silver',
        yearly_trajectory: trajectory,
        practice_breakdown: { tillage: req.tillage_practice === 'zero_till' ? 1.55 : 0.75, cover_crop: 1.25, amendments: 2.35 },
        recommendations: [
          'Maintain continuous zero-tillage to prevent soil aggregate oxidation.',
          'Rotate with legume cover crops to boost atmospheric nitrogen fixation.'
        ],
        methodology: 'Offline illustrative estimate; not field-calibrated or certified.',
        india_certificate_hash: offlineFingerprint,
        certificate_hash: offlineFingerprint,
        is_demo_data: true
      };
    }
  },

  async getPlotCarbon(plotId: string, params?: { tillage?: string; cover_crop?: string; amendment?: string; years?: number; price?: number; lang?: string }): Promise<CarbonCalculatorResponse> {
    const q = new URLSearchParams();
    if (params?.tillage) q.append('tillage', params.tillage);
    if (params?.cover_crop) q.append('cover_crop', params.cover_crop);
    if (params?.amendment) q.append('organic_amendment', params.amendment);
    if (params?.years) q.append('years', String(params.years));
    if (params?.price) q.append('carbon_price', String(params.price));
    if (params?.lang) q.append('lang', params.lang);

    const res = await fetch(`${API_BASE}/carbon/plot/${plotId}?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch plot carbon');
    return res.json();
  }
};
