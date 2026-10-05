# 📐 AgriBridge: System Architecture

AgriBridge is an India-focused software prototype with a web frontend and FastAPI backend. Some features use synthetic data or unverified model assets; see `docs/EVALUATION.md`.

```
                              +---------------------------------------+
                              |         Farmer Mobile Device          |
                              |  (React 18 + Vite PWA + Dexie DB)     |
                              |  - 5-Tab Touch UI (>=48px targets)    |
                              |  - Camera + Blur/Brightness pre-check |
                              |  - Offline Sync Queue & Cache Engine  |
                              +-------------------+-------------------+
                                                  |
                                                  | HTTPS / REST / SSE
                                                  v
                              +---------------------------------------+
                              |         FastAPI Gateway (/api/v1)     |
                              +---+----------+----------+----------+--+
                                  |          |          |          |
         +------------------------+          |          |          +-----------------------+
         |                                   |          |                                  |
         v                                   v          v                                  v
+------------------+     +-------------------+   +--------------------+     +---------------------+
| Environmental    |     | Disease Diagnosis |   | Regenerative Engine|     | RAG Advisory Service|
| Adapter Hub      |     | Service           |   | & Agronomy Rules   |     | (Hybrid Search)     |
+------------------+     +-------------------+   +--------------------+     +---------------------+
| - Open-Meteo     |     | - ONNX Runtime    |   | - Multi-factor     |     | - Agronomy Corpus   |
|   (Weather/Rain) |     | - Confidence Gate |   |   Suitability      |     | - Cited Passages    |
| - ISRIC SoilGrids|     | - Temperature Cal.|   | - Family Rotation  |     | - Safety Guardrails |
|   (pH/Carbon/N)  |     | - Retake Guidance |   |   Check            |     | - Local Language    |
| - Sentinel-2 NDVI|     | - Top-3 Outputs   |   | - Legume/Cover-crop|     |   Streaming (SSE)   |
|   90-day time-ser|     +-------------------+   |   Prioritization   |     +---------------------+
+------------------+                             +--------------------+
         |
         v
+------------------+
| In-Memory & DB   |
| 1-Hour TTL Cache |
+------------------+
```

---

## 1. Modular Subsystems

### 1.1 Environmental Adapters
- **Open-Meteo**: Requests current conditions and forecasts. If a request fails, synthetic values carry an explicit `is_demo_data` marker and UI label.
- **SoilGrids**: Requests soil properties. Fallback soil values are synthetic and marked `is_fallback`; they are not measured regional profiles.
- **Sentinel-2**: The service currently queries STAC metadata but does not read Red/NIR band pixels. The displayed NDVI history is synthetic demo data and is marked as such.

### 1.2 Disease Scan
- Scan inference uses the pinned PlantVillage MobileNetV3-Small ONNX artifact recorded in `models/registry/crop_disease_mobilenetv3_v1.json`. It runs locally and accepts tomato, potato, and bell pepper labels only.
- The upstream model card declares MIT, but its repository has no standalone license file. Its evaluation claims are not independently reproduced, and PlantVillage lab-image performance may not transfer to field photos. Unsupported crops or unavailable weights remain explicitly marked as demo data; management guidance remains demo guidance.
- The former unverified MobileNetV3 artifact and unrelated external Grad-CAM checkpoint were removed.

### 1.3 Local Speech Transcription
- Voice recordings are transcribed on the backend with `Systran/faster-whisper-small` using CPU int8 inference. Weights download from Hugging Face on first use.
- The uploaded clip is staged temporarily for decoding, then deleted; it is not sent to a speech API. Microphone access requires HTTPS or a secure localhost context.

### 1.4 Regenerative Agronomy Rules Engine
- Evaluates candidate crops from India's `configs/countries/india.json` configuration.
- Scores each crop using piecewise trapezoidal/bell-curve suitability functions:
  $$S = w_{\text{pH}} f(\text{pH}) + w_{\text{rain}} f(\text{rain}) + w_{\text{temp}} f(\text{temp}) + w_{\text{texture}} f(\text{texture}) + w_{\text{history}} f(\text{history})$$
- Enforces regenerative practices:
  - Strongly penalizes consecutive plantings of the same botanical family (e.g. Tomato $\to$ Potato, both *Solanaceae*).
  - Rewards inclusion of nitrogen-fixing legumes (e.g., Chickpea, Cowpea, Mung bean) when soil organic carbon or nitrogen is deficient.
  - Suggests cover crops if satellite NDVI indicates declining vegetative vigor.

### 1.5 Experimental Advisory
- Retrieves from a small bundled demonstration corpus using BGE-small-en-v1.5 when available, with keyword fallback.
- BGE runs locally through FastEmbed/ONNX. Optional Gemma 4 (`gemma-4-26b-a4b-it`) runs through the hosted Gemini API; requests leave the backend.
- Responses label `gemma_4_api` versus `local_demo_fallback`. Corpus source attributions and reuse licenses are unverified; neither response should be treated as verified citations or pesticide advice.
