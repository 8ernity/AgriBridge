import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Eye,
  MessageSquare,
  Check,
  ChevronDown
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { ScanResult, Plot } from '../types';
import { apiClient } from '../services/api';

interface ScanTabProps {
  locale: Locale;
  isOnline: boolean;
  plots: Plot[];
  onScanCompleted: (result: ScanResult) => void;
  onOpenAskWithScan: (result: ScanResult) => void;
}

export const ScanTab: React.FC<ScanTabProps> = ({
  locale,
  isOnline,
  plots,
  onScanCompleted,
  onOpenAskWithScan
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showGradCam, setShowGradCam] = useState<boolean>(false);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [outbreakReported, setOutbreakReported] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const imageLoadIdRef = useRef(0);

  // Initialize camera stream if supported
  const startCamera = async () => {
    imageLoadIdRef.current += 1;
    setIsCapturing(true);
    setImagePreview(null);
    setImageBlob(null);
    setScanResult(null);
    setQualityWarning(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      // Fallback directly to native camera file input (FR-4.1)
      setIsCapturing(false);
      cameraInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  // Pre-flight check and resize on client (FR-4.2 & FR-4.3)
  const processImageFile = (file: File) => {
    const imageLoadId = ++imageLoadIdRef.current;
    setImagePreview(null);
    setImageBlob(null);
    setScanResult(null);
    setQualityWarning(null);
    setOutbreakReported(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (imageLoadId !== imageLoadIdRef.current) return;
      const img = new Image();
      img.onload = () => {
        if (imageLoadId !== imageLoadIdRef.current) return;
        // Resize to max 1024px maintaining aspect ratio
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);

          // Fast client-side brightness check
          const imgData = ctx.getImageData(0, 0, width, height);
          let totalLuminance = 0;
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 40) { // Sample every 10th pixel
            totalLuminance += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
          }
          const avgLuminance = totalLuminance / (data.length / 40);

          if (avgLuminance < 35) {
            setQualityWarning("Image appears dark. For best accuracy, ensure sufficient daylight on the leaf.");
          } else if (avgLuminance > 230) {
            setQualityWarning("Image appears washed out or has glare. Shield leaf from direct reflections.");
          } else {
            setQualityWarning(null);
          }

          canvas.toBlob(
            (blob) => {
              if (blob && imageLoadId === imageLoadIdRef.current) {
                setImageBlob(blob);
                setImagePreview(canvas.toDataURL('image/jpeg', 0.85));
              }
            },
            'image/jpeg',
            0.85
          );
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const captureFromVideo = () => {
    if (!videoRef.current) return;
    imageLoadIdRef.current += 1;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      stopCamera();
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setImageBlob(blob);
            setImagePreview(canvas.toDataURL('image/jpeg', 0.85));
          }
        },
        'image/jpeg',
        0.85
      );
    }
  };

  const handleUploadAndDiagnose = async () => {
    if (!imageBlob) return;
    setIsProcessing(true);
    setQualityWarning(null);

    try {
      const result = await apiClient.diagnoseLeaf(
        imageBlob,
        selectedCrop,
        selectedPlotId || undefined,
        !isOnline,
        locale
      );
      result.local_image_url = imagePreview || undefined;
      setScanResult(result);
      onScanCompleted(result);
    } catch (err: any) {
      alert(`Diagnosis Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptInOutbreakReport = async () => {
    if (!scanResult) return;
    setOutbreakReported(true);
    // Submit coarse-grid outbreak notice (FR-9.1)
    fetch('/api/v1/outbreaks/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 25.317,
        lon: 82.973,
        crop: scanResult.crop || selectedCrop,
        disease: scanResult.top_disease
      })
    }).catch(() => {});
  };

  return (
    <div className="content-area animate-fade-in" style={{ paddingBottom: 110 }}>
      {/* Title Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          {t.navScan}: {locale === 'hi' ? 'एआई फसल रोग निदान' : locale === 'bn' ? 'এআই শস্য রোগ নির্ণয়' : false ? 'Utambuzi wa Magonjwa ya Mazao' : 'AI Crop Diagnosis'}
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {locale === 'hi' ? 'स्थानीय एआई जाँच: 387 फसलें समर्थित' : locale === 'bn' ? 'স্থানীয় এআই স্ক্যান: 387 টি ফসল সমর্থিত' : 'Local AI screening: 387 crops supported' }
        </p>
      </div>

      {/* Target Crop Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {t.cropType || "Crop Type"}
          </label>
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: 10,
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <option value="">{locale === 'hi' ? 'सभी 387 फसलें स्वतः पहचानें' : locale === 'bn' ? 'সব 387 টি ফসল স্বয়ংক্রিয়ভাবে শনাক্ত করুন' : 'Auto-detect all crops (387 Classes)'}</option>
            <option value="tomato">{locale === 'hi' ? 'टमाटर (Tomato)' : locale === 'bn' ? 'টমেটো (Tomato)' : 'Tomato (टमाटर)'}</option>
            <option value="potato">{locale === 'hi' ? 'आलू (Potato)' : locale === 'bn' ? 'আলু (Potato)' : 'Potato (आलू)'}</option>
            <option value="maize">{locale === 'hi' ? 'मक्का (Maize)' : locale === 'bn' ? 'ভুট্টা (Maize)' : 'Maize (मक्का)'}</option>
            <option value="rice">{locale === 'hi' ? 'धान / चावल (Rice)' : locale === 'bn' ? 'ধান (Rice)' : 'Rice (धान)'}</option>
            <option value="wheat">{locale === 'hi' ? 'गेहूं (Wheat)' : locale === 'bn' ? 'গম (Wheat)' : 'Wheat (गेहूं)'}</option>
            <option value="cotton">{locale === 'hi' ? 'कपास (Cotton)' : locale === 'bn' ? 'তুলা (Cotton)' : 'Cotton (कपास)'}</option>
            <option value="sugarcane">{locale === 'hi' ? 'गन्ना (Sugarcane)' : locale === 'bn' ? 'আখ (Sugarcane)' : 'Sugarcane (गन्ना)'}</option>
            <option value="onion">{locale === 'hi' ? 'प्याज (Onion)' : locale === 'bn' ? 'পেঁয়াজ (Onion)' : 'Onion (प्याज)'}</option>
            <option value="bell_pepper">{locale === 'hi' ? 'शिमला मिर्च (Bell Pepper)' : locale === 'bn' ? 'ক্যাপসিকাম (Bell Pepper)' : 'Bell Pepper (शिमला मिर्च)'}</option>
            <option value="chilli">{locale === 'hi' ? 'मिर्च (Chilli)' : locale === 'bn' ? 'মরিচ (Chilli)' : 'Chilli (मिर्च)'}</option>
            <option value="apple">{locale === 'hi' ? 'सेब (Apple)' : locale === 'bn' ? 'আপেল (Apple)' : 'Apple (सेब)'}</option>
            <option value="grape">{locale === 'hi' ? 'अंगूर (Grape)' : locale === 'bn' ? 'আঙ্গুর (Grape)' : 'Grape (अंगूर)'}</option>
          </select>
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {locale === 'hi' ? 'ऑटो पहचान 387 फसलों में से चुनती है।' : locale === 'bn' ? 'স্বয়ংক্রিয় শনাক্তকরণ 387 টি ফসলের মধ্যে নির্বাচন করে।' : 'Auto-detection chooses among 387 crops.'}
      </p>

      {/* Camera Viewfinder / Capture Box */}
      {!scanResult && (
        <div
          className="agri-card viewfinder-card"
          style={{
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: 0
          }}
        >
          {isCapturing ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: 280, objectFit: 'cover' }}
              />
              {/* Guide Overlay Frame (FR-4.2) */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200,
                height: 200,
                border: '2px dashed var(--primary-400)',
                borderRadius: 16,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none'
              }}>
                <span style={{
                  position: 'absolute',
                  top: -24,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  color: '#fff',
                  fontWeight: 600
                }}>
                  {t.frameLeaf || "Frame Leaf Within Box"}
                </span>
              </div>

              <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn-primary" onClick={captureFromVideo} style={{ borderRadius: 9999, padding: '12px 24px' }}>
                  <Camera size={20} />
                  <span>{t.capturePhoto || "Capture Photo"}</span>
                </button>
                <button className="btn-secondary" onClick={stopCamera} style={{ borderRadius: 9999 }}>
                  {t.cancel || "Cancel"}
                </button>
              </div>
            </div>
          ) : imagePreview ? (
            <div style={{ width: '100%', textAlign: 'center', position: 'relative' }}>
              <img
                src={imagePreview}
                alt="Leaf scan preview"
                style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }}
              />
              <button
                onClick={() => { setImagePreview(null); setImageBlob(null); }}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {t.retake || "Retake"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <Camera size={34} color="var(--primary-400)" />
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                {t.holdCamera || "Hold camera 15-20 cm from leaf"}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                {t.ensureFocus || "Ensure clear focus on spots or diseased lesions"}
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button id="scan-camera-launch-btn" className="btn-primary" onClick={startCamera}>
                  <Camera size={18} />
                  <span>{t.liveCamera || "Live Camera"}</span>
                </button>
                <button
                  id="scan-gallery-launch-btn"
                  className="btn-secondary"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload size={18} />
                  <span>{t.choosePhoto || "Choose Photo"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Native Camera Fallback Input (explicitly captures from camera) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processImageFile(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />

          {/* Photo Gallery / File Picker Input (NO capture attribute -> opens gallery/file chooser) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processImageFile(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Quality Pre-Check Alert (FR-4.2) */}
      {qualityWarning && !scanResult && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertTriangle size={20} color="var(--brand-amber)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--foreground)' }}>
            {qualityWarning}
          </span>
        </div>
      )}

      {/* Action Buttons to Run Diagnosis */}
      {imagePreview && !scanResult && (
        <button
          id="btn-run-diagnosis"
          className="btn-primary"
          onClick={handleUploadAndDiagnose}
          disabled={isProcessing}
          style={{ width: '100%', fontSize: '1.05rem', padding: 15 }}
        >
          {isProcessing ? (
            <>
              <RefreshCw size={20} className="dot-pulse" />
              <span>{t.analyzingFoliar || "Analyzing Foliar Features..."}</span>
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              <span>{t.diagnoseBtn || "Diagnose Leaf Disease"}</span>
            </>
          )}
        </button>
      )}

      {/* Scan Results View (FR-4.4, FR-4.5, FR-4.6) */}
      {scanResult && (
        <div className="scan-results animate-fade-in">
          <section className="agri-card scan-diagnosis-card">
          {/* Status Badge & Confidence Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: '0.78rem',
              fontWeight: 700,
              background: scanResult.status === 'confident' ? 'rgba(154, 205, 50, 0.16)' : 'rgba(245, 158, 11, 0.16)',
              color: scanResult.status === 'confident' ? 'var(--status-confident)' : 'var(--status-uncertain)',
              border: `1px solid ${scanResult.status === 'confident' ? 'rgba(154, 205, 50, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
              maxWidth: '100%'
            }}>
              {scanResult.status === 'confident' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              <span>{scanResult.status === 'confident' ? t.confidentDiagnosis : t.uncertainDiagnosis}</span>
            </span>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 8,
              background: 'var(--surface-card-hover)',
              border: '1px solid var(--border)',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--muted-foreground)'
            }}>
              <span>{t.confidence || "Confidence"}:</span>
              <strong style={{
                color: scanResult.status === 'confident' ? 'var(--brand-green)' : 'var(--status-uncertain)',
                fontWeight: 800
              }}>
                {scanResult.status === 'confident' ? `${Math.round(scanResult.confidence * 100)}%` : '—'}
              </strong>
            </div>
          </div>

          {/* Primary Diagnosis Header */}
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
              {scanResult.top_disease}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--brand-green)' }}>
              {t.crop || "Crop"}: {scanResult.crop} • {t.model || "Model"}: {scanResult.model_version}
            </div>
          </div>

          <div className="scan-summary-grid">
            <div className="scan-summary-item">
              <span className="scan-summary-label">{t.confidence || "Confidence"}</span>
              <strong>{scanResult.status === 'confident' ? `${Math.round(scanResult.confidence * 100)}%` : '—'}</strong>
            </div>
            <div className="scan-summary-item">
              <span className="scan-summary-label">Confidence tier</span>
              <strong>{scanResult.status === 'confident' ? "High confidence" : "Needs review"}</strong>
            </div>
            <div className="scan-summary-item">
              <span className="scan-summary-label">{t.model || "Model"}</span>
              <strong>{scanResult.model_version}</strong>
            </div>
            <div className="scan-summary-item">
              <span className="scan-summary-label">{t.crop || "Crop"}</span>
              <strong>{scanResult.crop}</strong>
            </div>
          </div>

          {/* Grad-CAM Feature Map Toggle */}
          {imagePreview && (
            <div className="scan-preview-wrap">
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
                <img
                  src={imagePreview}
                  alt="Diagnosis review"
                  style={{ width: '100%', height: 200, objectFit: 'contain', background: 'var(--surface-border-subtle)' }}
                />
                {showGradCam && scanResult.gradcam_heatmap_url && (
                  <img
                    src={scanResult.gradcam_heatmap_url}
                    alt="Grad-CAM activation overlay"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: 200,
                      objectFit: 'contain',
                      mixBlendMode: 'screen',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
              {scanResult.gradcam_heatmap_url && (
                <button
                  onClick={() => setShowGradCam(s => !s)}
                  style={{
                    background: showGradCam ? 'var(--brand-green-glow)' : 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--brand-green)',
                    borderRadius: 9999,
                    padding: '6px 14px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    marginTop: 8,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <Eye size={14} />
                  <span>{showGradCam ? (t.hideGradCam || "Hide Attention Heat-Map") : (t.viewGradCam || "Toggle Grad-CAM Heat-Map (Explainability)")}</span>
                </button>
              )}
            </div>
          )}

          </section>

          <aside className="scan-results-side">
            <section className="agri-card scan-assistant-card">
              <div className="scan-assistant-heading">
                <MessageSquare size={20} />
                <div>
                  <h3>AI Agronomist Assistant</h3>
                  <span>Ask about this diagnosis and next steps</span>
                </div>
              </div>
              <p>{`Have questions about ${scanResult.crop} — ${scanResult.top_disease}? Ask for more information and practical next steps.`}</p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => onOpenAskWithScan(scanResult)}>
                <MessageSquare size={18} />
                <span>{t.askFollowUp || "Ask Follow-Up Advisory on Diagnosis"}</span>
              </button>
            </section>

            {/* Top-3 Predictions Distribution (FR-4.4) */}
            {scanResult.predictions.length > 0 && <section className="agri-card scan-confidence-card">
              <h3>{t.topProbabilities || "Confidence Distribution"}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {scanResult.predictions.map((p, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{p.disease_name}</span>
                      <span style={{ color: 'var(--brand-green)', fontWeight: 700, flexShrink: 0 }}>{Math.round(p.confidence * 100)}%</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(128,128,128,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.confidence * 100}%`, background: i === 0 ? 'var(--brand-green)' : 'var(--primary-700)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>}
          </aside>

          <section className="agri-card scan-guidance-card" style={{
            background: 'var(--brand-green-glow)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 16,
            padding: 24,
            marginTop: 0,
            marginBottom: 16,
            gridColumn: 1
          }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              borderRadius: 12,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={24} color="var(--brand-green)" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                color: 'var(--brand-green)', 
                margin: 0, 
                fontFamily: 'var(--font-heading)' 
              }}>
                Recommended Precautions & Action Guidance
              </h3>
              
              <p style={{ 
                fontSize: '0.95rem', 
                color: 'var(--foreground)', 
                margin: 0, 
                lineHeight: 1.5 
              }}>
                {scanResult.management_summary}
                {scanResult.cultural_practices.map((c, idx) => (
                  <span key={idx}> {c}</span>
                ))}
              </p>
            </div>
          </section>

          <section className="agri-card scan-guidance-card" style={{ marginTop: 0, gridColumn: 1 }}>
          {/* Uncertain Guidance (FR-4.5) */}
          {scanResult.status === 'uncertain' && scanResult.retake_guidance && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-amber)', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                <HelpCircle size={18} />
                <span>{t.retakeTipsTitle}</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                {scanResult.retake_guidance}
              </p>
            </div>
          )}

          {/* Symptoms and Management Summary (FR-4.6) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {scanResult.is_demo_data && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 800 }}>DEMO DATA — no compatible model prediction was available for this crop; placeholders must not guide treatment.</p>}
            {scanResult.guidance_is_demo_data && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>DEMO GUIDANCE — management text is illustrative and has not been independently reviewed.</p>}
            {!scanResult.guidance_is_demo_data && <p role="status" style={{ color: 'var(--brand-green)', fontWeight: 700 }}>Gemma 4 AI guidance — general precautions only; confirm the diagnosis with your local agricultural extension officer.</p>}
            {scanResult.symptoms.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
                  {t.symptoms}
                </h4>
                <ul style={{ paddingLeft: 18, fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                  {scanResult.symptoms.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Chemical Warning Banner (FR-4.6, FR-5.5) */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              padding: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}>
              <ShieldAlert size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.78rem', color: '#fecaca' }}>
                <strong>{t.chemicalWarning}:</strong> {scanResult.chemical_warning}
              </div>
            </div>

            {/* Source Citations (FR-4.6) */}
            {scanResult.sources.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-400)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <BookOpen size={16} />
                  <span>{t.citedSources}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {scanResult.sources.map((src, i) => (
                    <div key={i} style={{ background: 'var(--surface-border-subtle)', padding: '6px 10px', borderRadius: 8, fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>[{src.source_id}] {src.title}</div>
                      <div style={{ color: 'var(--text-dim)' }}>Publisher: {src.publisher} • {src.license}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, gridColumn: '1 / -1' }}>
            {/* Anonymous Outbreak Sharing (stretch FR-9.1) */}
            {scanResult.status === 'confident' && !outbreakReported && (
              <button
                className="btn-secondary"
                style={{ width: '100%', fontSize: '0.82rem' }}
                onClick={handleOptInOutbreakReport}
              >
                <span>{t.shareAlert || "Share Anonymous Diagnosis with Regional Alert Network"}</span>
              </button>
            )}

            {outbreakReported && (
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--primary-400)' }}>
                {t.alertShared || "✓ Anonymized cluster report submitted. Thank you for protecting neighboring farmers!"}
              </div>
            )}

            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => { setScanResult(null); setImagePreview(null); setImageBlob(null); }}
            >
              {t.newScan || "New Scan"}
            </button>
          </div>
          </section>
        </div>
      )}
    </div>
  );
};
