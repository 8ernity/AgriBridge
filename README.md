# 🌱 AgriBridge

> **An advanced, India-focused agricultural intelligence platform combining edge-device computer vision, multilingual speech recognition, and Multimodal AI for crop disease analysis and farm advisory.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0-61DAFB.svg?style=flat&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat&logo=python)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![ONNX](https://img.shields.io/badge/ONNX-Runtime-005CED.svg?style=flat&logo=onnx)](https://onnxruntime.ai/)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Models-FFD21E.svg?style=flat&logo=huggingface)](https://huggingface.co/)
[![Gemma 4](https://img.shields.io/badge/AI-Gemma%204-4285F4?style=flat&logo=google)](https://deepmind.google/technologies/gemma/)

---

AgriBridge is an experimental, mobile-first agricultural intelligence platform designed for smallholder farmers in India. It fuses **Local Computer Vision (MobileNetV3 / DINOv2)** for offline-capable crop disease scanning, **Multilingual Speech Recognition (Whisper)** for voice queries, **Dense Vector Retrieval (BGE-small)** for localized semantic search, and **Generative AI (Gemma 4)** to deliver personalized, actionable agronomic advice.

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture & Pipeline](#️-architecture--pipeline)
  - [System Architecture](#system-architecture)
  - [AI & Data Processing Flow](#ai--data-processing-flow)
- [🛠️ Tech Stack](#️-tech-stack)
- [🤖 Open Source Models & AI Integrations](#-open-source-models--ai-integrations)
- [🌍 Regional Context (India)](#-regional-context-india)
- [🔑 Environment Variables](#-environment-variables)
- [💻 Local Development Setup](#-local-development-setup)
- [🚀 Deployment](#-deployment)
- [📝 License](#-license)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🌿 **Edge Disease Classifier** | 15-class local crop disease scanning for tomato, potato, and bell pepper using MobileNetV3 (ONNX). Includes fail-closed OOD detection. |
| 🗣️ **Multilingual Voice Advisory** | Local transcription of spoken queries (English, Hindi, Bengali) enabling hands-free interaction for farmers via Whisper Small. |
| 🤖 **Generative Agronomic AI** | Synthesizes post-scan precautions, avoidance steps, and follow-up guidance into clear, actionable advice using Gemma 4 via Gemini API. |
| 🌦️ **Environmental Adapters** | Integrates hyper-local weather (Open-Meteo) and soil parameters (SoilGrids) to contextualize AI advice based on exact farm coordinates. |
| 🌍 **Carbon Estimation Engine** | Illustrative calculations for farm-level carbon footprint and sequestration potential using localized parametric estimators. |
| 📱 **Offline-First Mobile PWA** | Progressive Web App architecture with IndexedDB caching ensures scans and basic queries work even during intermittent rural connectivity. |
| 🔒 **Privacy-First AI** | Voice transcription and initial vector embeddings run strictly locally. Images are processed on-device and never uploaded to cloud LLMs. |

---

## 🏗️ Architecture & Pipeline

### System Architecture

```mermaid
flowchart TB
    %% Styling Definitions
    classDef clientStyle fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF,font-weight:bold
    classDef apiStyle fill:#3B82F6,stroke:#2563EB,stroke-width:2px,color:#FFFFFF,font-weight:bold
    classDef aiStyle fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef dataStyle fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    classDef extStyle fill:#EC4899,stroke:#DB2777,stroke-width:2px,color:#FFFFFF

    subgraph ClientLayer["📱 CLIENT PRESENTATION LAYER"]
        PWA["React + Vite PWA<br/><i>(Offline Support · Camera Access)</i>"]:::clientStyle
    end

    PWA -->|REST API / SSE| FastAPI

    subgraph BackendLayer["⚡ FASTAPI BACKEND SERVICE LAYER (Python)"]
        FastAPI["FastAPI App Gateway & Routers"]:::apiStyle

        subgraph LocalAI["Local Edge Models"]
            CV["🌿 Computer Vision<br/><i>(MobileNetV3 ONNX)</i>"]:::aiStyle
            ASR["🎙️ Speech-to-Text<br/><i>(Whisper Small)</i>"]:::aiStyle
            Embed["🔍 Semantic Retrieval<br/><i>(BGE-small + FastEmbed)</i>"]:::aiStyle
        end
        
        subgraph Services["Core Business Logic"]
            Advisory["🌾 Advisory Service<br/><i>(RAG & Generation)</i>"]:::dataStyle
            Weather["🌦️ Weather Context<br/><i>(Aggregator)</i>"]:::dataStyle
        end

        FastAPI --> CV & ASR & Advisory & Weather
        Advisory --> Embed
    end

    subgraph ExternalCloud["☁️ EXTERNAL CLOUD APIS"]
        LLM["🧠 Gemma 4<br/><i>(Gemini API)</i>"]:::extStyle
        Meteo["🌤️ Open-Meteo API"]:::extStyle
        SoilGrids["🌱 SoilGrids API"]:::extStyle
    end

    Advisory <-->|Prompts & Context| LLM
    Weather --> Meteo & SoilGrids
```

### AI & Data Processing Flow

```mermaid
flowchart LR
    classDef inputStyle fill:#3B82F6,stroke:#1D4ED8,color:#FFF,font-weight:bold
    classDef edgeStyle fill:#047857,stroke:#065F46,color:#FFF
    classDef cloudStyle fill:#BE123C,stroke:#9F1239,color:#FFF,font-weight:bold
    classDef outStyle fill:#10B981,stroke:#059669,color:#FFF,font-weight:bold

    User["Farmer Input<br/>(Voice / Image / Text)"]:::inputStyle --> EdgeRouter{Input Type}:::inputStyle
    
    EdgeRouter -->|Image| CV["MobileNetV3<br/>(Local Inference)"]:::edgeStyle
    EdgeRouter -->|Voice| ASR["Whisper Model<br/>(Local Transcription)"]:::edgeStyle
    EdgeRouter -->|Text| TextFlow["Text Query"]:::edgeStyle
    
    ASR --> TextFlow
    CV --> ContextBuilder["Context Assembler"]:::edgeStyle
    TextFlow --> RAG["BGE Semantic Search<br/>(Local Knowledge Base)"]:::edgeStyle
    
    RAG --> ContextBuilder
    ContextBuilder --> LLM["Gemma 4 API<br/>(Cloud LLM Synthesis)"]:::cloudStyle
    
    LLM --> Formatter["Multilingual Formatter<br/>(EN / HI / BN)"]:::outStyle
    Formatter --> UI["Progressive Web App"]:::outStyle
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **Frontend Runtime** | React 18 + Vite | High-performance, reactive UI development |
| **Styling** | Tailwind CSS / Vanilla CSS | Responsive, mobile-first interface design |
| **Backend Framework** | FastAPI | Asynchronous Python REST API |
| **Inference Engine** | ONNX Runtime | High-speed local execution of vision models |
| **Vector Embeddings** | FastEmbed | Lightweight, local text embeddings for RAG |
| **Generative AI** | Google Gemini SDK | Interface for Gemma 4 synthesis and translation |

---

## 🤖 Open Source Models & AI Integrations

AgriBridge is built on a foundation of powerful open-weights and API-accessible AI models:

- **Gemma 4 (`gemma-4-26b-a4b-it`)**: Hosted through the Gemini API. Used for advisory chat and synthesizing structured post-scan precautions, avoidance, and follow-up guidance based on local crop contexts.
- **Whisper Small (`Systran/faster-whisper-small`)**: Powers local backend audio transcription. Downloads weights on first use and ensures voice data is processed locally without third-party audio transmission.
- **BGE-small-en-v1.5**: Facilitates local semantic retrieval via FastEmbed's Qdrant ONNX export, matching farmer queries against our demonstration advisory corpus.
- **MobileNetV3-Small**: Fine-tuned 15-class local inference model (`imaflower/plantvillage-mobilenetv3`). Processes images entirely locally to detect diseases across tomatoes, potatoes, and bell peppers.

> **Privacy Guardrail:** Whisper and BGE run strictly locally. When configured, text prompts and retrieved contexts are sent to the Gemini API for Gemma 4 synthesis. Images are **never** uploaded to external APIs for guidance calls.

---

## 🌍 Regional Context (India)

The application is specifically tuned for Indian agricultural contexts, driven by internal localization configurations:

- **Languages Supported:** English, Hindi (हिंदी), and Bengali (বাংলা)
- **Primary Crops Supported:** Tomato, Potato, Maize, and Bell Pepper
- **Default Geolocation Data:** Central India / Agrarian zones for fallback weather mapping.
- **Extension Services:** Direct routing recommendations to local Krishi Vigyan Kendras (KVKs).

---

## 🔑 Environment Variables

To run AgriBridge locally or in production, you must configure the following environment variables. Create a `.env` file in the root of the project:

```env
# Google Gen AI API Key (Required for Gemma 4 synthesis)
GEMINI_API_KEY=your_api_key_here

# Optional overrides for local model caching paths
# HUGGINGFACE_HUB_CACHE=./models/hf_cache
```

---

## 💻 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/8ernity/AgriBridge.git
cd AgriBridge
```

### 2. Configure Environment
Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```

### 3. Start the FastAPI Backend
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Note: The backend will automatically download the ONNX models and HuggingFace weights on first launch.*

### 4. Start the React Frontend
Open a new terminal window:
```bash
cd frontend
npm ci
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🚀 Deployment

AgriBridge is designed to be easily deployed to PaaS providers like Render, Heroku, or Vercel.

**Render Deployment Strategy:**
1. **Frontend:** Deploy as a Static Site (Node/React). Build command: `npm run build`, Publish directory: `dist`.
2. **Backend:** Deploy as a Web Service (Python). Build command: `pip install -r requirements.txt`, Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

*Important: Ensure `GEMINI_API_KEY` is set in your host's environment variables.*

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

> **Notice**: AgriBridge outputs are generated for demonstration and experimental purposes. Do not use outputs to make agronomic, financial, or compliance decisions without consulting local extension services.
