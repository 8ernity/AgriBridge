"""AgriBridge crop disease classifier — india_v1 (DINOv2 ViT-B/14, 59 crops, 387 classes).

Model source: SIH_2026 / AgriSmart India (MIT-compatible, CC BY 4.0 datasets)
  https://github.com/wpzvqrs8/SIH_2026
  Release: india-model-v1  SHA-256: ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a
  Size: 344 MB  Accuracy: 90.9% macro-F1, 92.9% top-1 on clean India test set.

Usage (no PyTorch required — pure ONNX Runtime):
  On first start the ~344 MB ONNX file is auto-downloaded from the SIH_2026
  GitHub Release and cached in models/india-dinov2/.  Subsequent starts reuse
  the cached file.  Set env AGRIBRIDGE_ONNX_MODEL_PATH to override.
"""
import io
import os
import math
import hashlib
import logging
import json
import uuid
import zipfile
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

import numpy as np
from PIL import Image, ImageStat

from app.schemas.entities import (
    ScanResponse,
    DiseasePrediction,
    SourceCitation,
)
from app.services.advisory_service import generate_scan_guidance

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Model registry
# ──────────────────────────────────────────────────────────────────────────────
MODEL_VERSION = "agrismart-india-v1-dinov2-vit-b14@ffaffb1e"

# The 387-class label list in the exact order the ONNX model outputs them.
# Source: model/india/crops.json from wpzvqrs8/SIH_2026 (sorted crop keys, then
# sorted condition values within each crop — identical to the training order).
INDIA_CLASSES: List[str] = ['apple::Alternaria leaf blotch', 'apple::Apple scab', 'apple::Black rot', 'apple::Cedar apple rust', 'apple::Healthy', 'apple::Mosaic virus', 'ash_gourd::Aphid (pest)', 'ash_gourd::Downy mildew', 'ash_gourd::Healthy', 'ash_gourd::Leaf curl virus', 'banana::Anthracnose', 'banana::Aphid (pest)', 'banana::Bacterial soft rot', 'banana::Bract mosaic virus', 'banana::Bunchy top virus', 'banana::Cigar end rot', 'banana::Cordana leaf spot', 'banana::Fruit scarring beetle (pest)', 'banana::Healthy', 'banana::Insect pest damage', 'banana::Moko (bacterial wilt)', 'banana::Panama disease (fusarium wilt)', 'banana::Pestalotiopsis leaf spot', 'banana::Potassium deficiency', 'banana::Pseudostem weevil (pest)', 'banana::Sigatoka leaf spot', 'bean::Anthracnose', 'bean::Blight', 'bean::Halo blight', 'bean::Healthy', 'bean::Mosaic virus', 'bean::Rust', 'bell_pepper::Bacterial spot', 'bell_pepper::Blossom end rot', 'bell_pepper::Healthy', 'betel::Bacterial leaf disease', 'betel::Dried leaf', 'betel::Fungal brown spot', 'betel::Healthy', 'betel::Leaf rot', 'betel::Leaf spot', 'bitter_gourd::Downy mildew', 'bitter_gourd::Fusarium wilt', 'bitter_gourd::Healthy', 'bitter_gourd::Mosaic virus', 'black_gram::Anthracnose', 'black_gram::Cercospora leaf spot', 'black_gram::Healthy', 'black_gram::Insect pest damage', 'black_gram::Leaf crinkle virus', 'black_gram::Powdery mildew', 'black_gram::Yellow mosaic virus', 'blueberry::Healthy', 'bottle_gourd::Alternaria leaf blight', 'bottle_gourd::Anthracnose', 'bottle_gourd::Downy mildew', 'bottle_gourd::Healthy', 'bottle_gourd::Mosaic virus', 'brinjal_eggplant::Begomovirus leaf curl', 'brinjal_eggplant::Cercospora leaf spot', 'brinjal_eggplant::Fruit cracking', 'brinjal_eggplant::Fruit rot', 'brinjal_eggplant::Healthy', 'brinjal_eggplant::Insect pest damage', 'brinjal_eggplant::Mosaic virus', 'brinjal_eggplant::Phomopsis blight', 'brinjal_eggplant::Shoot and fruit borer (pest)', 'brinjal_eggplant::White mold', 'brinjal_eggplant::Wilt', 'cabbage::Alternaria leaf spot', 'cabbage::Black rot', 'cabbage::Downy mildew', 'cabbage::Healthy', 'cashew::Anthracnose', 'cashew::Gummosis', 'cashew::Healthy', 'cashew::Leaf miner (pest)', 'cashew::Red rust (algal)', 'cauliflower::Alternaria leaf spot', 'cauliflower::Bacterial soft rot', 'cauliflower::Black rot', 'cauliflower::Downy mildew', 'cauliflower::Healthy', 'cauliflower::Insect pest damage', 'cherry::Healthy', 'cherry::Leaf spot', 'cherry::Powdery mildew', 'chilli::Cercospora leaf spot', 'chilli::Healthy', 'chilli::Mites and thrips (pest)', 'chilli::Nutrient deficiency', 'chilli::Powdery mildew', 'citrus_orange::Black spot', 'citrus_orange::Citrus canker', 'citrus_orange::Citrus greening (HLB)', 'citrus_orange::Dieback', 'citrus_orange::Greasy spot', 'citrus_orange::Healthy', 'citrus_orange::Leaf miner (pest)', 'citrus_orange::Mealybug (pest)', 'citrus_orange::Mite damage', 'citrus_orange::Nutrient deficiency', 'citrus_orange::Powdery mildew', 'citrus_orange::Scale insect (pest)', 'citrus_orange::Shot hole', 'citrus_orange::Spiny whitefly (pest)', 'coconut::Bud root dropping', 'coconut::Bud rot', 'coconut::Grey leaf spot', 'coconut::Leaf rot', 'coconut::Stem bleeding', 'coffee::Cercospora leaf spot', 'coffee::Healthy', 'coffee::Leaf miner (pest)', 'coffee::Leaf rust', 'coffee::Phoma leaf spot', 'corn_maize::Common rust', 'corn_maize::Common smut', 'corn_maize::Curvularia leaf spot', 'corn_maize::Fall armyworm (pest)', 'corn_maize::Grasshopper (pest)', 'corn_maize::Gray leaf spot', 'corn_maize::Healthy', 'corn_maize::Leaf beetle (pest)', 'corn_maize::Northern leaf blight', 'cotton::Alternaria leaf spot', 'cotton::Bacterial blight', 'cotton::Fusarium wilt', 'cotton::Healthy', 'cotton::Herbicide damage', 'cotton::Leaf curl virus', 'cotton::Leaf reddening', 'cotton::Leaf variegation', 'cotton::Leafhopper / jassid (pest)', 'cotton::Verticillium wilt', 'cowpea::Bacterial wilt', 'cowpea::Healthy', 'cowpea::Mosaic virus', 'cowpea::Septoria leaf spot', 'cucumber::Angular leaf spot', 'cucumber::Anthracnose', 'cucumber::Bacterial wilt', 'cucumber::Belly rot (fruit)', 'cucumber::Downy mildew', 'cucumber::Gummy stem blight', 'cucumber::Healthy', 'cucumber::Powdery mildew', 'cucumber::Pythium fruit rot', 'custard_apple::Anthracnose', 'custard_apple::Black canker', 'custard_apple::Diplodia fruit rot', 'custard_apple::Fruit spot', 'custard_apple::Leaf spot', 'custard_apple::Mealybug (pest)', 'finger_millet_ragi::Downy mildew', 'finger_millet_ragi::Healthy', 'finger_millet_ragi::Mottle streak virus', 'finger_millet_ragi::Smut', 'finger_millet_ragi::Wilt', 'garlic::Healthy', 'garlic::Leaf blight', 'garlic::Rust', 'ginger::Healthy', 'ginger::Leaf spot', 'ginger::Sheath blight', 'grape::Bacterial leaf spot', 'grape::Black rot', 'grape::Downy mildew', 'grape::Esca (black measles)', 'grape::Healthy', 'grape::Isariopsis leaf spot', 'grape::Leafroll virus', 'grape::Powdery mildew', 'groundnut::Alternaria leaf spot', 'groundnut::Healthy', 'groundnut::Nutrient deficiency', 'groundnut::Rosette virus', 'groundnut::Rust', 'groundnut::Tikka leaf spot', 'guava::Anthracnose', 'guava::Canker', 'guava::Dot (algal spot)', 'guava::Fruit mummification', 'guava::Healthy', 'guava::Phytophthora fruit rot', 'guava::Red rust', 'guava::Scab', 'guava::Styler end rot', 'jamun::Bacterial spot', 'jamun::Brown blight', 'jamun::Dry leaf', 'jamun::Healthy', 'jamun::Powdery mildew', 'jamun::Sooty mould', 'jute::Dieback', 'jute::Healthy', 'jute::Mosaic virus', 'jute::Pest-holed leaf', 'jute::Stem rot', 'lemon::Anthracnose', 'lemon::Bacterial blight', 'lemon::Citrus canker', 'lemon::Dry leaf', 'lemon::Healthy', 'lemon::Leaf curl virus', 'lemon::Nutrient deficiency', 'lemon::Sooty mould', 'lemon::Spider mites (pest)', 'lentil::Ascochyta blight', 'lentil::Healthy', 'lentil::Powdery mildew', 'lentil::Rust', 'malabar_spinach::Anthracnose leaf spot', 'malabar_spinach::Healthy', 'malabar_spinach::Mite damage', 'mango::Anthracnose', 'mango::Bacterial canker', 'mango::Cutting weevil (pest)', 'mango::Die back', 'mango::Gall midge (pest)', 'mango::Healthy', 'mango::Powdery mildew', 'mango::Sooty mould', 'moringa::Bacterial leaf spot', 'moringa::Cercospora leaf spot', 'moringa::Healthy', 'moringa::Yellowing leaf', 'okra::Alternaria leaf spot', 'okra::Cercospora leaf spot', 'okra::Downy mildew', 'okra::Healthy', 'okra::Leaf curl virus', 'okra::Phyllosticta leaf spot', 'okra::Yellow vein mosaic virus', 'onion::Botrytis leaf blight', 'onion::Caterpillar (pest)', 'onion::Downy mildew', 'onion::Fusarium basal rot', 'onion::Healthy', 'onion::Iris yellow spot virus', 'onion::Purple blotch', 'onion::Rust', 'onion::Stemphylium / Colletotrichum blight', 'onion::Xanthomonas leaf blight', 'papaya::Anthracnose', 'papaya::Bacterial spot', 'papaya::Healthy', 'papaya::Leaf curl virus', 'papaya::Mealybug (pest)', 'papaya::Mite damage', 'papaya::Mosaic virus', 'papaya::Ring spot virus', 'peach::Bacterial spot', 'peach::Brown rot', 'peach::Healthy', 'peach::Leaf curl', 'peach::Scab', 'pomegranate::Alternaria fruit spot', 'pomegranate::Anthracnose', 'pomegranate::Bacterial blight (oily spot)', 'pomegranate::Cercospora fruit spot', 'pomegranate::Fruit borer (pest)', 'pomegranate::Healthy', 'pomegranate::Sunburn', 'potato::Early blight', 'potato::Healthy', 'potato::Insect pest damage', 'potato::Late blight', 'potato::Virus disease', 'pumpkin::Bacterial leaf spot', 'pumpkin::Downy mildew', 'pumpkin::Healthy', 'pumpkin::Mosaic virus', 'pumpkin::Powdery mildew', 'radish::Black leaf spot', 'radish::Downy mildew', 'radish::Flea beetle (pest)', 'radish::Healthy', 'radish::Mosaic virus', 'raspberry::Healthy', 'rice::Bacterial leaf blight', 'rice::Bacterial leaf streak', 'rice::Bacterial panicle blight', 'rice::Blast', 'rice::Brown spot', 'rice::Dead heart (stem borer)', 'rice::Downy mildew', 'rice::Healthy', 'rice::Hispa (pest)', 'rice::Leaf folder (pest)', 'rice::Leaf scald', 'rice::Sheath blight', 'rice::Tungro', 'soybean::Bacterial blight', 'soybean::Downy mildew', 'soybean::Dry leaf', 'soybean::Frogeye leaf spot', 'soybean::Healthy', 'soybean::Mosaic virus', 'soybean::Rust', 'soybean::Semilooper caterpillar (pest)', 'soybean::Septoria brown spot', 'soybean::Vein necrosis', 'spinach::Anthracnose', 'spinach::Bacterial spot', 'spinach::Downy mildew', 'spinach::Healthy', 'spinach::Insect pest damage', 'squash::Healthy', 'squash::Powdery mildew', 'strawberry::Anthracnose', 'strawberry::Healthy', 'strawberry::Leaf scorch', 'sugarcane::Banded chlorosis', 'sugarcane::Brown spot', 'sugarcane::Dried leaf', 'sugarcane::Grassy shoot', 'sugarcane::Healthy', 'sugarcane::Mosaic virus', 'sugarcane::Pokkah boeng', 'sugarcane::Red rot', 'sugarcane::Rust', 'sugarcane::Sett rot', 'sugarcane::Smut', 'sugarcane::Yellow leaf disease', 'sunflower::Downy mildew', 'sunflower::Gray mold', 'sunflower::Healthy', 'sunflower::Leaf scars', 'tea::Algal leaf spot', 'tea::Blister blight', 'tea::Brown blight', 'tea::Gray blight', 'tea::Green mirid bug (pest)', 'tea::Healthy', 'tea::Red leaf spot', 'tea::Red rust (algal)', 'tea::Red spider mite (pest)', 'tea::Tea mosquito bug (helopeltis)', 'tobacco::Brown spot', 'tobacco::Healthy', 'tobacco::Mosaic virus', 'tomato::Bacterial spot', 'tomato::Blossom end rot', 'tomato::Early blight', 'tomato::Fruit borer (pest)', 'tomato::Healthy', 'tomato::Late blight', 'tomato::Leaf miner (pest)', 'tomato::Leaf mold', 'tomato::Magnesium deficiency', 'tomato::Mosaic virus', 'tomato::Nitrogen deficiency', 'tomato::Potassium deficiency', 'tomato::Septoria leaf spot', 'tomato::Spider mites (pest)', 'tomato::Spotted wilt virus', 'tomato::Sunscald', 'tomato::Target spot', 'tomato::Yellow leaf curl virus', 'turmeric::Aphid (pest)', 'turmeric::Dry leaf', 'turmeric::Healthy', 'turmeric::Healthy rhizome', 'turmeric::Leaf blotch', 'turmeric::Leaf spot', 'turmeric::Rhizome rot', 'watermelon::Anthracnose', 'watermelon::Downy mildew', 'watermelon::Healthy', 'watermelon::Mosaic virus', 'wheat::Aphid (pest)', 'wheat::Bacterial leaf streak', 'wheat::Black (stem) rust', 'wheat::Blast', 'wheat::Brown (leaf) rust', 'wheat::Common root rot', 'wheat::Fusarium head blight', 'wheat::Healthy', 'wheat::Leaf blight', 'wheat::Mite (pest)', 'wheat::Powdery mildew', 'wheat::Septoria blotch', 'wheat::Smut', 'wheat::Stem fly (pest)', 'wheat::Tan spot', 'wheat::Yellow (stripe) rust']

# Build crop → [indices] mapping for crop-conditioned inference
CROP_CLASS_INDICES: Dict[str, List[int]] = {}
for _i, _label in enumerate(INDIA_CLASSES):
    _crop = _label.split("::")[0]
    CROP_CLASS_INDICES.setdefault(_crop, []).append(_i)

# Human-readable crop names
CROP_DISPLAY_NAMES: Dict[str, str] = {
    "apple": "Apple", "ash_gourd": "Ash Gourd", "banana": "Banana",
    "bean": "Bean", "bell_pepper": "Bell Pepper (Capsicum)", "betel": "Betel",
    "bitter_gourd": "Bitter Gourd (Karela)", "black_gram": "Black Gram (Urad Dal)",
    "blueberry": "Blueberry", "bottle_gourd": "Bottle Gourd (Lauki)",
    "brinjal_eggplant": "Brinjal / Eggplant (Baingan)", "cabbage": "Cabbage",
    "cashew": "Cashew", "cauliflower": "Cauliflower", "cherry": "Cherry",
    "chilli": "Chilli", "citrus_orange": "Citrus / Orange",
    "coconut": "Coconut", "corn_maize": "Corn / Maize (Makka)",
    "cotton": "Cotton (Kapas)", "cucumber": "Cucumber", "garlic": "Garlic",
    "ginger": "Ginger", "grape": "Grape", "groundnut": "Groundnut (Mungfali)",
    "guava": "Guava (Amrood)", "jute": "Jute", "lemon": "Lemon (Nimbu)",
    "maize": "Maize (Makka)", "mango": "Mango (Aam)", "moringa": "Moringa (Drumstick)",
    "okra": "Okra (Bhindi)", "onion": "Onion (Pyaaz)", "papaya": "Papaya",
    "peach": "Peach", "pea": "Pea (Matar)", "pomegranate": "Pomegranate (Anar)",
    "potato": "Potato (Aloo)", "pumpkin": "Pumpkin (Kaddu)", "radish": "Radish (Mooli)",
    "rice": "Rice (Paddy / Dhan)", "ridge_gourd": "Ridge Gourd (Turai)",
    "rubber": "Rubber", "soybean": "Soybean", "strawberry": "Strawberry",
    "sugarcane": "Sugarcane (Ganna)", "sunflower": "Sunflower",
    "tea": "Tea (Assam / Darjeeling)", "tomato": "Tomato (Tamatar)",
    "turmeric": "Turmeric (Haldi)", "watermelon": "Watermelon (Tarbooz)",
    "wheat": "Wheat (Gehun)",
}

# Alias map: user-supplied crop hints → internal crop keys
CROP_HINT_MAP: Dict[str, str] = {
    # tomato
    "tomato": "tomato", "tamatar": "tomato",
    # potato
    "potato": "potato", "aloo": "potato",
    # rice
    "rice": "rice", "paddy": "rice", "dhan": "rice",
    # wheat
    "wheat": "wheat", "gehun": "wheat",
    # maize / corn
    "maize": "corn_maize", "corn": "corn_maize", "corn_maize": "corn_maize", "makka": "corn_maize",
    # onion
    "onion": "onion", "pyaaz": "onion",
    # brinjal
    "brinjal": "brinjal_eggplant", "eggplant": "brinjal_eggplant",
    "baingan": "brinjal_eggplant", "brinjal_eggplant": "brinjal_eggplant",
    # bell pepper
    "bell_pepper": "bell_pepper", "capsicum": "bell_pepper", "pepper": "bell_pepper",
    # chilli
    "chilli": "chilli", "chilly": "chilli", "mirch": "chilli",
    # okra
    "okra": "okra", "bhindi": "okra",
    # cotton
    "cotton": "cotton", "kapas": "cotton",
    # sugarcane
    "sugarcane": "sugarcane", "ganna": "sugarcane",
    # mango
    "mango": "mango", "aam": "mango",
    # banana
    "banana": "banana",
    # tea
    "tea": "tea",
    # soybean
    "soybean": "soybean", "soya": "soybean",
    # groundnut
    "groundnut": "groundnut", "peanut": "groundnut", "mungfali": "groundnut",
    # coconut
    "coconut": "coconut",
    # pomegranate
    "pomegranate": "pomegranate", "anar": "pomegranate",
    # apple
    "apple": "apple",
    # grape
    "grape": "grape",
}

# ──────────────────────────────────────────────────────────────────────────────
# Model path & auto-download
# ──────────────────────────────────────────────────────────────────────────────
_DEFAULT_MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "india-dinov2")
)
_ONNX_PATH = os.getenv(
    "AGRIBRIDGE_ONNX_MODEL_PATH",
    os.path.join(_DEFAULT_MODEL_DIR, "india_v1.onnx"),
)
_MODEL_ONNX_URL = "https://github.com/8ernity/AgriBridge/releases/download/models-v1/india_v1.onnx"
_ONNX_MIN_SIZE = 50_000_000  # 50 MB sanity floor


def _ensure_model() -> Optional[str]:
    """Download india_v1.onnx if not already cached. Returns path or None."""
    onnx_path = Path(_ONNX_PATH)
    if onnx_path.is_file() and onnx_path.stat().st_size >= _ONNX_MIN_SIZE:
        return str(onnx_path)

    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        logger.info("[AgriBridge] Downloading india_v1 ONNX model (~55 MB)…")
        req = urllib.request.Request(_MODEL_ONNX_URL, headers={"User-Agent": "AgriBridge/2"})
        with urllib.request.urlopen(req, timeout=300) as resp, open(onnx_path, "wb") as out_file:
            out_file.write(resp.read())
            
        logger.info("[AgriBridge] Downloaded india_v1.onnx → %s", onnx_path)
        if onnx_path.stat().st_size >= _ONNX_MIN_SIZE:
            return str(onnx_path)
    except Exception as exc:
        logger.warning("[AgriBridge] Model download failed (%s). Model unavailable.", exc)

    logger.error("[AgriBridge] Could not obtain india_v1.onnx. Inference disabled.")
    return None


_ort_session = None  # lazy-loaded singleton


def _get_onnx_session():
    """Lazily load (and if needed download) the india_v1 ONNX session."""
    global _ort_session
    if _ort_session is not None:
        return _ort_session

    model_path = _ensure_model()
    if model_path is None:
        return None

    try:
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        _ort_session = ort.InferenceSession(
            model_path, opts, providers=["CPUExecutionProvider"]
        )
        logger.info(
            "[AgriBridge] Loaded india_v1 DINOv2 ONNX model (%d classes) from %s",
            len(INDIA_CLASSES), model_path
        )
    except Exception as exc:
        logger.error("[AgriBridge] ONNX session init failed: %s", exc)
    return _ort_session


# ──────────────────────────────────────────────────────────────────────────────
# Inference configuration
# ──────────────────────────────────────────────────────────────────────────────
TEMPERATURE = 1.0          # DINOv2 calibration not needed; logits are well-scaled
CONFIDENCE_THRESHOLD = 0.50  # Lower than MobileNetV3 — DINOv2 is much better calibrated

# ──────────────────────────────────────────────────────────────────────────────
# Disease knowledge base — India-focused entries
# Keys use the INDIA_CLASSES format: "crop::condition"
# ──────────────────────────────────────────────────────────────────────────────
DISEASE_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    # ── TOMATO ────────────────────────────────────────────────────────────────
    "tomato::Early blight": {
        "crop": "Tomato", "disease_name": "Early Blight (Alternaria solani)",
        "local_names": {"hi": "अगेती झुलसा (टमाटर)", "bn": "আগেতি ধসা (টমেটো)"},
        "symptoms": {"en": [
            "Concentric-ring 'bullseye' dark brown spots on older lower leaves.",
            "Surrounding tissue turns chlorotic as lesions enlarge.",
            "Premature defoliation exposes developing tomatoes to sunscald.",
        ], "hi": [
            "निचली पत्तियों पर गहरे भूरे छल्लेदार बुलआई धब्बे।",
            "धब्बों के फैलने पर पत्ती पीली पड़ जाती है।",
        ], "bn": [
            "পুরনো নিচের পাতায় বৃত্তাকার রিং দাগ।",
        ]},
        "causes": {"en": [
            "Alternaria solani surviving in crop debris; warm humid weather (24–29 °C).",
        ]},
        "cultural_practices": {"en": [
            "Prune lowest 30 cm of foliage to improve airflow and prevent soil splash.",
            "Use drip irrigation; avoid overhead wetting.",
            "Rotate out of Solanaceae for 2–3 seasons.",
        ], "hi": [
            "निचली 30 सेमी पत्तियाँ हटाएं; ड्रिप सिंचाई करें; फसल चक्र अपनाएं।",
        ]},
        "chemical_warning": {"en": "Consult local KVK before applying copper fungicides.",
                             "hi": "नजदीकी KVK से परामर्श के बाद ही रासायनिक दवा प्रयोग करें।"},
        "sources": [{"source_id": "CABI-PW-001",
                     "title": "Tomato Early Blight Factsheet",
                     "publisher": "CABI Plantwise Knowledge Bank",
                     "license": "Open Access",
                     "passage_text": "Alternaria solani causes brown target spots. Sanitation and drip irrigation provide the first line of defense."}],
    },
    "tomato::Late blight": {
        "crop": "Tomato", "disease_name": "Late Blight (Phytophthora infestans)",
        "local_names": {"hi": "पछेती झुलसा (टमाटर)", "bn": "পাবতি ধসা (টমেটো)"},
        "symptoms": {"en": [
            "Large water-soaked dark brown-purple lesions on leaves; white sporulation on undersides.",
            "Foliage collapses rapidly under high humidity.",
        ], "hi": [
            "पत्तियों पर बड़े पानी से भीगे धब्बे जो बैंगनी-काले हो जाते हैं।",
        ]},
        "causes": {"en": ["Phytophthora infestans; cool humid weather (12–22 °C), >90% RH."]},
        "cultural_practices": {"en": [
            "Destroy infected foliage immediately; never compost.",
            "Plant certified blight-tolerant cultivars for monsoon seasons.",
        ]},
        "chemical_warning": {"en": "Late blight spreads rapidly. Report to your local agriculture extension (KVK) immediately.",
                             "hi": "तुरंत कृषि विज्ञान केंद्र या KVK से संपर्क करें।"},
        "sources": [{"source_id": "CABI-PW-002", "title": "Phytophthora infestans Diagnostic Sheet",
                     "publisher": "CABI Plantwise Knowledge Bank", "license": "Open Access",
                     "passage_text": "Late blight requires community-level sanitation and resistant seed."}],
    },
    "tomato::Bacterial spot": {
        "crop": "Tomato", "disease_name": "Bacterial Spot (Xanthomonas)",
        "local_names": {"hi": "टमाटर का जीवाणु धब्बा", "bn": "টমেটোর ব্যাকটেরিয়াল স্পট"},
        "symptoms": {"en": ["Small water-soaked lesions turning dark brown on leaves and fruit."]},
        "causes": {"en": ["Xanthomonas campestris pv. vesicatoria; spread by rain splash and infected seed."]},
        "cultural_practices": {"en": ["Use certified disease-free seed; avoid overhead irrigation."]},
        "chemical_warning": {"en": "Copper bactericides have limited efficacy. Consult an agronomist."},
        "sources": [],
    },
    "tomato::Leaf mold": {
        "crop": "Tomato", "disease_name": "Leaf Mold (Cladosporium fulvum)",
        "local_names": {"hi": "टमाटर का पत्ती फफूंद", "bn": "টমেটো লিফ মোল্ড"},
        "symptoms": {"en": ["Yellow patches on upper leaf surface; velvety olive-green mold on underside."]},
        "causes": {"en": ["Cladosporium fulvum; favored by high humidity in protected or dense plantings."]},
        "cultural_practices": {"en": ["Improve greenhouse ventilation; reduce leaf wetness."]},
        "chemical_warning": {"en": "Consult extension before applying fungicides."},
        "sources": [],
    },
    "tomato::Septoria leaf spot": {
        "crop": "Tomato", "disease_name": "Septoria Leaf Spot (Septoria lycopersici)",
        "local_names": {"hi": "सेप्टोरिया पत्ती धब्बा", "bn": "সেপ্টোরিয়া লিফ স্পট"},
        "symptoms": {"en": ["Circular spots with grey centers and dark margins; spreads upward from base."]},
        "causes": {"en": ["Septoria lycopersici fungus; favored by warm wet weather."]},
        "cultural_practices": {"en": ["Remove infected lower leaves; avoid overhead watering."]},
        "chemical_warning": {"en": "Consult local KVK before chemical treatment."},
        "sources": [],
    },
    "tomato::Mosaic virus": {
        "crop": "Tomato", "disease_name": "Tomato Mosaic Virus (ToMV)",
        "local_names": {"hi": "टमाटर मोज़ेक वायरस", "bn": "টমেটো মোজাইক ভাইরাস"},
        "symptoms": {"en": ["Mottled yellow-green mosaic on leaves; distorted fruit; stunted growth."]},
        "causes": {"en": ["Tobacco/Tomato mosaic virus; transmitted via infected tools, hands, seed."]},
        "cultural_practices": {"en": ["Use virus-free seed; sanitize tools with 10% bleach between plants."]},
        "chemical_warning": {"en": "No curative chemical available. Control aphid vectors with recommended insecticides."},
        "sources": [],
    },
    "tomato::Yellow leaf curl virus": {
        "crop": "Tomato", "disease_name": "Yellow Leaf Curl Virus (TYLCV)",
        "local_names": {"hi": "टमाटर पीला पत्ती कर्ल वायरस", "bn": "টমেটো হলুদ পাতা কুঁকড়ানো ভাইরাস"},
        "symptoms": {"en": [
            "Upward curling and yellowing of leaves; stunted plants; flower drop.",
            "Severely infected plants produce no marketable fruit.",
        ], "hi": ["पत्तियों का ऊपर की ओर मुड़ना और पीला पड़ना; बौने पौधे।"]},
        "causes": {"en": ["Begomovirus transmitted by whitefly (Bemisia tabaci)."]},
        "cultural_practices": {"en": [
            "Use reflective silver mulch to deter whiteflies.",
            "Plant resistant varieties (e.g., Arka Rakshak, Arka Samrat).",
            "Install fine insect-proof nets in nurseries.",
        ], "hi": [
            "सिल्वर मल्च का उपयोग करें; सफेद मक्खी से बचाव करें।",
            "प्रतिरोधी किस्में जैसे अर्का रक्षक लगाएं।",
        ]},
        "chemical_warning": {"en": "No cure for infected plants. Focus on whitefly vector control. Consult KVK.",
                             "hi": "संक्रमित पौधों को हटाएं; सफेद मक्खी नियंत्रण के लिए KVK से सलाह लें।"},
        "sources": [{"source_id": "ICAR-DPR-01", "title": "TYLCV Management Bulletin",
                     "publisher": "ICAR-NCIPM", "license": "Open Access",
                     "passage_text": "TYLCV is a major constraint in Indian tomato belts. Resistant cultivars and whitefly control are the primary management pillars."}],
    },
    "tomato::Spider mites (two-spotted)": {
        "crop": "Tomato", "disease_name": "Two-Spotted Spider Mite (Tetranychus urticae)",
        "local_names": {"hi": "दो-धब्बेदार मकड़ी माइट", "bn": "দুই-ফোঁটা মাকড়সা মাইট"},
        "symptoms": {"en": ["Stippled yellowing on leaves; fine webbing on underside; mites visible under magnification."]},
        "causes": {"en": ["Tetranychus urticae; worse under hot dry conditions."]},
        "cultural_practices": {"en": ["Maintain adequate humidity; introduce predatory mites; avoid broad-spectrum pesticides that kill natural enemies."]},
        "chemical_warning": {"en": "Miticides require resistance rotation. Consult extension before use."},
        "sources": [],
    },
    "tomato::Target spot": {
        "crop": "Tomato", "disease_name": "Target Spot (Corynespora cassiicola)",
        "local_names": {"hi": "टारगेट स्पॉट"},
        "symptoms": {"en": ["Dark brown circular spots with concentric rings resembling a target."]},
        "causes": {"en": ["Corynespora cassiicola; favored by warm wet conditions."]},
        "cultural_practices": {"en": ["Improve air circulation; avoid overhead irrigation."]},
        "chemical_warning": {"en": "Consult KVK for appropriate fungicide recommendations."},
        "sources": [],
    },
    "tomato::Healthy": {
        "crop": "Tomato", "disease_name": "Healthy Tomato",
        "local_names": {"hi": "स्वस्थ टमाटर", "bn": "সুস্থ টমেটো"},
        "symptoms": {"en": ["Uniform deep green foliage; no spots, curl, or chlorosis."]},
        "causes": {"en": ["Balanced nutrients, adequate water, clean seed."]},
        "cultural_practices": {"en": ["Continue organic mulching and drip irrigation."]},
        "chemical_warning": {"en": "No chemical intervention needed."},
        "sources": [],
    },

    # ── POTATO ────────────────────────────────────────────────────────────────
    "potato::Early blight": {
        "crop": "Potato", "disease_name": "Potato Early Blight (Alternaria solani)",
        "local_names": {"hi": "अगेती झुलसा (आलू)", "bn": "আগেতি ধসা (আলু)"},
        "symptoms": {"en": ["Brown-black target spots on lower foliage; lower canopy yellowing; sunken corky lesions on tubers."]},
        "causes": {"en": ["Alternaria solani in soil residues; warm weather (24–29 °C)."]},
        "cultural_practices": {"en": [
            "Hill up soil around tubers to prevent spore wash.",
            "Harvest only in dry conditions after skins have set.",
        ]},
        "chemical_warning": {"en": "Rotate fungicide classes to prevent resistance. Contact extension before use.",
                             "hi": "KVK से परामर्श के बाद ही दवा का प्रयोग करें।"},
        "sources": [{"source_id": "ICAR-CPRI-02", "title": "Potato Disease Management in Subtropical Plains",
                     "publisher": "ICAR-CPRI", "license": "ICAR Open Access",
                     "passage_text": "Adequate potassium reduces potato susceptibility to early blight."}],
    },
    "potato::Late blight": {
        "crop": "Potato", "disease_name": "Potato Late Blight (Phytophthora infestans)",
        "local_names": {"hi": "पछेती झुलसा (आलू)", "bn": "পাবতি ধসা (আলু)"},
        "symptoms": {"en": ["Water-soaked dark lesions spreading rapidly across leaf tips and stems; foul odor in heavy infections."]},
        "causes": {"en": ["Phytophthora infestans via infected seed tubers and wind-blown rain."]},
        "cultural_practices": {"en": ["Plant only certified disease-free seed tubers.", "Deep earthing-up protects tubers."]},
        "chemical_warning": {"en": "Can destroy a crop in 7–10 days under humid conditions. Contact extension agent immediately.",
                             "hi": "नम मौसम में 7-10 दिन में फसल नष्ट हो सकती है। तुरंत कृषि अधिकारी से संपर्क करें।"},
        "sources": [{"source_id": "ICAR-CPRI-LB-01", "title": "Integrated Late Blight Management in Potato",
                     "publisher": "ICAR-CPRI Shimla", "license": "ICAR Open Access",
                     "passage_text": "Plant certified Kufri Pukhraj or Kufri Jyoti seed tubers and destroy volunteer plants."}],
    },
    "potato::Healthy": {
        "crop": "Potato", "disease_name": "Healthy Potato",
        "local_names": {"hi": "स्वस्थ आलू", "bn": "সুস্থ আলু"},
        "symptoms": {"en": ["Uniform emerald leaves with vigorous growth."]},
        "causes": {"en": ["Adequate nitrogen, clean seed, optimal soil."]},
        "cultural_practices": {"en": ["Keep ridges weed-free; monitor for aphid vectors."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── RICE ──────────────────────────────────────────────────────────────────
    "rice::Leaf blast": {
        "crop": "Rice (Paddy)", "disease_name": "Rice Leaf Blast (Magnaporthe oryzae)",
        "local_names": {"hi": "धान का ब्लास्ट (पत्ती)", "bn": "ধানের লিফ ব্লাস্ট"},
        "symptoms": {"en": [
            "Diamond-shaped or spindle lesions with gray centers and brown borders on leaves.",
            "Lesions coalesce, causing complete leaf death in severe cases.",
        ], "hi": ["पत्तियों पर हीरे के आकार के धब्बे जो ग्रे केंद्र और भूरे किनारों वाले होते हैं।"]},
        "causes": {"en": ["Magnaporthe oryzae; favored by high humidity, excessive nitrogen, and dense canopies."]},
        "cultural_practices": {"en": [
            "Avoid excessive nitrogen — split applications reduce blast risk.",
            "Maintain adequate spacing and avoid waterlogging.",
            "Use resistant varieties (IR 64, Pusa Basmati 1, Swarna Sub1).",
        ], "hi": [
            "नाइट्रोजन की अधिकता से बचें; प्रतिरोधी किस्में लगाएं।",
        ]},
        "chemical_warning": {"en": "Apply Tricyclazole or Isoprothiolane at first sign of disease. Consult local KVK for timing.",
                             "hi": "रोग के पहले लक्षण दिखते ही ट्राईसाइक्लाजोल या आइसोप्रोथियोलेन का प्रयोग करें। KVK से परामर्श लें।"},
        "sources": [{"source_id": "ICAR-DRR-01", "title": "Rice Blast Management Manual",
                     "publisher": "ICAR-DRR Hyderabad", "license": "ICAR Open Access",
                     "passage_text": "Balanced nitrogen application and resistant varieties are the primary tools against Magnaporthe oryzae in Indian paddy systems."}],
    },
    "rice::Neck blast": {
        "crop": "Rice (Paddy)", "disease_name": "Rice Neck Blast (Magnaporthe oryzae)",
        "local_names": {"hi": "धान का गर्दन ब्लास्ट", "bn": "ধানের নেক ব্লাস্ট"},
        "symptoms": {"en": ["Brown-black lesion at panicle neck; panicles turn white and fail to fill."]},
        "causes": {"en": ["Same pathogen as leaf blast; infection at flowering stage is most damaging."]},
        "cultural_practices": {"en": ["Protect panicle neck during booting/heading stage with fungicide."]},
        "chemical_warning": {"en": "Critical to spray at booting stage. Missed timing causes near-total yield loss. Consult KVK.",
                             "hi": "बूटिंग अवस्था में छिड़काव ज़रूरी है। समय चूकने पर उपज पूरी तरह नष्ट हो सकती है।"},
        "sources": [],
    },
    "rice::Bacterial blight": {
        "crop": "Rice (Paddy)", "disease_name": "Bacterial Leaf Blight (Xanthomonas oryzae)",
        "local_names": {"hi": "धान का जीवाणु झुलसा", "bn": "ধানের ব্যাকটেরিয়াল ব্লাইট"},
        "symptoms": {"en": [
            "Water-soaked to yellowish stripes on leaf margins; leaves dry out.",
            "'Kresek' phase: young plants wilt and die.",
        ], "hi": ["पत्तियों के किनारों पर पानी से भीगे पीले धब्बे जो सूखकर भूरे हो जाते हैं।"]},
        "causes": {"en": ["Xanthomonas oryzae pv. oryzae; enters through wounds and stomata; waterlogged fields aid spread."]},
        "cultural_practices": {"en": [
            "Drain standing water; avoid excessive nitrogen.",
            "Use resistant varieties (Pusa Basmati 6, IR 36, Samba Mahsuri).",
        ]},
        "chemical_warning": {"en": "Copper oxychloride has limited effect. No curative bactericide available — prevention via resistant varieties is key.",
                             "hi": "रोग के बाद इलाज सीमित है। प्रतिरोधी किस्में सबसे कारगर उपाय हैं।"},
        "sources": [],
    },
    "rice::Brown spot": {
        "crop": "Rice (Paddy)", "disease_name": "Brown Spot (Helminthosporium oryzae)",
        "local_names": {"hi": "धान का भूरा धब्बा", "bn": "ধানের ব্রাউন স্পট"},
        "symptoms": {"en": ["Oval brown spots with white or grey centers; severe infection causes seedling blight."]},
        "causes": {"en": ["Helminthosporium oryzae; linked to nutrient deficiency, poor soils."]},
        "cultural_practices": {"en": ["Apply potassium and zinc fertilizers; use clean certified seed."]},
        "chemical_warning": {"en": "Seed treatment with Thiram or Bavistin reduces nursery losses."},
        "sources": [],
    },
    "rice::Sheath blight": {
        "crop": "Rice (Paddy)", "disease_name": "Sheath Blight (Rhizoctonia solani)",
        "local_names": {"hi": "धान का शीथ ब्लाइट", "bn": "ধানের শিথ ব্লাইট"},
        "symptoms": {"en": ["Irregular water-soaked lesions on leaf sheaths; white mycelia and sclerotia visible."]},
        "causes": {"en": ["Rhizoctonia solani; severe under dense canopies and high nitrogen."]},
        "cultural_practices": {"en": ["Reduce plant density; avoid lodging; moderate nitrogen use."]},
        "chemical_warning": {"en": "Hexaconazole or Propiconazole sprays at initial infection stage. Consult KVK."},
        "sources": [],
    },
    "rice::Healthy": {
        "crop": "Rice (Paddy)", "disease_name": "Healthy Rice",
        "local_names": {"hi": "स्वस्थ धान", "bn": "সুস্থ ধান"},
        "symptoms": {"en": ["Upright green tillers; no lesions or wilting."]},
        "causes": {"en": ["Balanced soil nutrients, good water management."]},
        "cultural_practices": {"en": ["Maintain alternate wetting and drying (AWD) irrigation for water efficiency."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── WHEAT ─────────────────────────────────────────────────────────────────
    "wheat::Yellow rust": {
        "crop": "Wheat", "disease_name": "Yellow / Stripe Rust (Puccinia striiformis)",
        "local_names": {"hi": "गेहूं का पीला रतुआ", "bn": "গমের হলুদ মরিচা"},
        "symptoms": {"en": [
            "Bright yellow powdery stripes parallel to leaf veins.",
            "Pustules appear on leaves and glumes; severe infection causes complete yield loss.",
        ], "hi": ["पत्तियों पर पीले पाउडर की धारियाँ जो नसों के समानांतर होती हैं।"]},
        "causes": {"en": ["Puccinia striiformis; cool temperatures (5–15 °C) and high humidity; windborne spores travel 1000+ km."]},
        "cultural_practices": {"en": [
            "Plant resistant varieties (HD 3086, WH 1105, K 0307).",
            "Early sowing avoids peak infection period.",
        ], "hi": [
            "प्रतिरोधी किस्में जैसे HD 3086, WH 1105 लगाएं; जल्दी बुवाई करें।",
        ]},
        "chemical_warning": {"en": "Apply Propiconazole 25EC at flag leaf stage on susceptible varieties. Consult extension.",
                             "hi": "ध्वज पत्ती अवस्था में प्रोपीकोनाज़ोल का छिड़काव करें। KVK से परामर्श लें।"},
        "sources": [{"source_id": "ICAR-IIWBR-01", "title": "Wheat Rust Management Bulletin",
                     "publisher": "ICAR-IIWBR Karnal", "license": "ICAR Open Access",
                     "passage_text": "Yellow rust epidemic surveillance in India is run by NBPGR and IIWBR; early detection is critical."}],
    },
    "wheat::Brown rust": {
        "crop": "Wheat", "disease_name": "Brown / Leaf Rust (Puccinia triticina)",
        "local_names": {"hi": "गेहूं का भूरा रतुआ", "bn": "গমের বাদামী মরিচা"},
        "symptoms": {"en": ["Orange-brown pustules randomly distributed on upper leaf surface."]},
        "causes": {"en": ["Puccinia triticina; warmer than yellow rust; peak in February–March in North India."]},
        "cultural_practices": {"en": ["Grow resistant varieties; practice timely sowing before 25 Nov in plains."]},
        "chemical_warning": {"en": "Propiconazole or Tebuconazole sprays effective if applied early."},
        "sources": [],
    },
    "wheat::Powdery mildew": {
        "crop": "Wheat", "disease_name": "Powdery Mildew (Blumeria graminis)",
        "local_names": {"hi": "गेहूं का चूर्णिल फफूंद", "bn": "গমের পাউডারি মিলডিউ"},
        "symptoms": {"en": ["White powdery patches on leaves and sheaths; severe under humid cool weather."]},
        "causes": {"en": ["Blumeria graminis; high humidity and moderate temperatures."]},
        "cultural_practices": {"en": ["Resistant varieties (HD 2967, WH 542); avoid dense sowing."]},
        "chemical_warning": {"en": "Sulfur-based fungicides effective. Consult KVK for dosage."},
        "sources": [],
    },
    "wheat::Loose smut": {
        "crop": "Wheat", "disease_name": "Loose Smut (Ustilago tritici)",
        "local_names": {"hi": "गेहूं का खुला कंडवा", "bn": "গমের লুজ স্মাট"},
        "symptoms": {"en": ["Ears entirely replaced by black sooty spore masses; dispersed by wind at flowering."]},
        "causes": {"en": ["Seed-borne Ustilago tritici; infects developing seed embryo."]},
        "cultural_practices": {"en": ["Use certified smut-free seed; hot water seed treatment at 52 °C for 10 min."]},
        "chemical_warning": {"en": "Systemic seed treatment with Carboxin + Thiram is highly effective."},
        "sources": [],
    },
    "wheat::Septoria leaf blotch": {
        "crop": "Wheat", "disease_name": "Septoria Leaf Blotch (Zymoseptoria tritici)",
        "local_names": {"hi": "गेहूं का सेप्टोरिया धब्बा"},
        "symptoms": {"en": ["Irregular pale green-yellow blotches with dark pycnidia on leaves; flag leaf infection most damaging."]},
        "causes": {"en": ["Zymoseptoria tritici; cool wet weather in North-East and hilly areas."]},
        "cultural_practices": {"en": ["Crop rotation; resistant varieties; remove crop residues."]},
        "chemical_warning": {"en": "Apply Propiconazole at early flag leaf stage. Consult extension."},
        "sources": [],
    },
    "wheat::Healthy": {
        "crop": "Wheat", "disease_name": "Healthy Wheat",
        "local_names": {"hi": "स्वस्थ गेहूं", "bn": "সুস্থ গম"},
        "symptoms": {"en": ["Upright green tillers, firm culms, no pustules or mold."]},
        "causes": {"en": ["Adequate phosphorus, zinc, good soil structure."]},
        "cultural_practices": {"en": ["Continue balanced fertilization; monitor for rust at flag-leaf stage."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── CORN / MAIZE ──────────────────────────────────────────────────────────
    "corn_maize::Common rust": {
        "crop": "Maize", "disease_name": "Common Rust (Puccinia sorghi)",
        "local_names": {"hi": "मक्के का रतुआ", "bn": "ভুট্টার মরিচা"},
        "symptoms": {"en": ["Cinnamon-brown powdery pustules on both leaf surfaces; rupture to release airborne spores."]},
        "causes": {"en": ["Puccinia sorghi; cool-moderate temperatures (16–25 °C), high humidity."]},
        "cultural_practices": {"en": ["Plant resistant hybrids; avoid late planting."]},
        "chemical_warning": {"en": "Chemical fungicides rarely cost-effective for smallholders. Consult extension."},
        "sources": [],
    },
    "corn_maize::Common smut": {
        "crop": "Maize", "disease_name": "Common Smut (Ustilago maydis)",
        "local_names": {"hi": "मक्के का कंडवा", "bn": "ভুট্টার কমন স্মাট"},
        "symptoms": {"en": [
            "Large silver-white galls on ears, tassels, and stalks; galls rupture releasing black powdery spores.",
        ], "hi": ["भुट्टे, तने और पुंकेसर पर बड़े चांदी जैसे गोले जो फटकर काला बीजाणु छोड़ते हैं।"]},
        "causes": {"en": ["Ustilago maydis; soil and airborne; worsened by wounding, drought stress."]},
        "cultural_practices": {"en": [
            "Remove and destroy galls before they rupture.",
            "Rotate crops; avoid mechanical damage during cultivation.",
        ]},
        "chemical_warning": {"en": "No effective chemical control post-infection. Preventive seed treatment and resistant hybrids are the best options."},
        "sources": [],
    },
    "corn_maize::Fall armyworm (pest)": {
        "crop": "Maize", "disease_name": "Fall Armyworm Pest (Spodoptera frugiperda)",
        "local_names": {"hi": "फॉल आर्मीवर्म (मक्का)", "bn": "ফল আর্মিওয়ার্ম (ভুট্টা)"},
        "symptoms": {"en": [
            "Ragged windows in leaves; large caterpillars with characteristic inverted Y-mark on head.",
            "Fresh sawdust-like frass in leaf whorls; severe whorl damage.",
        ], "hi": [
            "पत्तियों की मध्य नली में ताजा बुरादे जैसी विष्ठा; पत्तियों पर अनियमित छेद।",
            "शीर्ष पर Y-आकार का चिह्न वाला बड़ा लार्वा।",
        ]},
        "causes": {"en": ["Spodoptera frugiperda (invasive pest since 2018 in India); moths lay eggs in whorls."]},
        "cultural_practices": {"en": [
            "Apply sand + lime mixture in whorls as physical control.",
            "Release egg parasitoids (Telenomus remus) as biological control.",
            "Monitor pheromone traps weekly.",
        ], "hi": [
            "बालू + चूने का मिश्रण पत्ती की नली में डालें।",
            "फेरोमोन ट्रैप से निगरानी करें।",
        ]},
        "chemical_warning": {"en": "Apply Chlorantraniliprole (Coragen) or Emamectin Benzoate to whorls at first instar stage. Contact local KVK.",
                             "hi": "पहली अवस्था में Coragen या एमामेक्टिन बेंजोएट का प्रयोग करें। KVK से परामर्श लें।"},
        "sources": [{"source_id": "ICAR-NCIPM-01", "title": "Fall Armyworm Management in India",
                     "publisher": "ICAR-NCIPM", "license": "ICAR Open Access",
                     "passage_text": "FAW is best managed through an IPM approach combining pheromone traps, biological control and judicious insecticide use at early larval stage."}],
    },
    "corn_maize::Northern leaf blight": {
        "crop": "Maize", "disease_name": "Northern Leaf Blight (Exserohilum turcicum)",
        "local_names": {"hi": "मक्के का उत्तरी पत्ती झुलसा", "bn": "ভুট্টার নর্দার্ন লিফ ব্লাইট"},
        "symptoms": {"en": ["Long, cigar-shaped tan-grey lesions 5–15 cm long on leaves; premature senescence."]},
        "causes": {"en": ["Exserohilum turcicum; cool moist weather favors infection."]},
        "cultural_practices": {"en": ["Resistant hybrids; crop rotation; residue management."]},
        "chemical_warning": {"en": "Mancozeb or Propiconazole at early disease stage. Consult extension."},
        "sources": [],
    },
    "corn_maize::Blight (Turcicum)": {
        "crop": "Maize", "disease_name": "Turcicum Leaf Blight (Exserohilum turcicum)",
        "local_names": {"hi": "टर्सिकम पत्ती झुलसा"},
        "symptoms": {"en": ["Similar to Northern leaf blight — cigar-shaped lesions on upper canopy."]},
        "causes": {"en": ["Exserohilum turcicum; humid conditions."]},
        "cultural_practices": {"en": ["Resistant hybrids; avoid dense planting."]},
        "chemical_warning": {"en": "Consult extension for fungicide timing."},
        "sources": [],
    },
    "corn_maize::Healthy": {
        "crop": "Maize", "disease_name": "Healthy Maize",
        "local_names": {"hi": "स्वस्थ मक्का", "bn": "সুস্থ ভুট্টা"},
        "symptoms": {"en": ["Uniform deep green arching leaves; no pustules or lesions."]},
        "causes": {"en": ["Balanced soil nitrogen, full sunlight."]},
        "cultural_practices": {"en": ["Side-dress compost at knee-high stage."]},
        "chemical_warning": {"en": "No intervention required."},
        "sources": [],
    },
    # maize aliases map to same entries
    "maize::Common rust": {
        "crop": "Maize", "disease_name": "Common Rust (Puccinia sorghi)",
        "local_names": {"hi": "मक्के का रतुआ"},
        "symptoms": {"en": ["Cinnamon-brown powdery pustules on both leaf surfaces."]},
        "causes": {"en": ["Puccinia sorghi."]},
        "cultural_practices": {"en": ["Plant resistant hybrids."]},
        "chemical_warning": {"en": "Consult extension."},
        "sources": [],
    },
    "maize::Common smut": {
        "crop": "Maize", "disease_name": "Common Smut (Ustilago maydis)",
        "local_names": {"hi": "मक्के का कंडवा"},
        "symptoms": {"en": ["Silver-white galls on ears and tassels; rupture releasing black spores."]},
        "causes": {"en": ["Ustilago maydis."]},
        "cultural_practices": {"en": ["Remove galls before they rupture."]},
        "chemical_warning": {"en": "No effective post-infection chemical."},
        "sources": [],
    },
    "maize::Fall armyworm (pest)": {
        "crop": "Maize", "disease_name": "Fall Armyworm Pest (Spodoptera frugiperda)",
        "local_names": {"hi": "फॉल आर्मीवर्म"},
        "symptoms": {"en": ["Ragged holes in leaves; sawdust-like frass in whorls."]},
        "causes": {"en": ["Spodoptera frugiperda."]},
        "cultural_practices": {"en": ["Sand+lime mixture in whorls; pheromone traps; Telenomus remus."]},
        "chemical_warning": {"en": "Apply Coragen at first instar. Contact KVK."},
        "sources": [],
    },
    "maize::Healthy": {
        "crop": "Maize", "disease_name": "Healthy Maize",
        "local_names": {"hi": "स्वस्थ मक्का"},
        "symptoms": {"en": ["Deep green leaves; no disease signs."]},
        "causes": {"en": ["Balanced soil and good management."]},
        "cultural_practices": {"en": ["Routine monitoring."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── BRINJAL / EGGPLANT ────────────────────────────────────────────────────
    "brinjal_eggplant::Fruit rot": {
        "crop": "Brinjal (Eggplant)", "disease_name": "Fruit Rot (Phytophthora / Botrytis)",
        "local_names": {"hi": "बैंगन का फल सड़न", "bn": "বেগুনের ফল পচা"},
        "symptoms": {"en": ["Water-soaked lesions on fruit; rapid browning; white mold in humid conditions."]},
        "causes": {"en": ["Phytophthora nicotianae or Botrytis cinerea; humid conditions and fruit wounds."]},
        "cultural_practices": {"en": [
            "Remove and destroy infected fruits immediately.",
            "Avoid overhead irrigation; use drip.",
            "Stake plants to keep fruit off soil.",
        ]},
        "chemical_warning": {"en": "Copper hydroxide or Mancozeb sprays preventively. Consult KVK."},
        "sources": [],
    },
    "brinjal_eggplant::Shoot and fruit borer (pest)": {
        "crop": "Brinjal (Eggplant)", "disease_name": "Brinjal Shoot and Fruit Borer (Leucinodes orbonalis)",
        "local_names": {"hi": "बैंगन का तना और फल छेदक", "bn": "বেগুনের ডগা ও ফল ছিদ্রকারী পোকা"},
        "symptoms": {"en": [
            "Wilting and drying of shoot tips (dead hearts).",
            "Circular entry hole on fruit; internal larval feeding.",
            "Heavily infested fruits are unmarketable.",
        ], "hi": [
            "तने के सिरे सूखना (डेड हार्ट); फल पर गोल छेद।",
        ]},
        "causes": {"en": ["Leucinodes orbonalis moth; peak during kharif season."]},
        "cultural_practices": {"en": [
            "Remove and destroy affected shoots weekly.",
            "Use pheromone traps for adult monitoring.",
            "Use Bt (Bacillus thuringiensis) sprays as biocontrol.",
        ], "hi": [
            "प्रभावित तनों को साप्ताहिक काटकर नष्ट करें; फेरोमोन ट्रैप का उपयोग करें।",
        ]},
        "chemical_warning": {"en": "Spinosad or Emamectin Benzoate at first entry hole detection. Follow 3–5 day PHI before harvest. Consult KVK.",
                             "hi": "स्पिनोसैड या एमामेक्टिन बेंजोएट का प्रयोग। कटाई से 3–5 दिन पहले तक छिड़काव बंद करें।"},
        "sources": [],
    },
    "brinjal_eggplant::Yellow leaf curl virus": {
        "crop": "Brinjal (Eggplant)", "disease_name": "Begomovirus Leaf Curl",
        "local_names": {"hi": "बैंगन का पत्ती मरोड़ वायरस"},
        "symptoms": {"en": ["Severe upward leaf curling, yellowing; stunted plants; flower drop."]},
        "causes": {"en": ["Begomovirus transmitted by whitefly (Bemisia tabaci)."]},
        "cultural_practices": {"en": ["Reflective mulch; resistant varieties; nursery nets."]},
        "chemical_warning": {"en": "Focus on whitefly vector control. Consult extension."},
        "sources": [],
    },
    "brinjal_eggplant::Begomovirus leaf curl": {
        "crop": "Brinjal (Eggplant)", "disease_name": "Begomovirus Leaf Curl",
        "local_names": {"hi": "बैंगन का बेगोमोवायरस पत्ती मरोड़"},
        "symptoms": {"en": ["Upward leaf curling and yellowing; whitefly-transmitted virus."]},
        "causes": {"en": ["Begomovirus via Bemisia tabaci."]},
        "cultural_practices": {"en": ["Yellow sticky traps; reflective mulch; resistant varieties."]},
        "chemical_warning": {"en": "No curative treatment. Control whitefly vector. Consult KVK."},
        "sources": [],
    },
    "brinjal_eggplant::Healthy": {
        "crop": "Brinjal (Eggplant)", "disease_name": "Healthy Brinjal",
        "local_names": {"hi": "स्वस्थ बैंगन"},
        "symptoms": {"en": ["Deep green leaves; no signs of curl, borer holes, or rot."]},
        "causes": {"en": ["Good soil, balanced nutrition."]},
        "cultural_practices": {"en": ["Monitor weekly for shoot borer; stake plants for air circulation."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── ONION ─────────────────────────────────────────────────────────────────
    "onion::Purple blotch": {
        "crop": "Onion", "disease_name": "Purple Blotch (Alternaria porri)",
        "local_names": {"hi": "प्याज का पर्पल ब्लाच", "bn": "পেঁয়াজের বেগুনি দাগ"},
        "symptoms": {"en": ["Small white lesions with purple centers on leaves; coalesce to cause leaf blight."]},
        "causes": {"en": ["Alternaria porri; warm humid weather with heavy dew."]},
        "cultural_practices": {"en": [
            "Avoid overhead irrigation; ensure good air circulation.",
            "Remove crop debris; rotate with non-Allium crops.",
        ]},
        "chemical_warning": {"en": "Mancozeb or Iprodione sprays. Consult local KVK for dosage and timing.",
                             "hi": "मैन्कोज़ेब या इप्रोडियोन स्प्रे करें। KVK से परामर्श लें।"},
        "sources": [],
    },
    "onion::Stemphylium blight": {
        "crop": "Onion", "disease_name": "Stemphylium Blight (Stemphylium vesicarium)",
        "local_names": {"hi": "प्याज का स्टेम्फिलियम ब्लाइट"},
        "symptoms": {"en": ["Oval to spindle-shaped lesions with yellow halos on leaves; plants collapse."]},
        "causes": {"en": ["Stemphylium vesicarium; often follows purple blotch."]},
        "cultural_practices": {"en": ["Similar to purple blotch management; avoid dense planting."]},
        "chemical_warning": {"en": "Propiconazole effective. Consult extension."},
        "sources": [],
    },
    "onion::Downy mildew": {
        "crop": "Onion", "disease_name": "Downy Mildew (Peronospora destructor)",
        "local_names": {"hi": "प्याज का डाउनी मिल्ड्यू"},
        "symptoms": {"en": ["Pale green to grey-violet downy growth on leaves; leaves bend over; bulb quality reduced."]},
        "causes": {"en": ["Peronospora destructor; cool humid nights (13–23 °C)."]},
        "cultural_practices": {"en": ["Avoid overhead irrigation; improve drainage; use resistant varieties."]},
        "chemical_warning": {"en": "Metalaxyl + Mancozeb. Consult KVK for PHI before harvest."},
        "sources": [],
    },
    "onion::Healthy": {
        "crop": "Onion", "disease_name": "Healthy Onion",
        "local_names": {"hi": "स्वस्थ प्याज"},
        "symptoms": {"en": ["Firm, upright green leaves; no spots or mold."]},
        "causes": {"en": ["Good drainage, balanced potassium, clean transplants."]},
        "cultural_practices": {"en": ["Monitor weekly for thrips and leaf diseases."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── COTTON ────────────────────────────────────────────────────────────────
    "cotton::Leaf curl virus": {
        "crop": "Cotton", "disease_name": "Cotton Leaf Curl Disease (CLCuD)",
        "local_names": {"hi": "कपास का पत्ती मरोड़ वायरस", "bn": "তুলার পাতা কুঁকড়ানো রোগ"},
        "symptoms": {"en": [
            "Upward or downward curling, cupping, and crinkling of leaves.",
            "Dark green enations (leaf-like outgrowths) on leaf undersides.",
            "Stunted plants with prolonged flowering but no boll formation.",
        ], "hi": [
            "पत्तियों का ऊपर या नीचे मुड़ना; पत्तियों के नीचे गहरे हरे उभार।",
            "पौधे बौने रहते हैं; फूल आते हैं लेकिन टिंडे नहीं बनते।",
        ]},
        "causes": {"en": ["Begomovirus (Cotton Leaf Curl Virus — CLCuV); transmitted by whitefly (Bemisia tabaci)."]},
        "cultural_practices": {"en": [
            "Plant CLCuD-resistant Bt cotton varieties (MRC 7017, Ankur 3028).",
            "Rogue out infected plants early; install yellow sticky traps.",
            "Maintain 25-day nursery period before transplanting to avoid early whitefly exposure.",
        ], "hi": [
            "CLCuD-प्रतिरोधी Bt कपास किस्में लगाएं।",
            "संक्रमित पौधों को जल्दी हटाएं; पीले चिपचिपे ट्रैप लगाएं।",
        ]},
        "chemical_warning": {"en": "No curative treatment for CLCuD. Strict whitefly management with Imidacloprid (seed treatment) or Thiamethoxam. Consult local cotton specialist.",
                             "hi": "CLCuD का कोई इलाज नहीं है। सफेद मक्खी नियंत्रण पर ध्यान दें। स्थानीय कपास विशेषज्ञ से परामर्श लें।"},
        "sources": [],
    },
    "cotton::Bacterial blight (angular leaf spot)": {
        "crop": "Cotton", "disease_name": "Bacterial Blight / Angular Leaf Spot (Xanthomonas citri subsp. malvacearum)",
        "local_names": {"hi": "कपास का जीवाणु झुलसा"},
        "symptoms": {"en": ["Angular water-soaked spots limited by veins; water-soaked stem lesions (blackarm); boll rot."]},
        "causes": {"en": ["Xanthomonas citri subsp. malvacearum; seed-borne; rain splash."]},
        "cultural_practices": {"en": ["Acid-delinting of seed; resistant varieties; crop rotation."]},
        "chemical_warning": {"en": "Copper bactericides have limited systemic effect. Consult extension."},
        "sources": [],
    },
    "cotton::Healthy": {
        "crop": "Cotton", "disease_name": "Healthy Cotton",
        "local_names": {"hi": "स्वस्थ कपास"},
        "symptoms": {"en": ["Broad, deep green leaves; no curling, spots, or wilting."]},
        "causes": {"en": ["Balanced soil nutrients, good drainage."]},
        "cultural_practices": {"en": ["Monitor weekly for whitefly, bollworm, and CLCuD symptoms."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },

    # ── BELL PEPPER ───────────────────────────────────────────────────────────
    "bell_pepper::Bacterial spot": {
        "crop": "Bell Pepper (Capsicum)", "disease_name": "Bacterial Spot (Xanthomonas campestris)",
        "local_names": {"hi": "शिमला मिर्च का जीवाणु धब्बा", "bn": "ক্যাপসিকামের ব্যাকটেরিয়াল স্পট"},
        "symptoms": {"en": ["Small water-soaked lesions turning dark brown with halos; fruit scabs."]},
        "causes": {"en": ["Xanthomonas campestris pv. vesicatoria; rain splash and infected seed."]},
        "cultural_practices": {"en": ["Certified disease-free seed; avoid overhead irrigation; sanitize tools."]},
        "chemical_warning": {"en": "Copper bactericides limited efficacy. Consult agronomist."},
        "sources": [],
    },
    "bell_pepper::Healthy": {
        "crop": "Bell Pepper (Capsicum)", "disease_name": "Healthy Bell Pepper",
        "local_names": {"hi": "स्वस्थ शिमला मिर्च"},
        "symptoms": {"en": ["Glossy smooth dark green leaves."]},
        "causes": {"en": ["Adequate calcium, warm sunny days."]},
        "cultural_practices": {"en": ["Steady drip irrigation to prevent blossom end rot."]},
        "chemical_warning": {"en": "No treatment needed."},
        "sources": [],
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# Helper: image quality gate
# ──────────────────────────────────────────────────────────────────────────────
def _check_image_quality(image: Image.Image) -> Tuple[bool, Optional[str]]:
    if min(image.size) < 96:
        return False, "Image is too small. Upload a clear close-up of one leaf."
    gray = image.convert("L")
    brightness = ImageStat.Stat(gray).mean[0]
    if brightness < 35:
        return False, "Photo is too dark. Retake in natural diffused light."
    if brightness > 235:
        return False, "Photo is overexposed. Avoid direct harsh sunlight glare."
    arr = np.asarray(image.resize((128, 128)), dtype=np.float32)
    green_evidence = (arr[:, :, 1] > arr[:, :, 0] * 1.05) & (arr[:, :, 1] > arr[:, :, 2] * 0.9)
    if float(green_evidence.mean()) < 0.04:
        return False, "No clear leaf-like green area detected. Photograph a single crop leaf directly."
    gray_arr = np.asarray(gray.resize((128, 128)), dtype=np.float32)
    lap = (gray_arr[1:-1, 1:-1] * 4 - gray_arr[:-2, 1:-1] - gray_arr[2:, 1:-1]
           - gray_arr[1:-1, :-2] - gray_arr[1:-1, 2:])
    if float(np.var(lap)) < 18:
        return False, "Image appears blurry. Hold phone steady 15–20 cm from the leaf and tap to focus."
    return True, None


# ──────────────────────────────────────────────────────────────────────────────
# Helper: localization
# ──────────────────────────────────────────────────────────────────────────────
def _get_localized_list(field_data: Any, language: str) -> List[str]:
    if isinstance(field_data, dict):
        return field_data.get(language, field_data.get("en", []))
    if isinstance(field_data, list):
        return field_data
    return []


def _get_localized_str(field_data: Any, language: str, default: str = "") -> str:
    if isinstance(field_data, dict):
        return field_data.get(language, field_data.get("en", default))
    if isinstance(field_data, str):
        return field_data
    return default


def _get_disease_info(label: str) -> Dict[str, Any]:
    """Return curated disease-card data without making an API call."""
    known_info = DISEASE_KNOWLEDGE_BASE.get(label)
    if known_info:
        return known_info
    parts = label.split("::")
    crop_key = parts[0] if parts else "Unknown"
    condition = parts[1] if len(parts) > 1 else label
    crop_display = CROP_DISPLAY_NAMES.get(crop_key, crop_key.replace("_", " ").title())
    return {
        "crop": crop_display,
        "disease_name": condition,
        "symptoms": {"en": []},
        "causes": {"en": []},
        "cultural_practices": {"en": []},
        "sources": [],
    }


# ──────────────────────────────────────────────────────────────────────────────
# Uncertain scan response
# ──────────────────────────────────────────────────────────────────────────────
def _unknown_scan_response(
    plot_id: Optional[str],
    reason: str,
    crop: str = "Unknown",
    model_available: bool = True,
    retake_guidance: Optional[str] = None,
) -> ScanResponse:
    return ScanResponse(
        scan_id=f"scan_{uuid.uuid4().hex[:10]}",
        plot_id=plot_id,
        crop=crop,
        top_disease=reason,
        confidence=0.0,
        status="uncertain",
        predictions=[],
        symptoms=[
            "Ambiguous foliar pattern detected.",
            "Possible overlap between nutritional deficiency and early lesion formation.",
        ],
        causes=["Cannot confirm primary cause with sufficient confidence."],
        management_summary=(
            "Diagnosis uncertain. Do not apply chemical fungicides based on this scan. "
            "Retake the photo or consult your local KVK / Agricultural Extension Officer."
        ),
        cultural_practices=["Monitor closely for symptom progression.", "Sanitize tools; avoid overhead irrigation."],
        chemical_warning="Do not apply treatment based on an uncertain scan. Contact KVK (1800-180-1551).",
        retake_guidance=(
            retake_guidance
            or "Take a clear close-up of one diseased leaf in even daylight. "
               "Ensure the leaf fills most of the frame and is in sharp focus."
        ),
        sources=[],
        model_version=MODEL_VERSION if model_available else f"{MODEL_VERSION} (model unavailable)",
        is_demo_data=False,
        guidance_is_demo_data=True,
        created_at=datetime.datetime.utcnow().isoformat(),
    )


# ──────────────────────────────────────────────────────────────────────────────
# Core inference function
# ──────────────────────────────────────────────────────────────────────────────
def diagnose_leaf_image(
    image_bytes: bytes,
    crop_hint: Optional[str] = None,
    plot_id: Optional[str] = None,
    language: str = "en",
) -> ScanResponse:
    """
    Run india_v1 (DINOv2 ViT-B/14, 387 classes) ONNX inference on a leaf image.

    crop_hint: optional crop name (e.g. 'tomato', 'rice', 'wheat') to restrict
               output to that crop's disease classes.  Accepts Hindi aliases.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("Invalid image file. Please upload JPEG or PNG.") from exc

    # ── 1. Image quality gate ───────────────────────────────────────────────
    quality_ok, quality_reason = _check_image_quality(image)
    if not quality_ok:
        return _unknown_scan_response(plot_id, "Unknown / Low Confidence",
                                      retake_guidance=quality_reason)

    # ── 2. Resolve crop hint → internal key ─────────────────────────────────
    crop_key: Optional[str] = None
    if crop_hint:
        norm = crop_hint.strip().lower().replace(" ", "_")
        crop_key = CROP_HINT_MAP.get(norm)
        if crop_key is None and norm in CROP_CLASS_INDICES:
            crop_key = norm  # direct match
        if crop_key is None:
            # Unknown crop hint — don't hard-block; run auto-detect instead
            logger.info("[AgriBridge] Unknown crop hint '%s'; running auto-detect.", crop_hint)

    # ── 3. ONNX preprocessing (ImageNet norm, center-crop 224×224) ──────────
    sess = _get_onnx_session()
    if sess is None:
        return _unknown_scan_response(plot_id, "Model loading — please retry in 60 seconds",
                                      model_available=False)

    try:
        scale = 256 / min(image.size)
        resized = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.BILINEAR,
        )
        left, top_px = (resized.width - 224) // 2, (resized.height - 224) // 2
        crop_img = resized.crop((left, top_px, left + 224, top_px + 224))
        arr = np.asarray(crop_img, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        tensor = np.expand_dims(((arr - mean) / std).transpose(2, 0, 1), axis=0)

        in_name  = sess.get_inputs()[0].name
        out_name = sess.get_outputs()[0].name
        raw = sess.run([out_name], {in_name: tensor})[0].reshape(-1)

        if raw.size != len(INDIA_CLASSES) or not np.isfinite(raw).all():
            raise ValueError(f"Unexpected model output shape {raw.shape} (expected {len(INDIA_CLASSES)})")
    except Exception as exc:
        logger.warning("[AgriBridge] Inference failed: %s", exc)
        return _unknown_scan_response(plot_id, "Unknown / Low Confidence", model_available=False)

    # ── 4. Crop-conditioned softmax ──────────────────────────────────────────
    if crop_key and crop_key in CROP_CLASS_INDICES:
        eligible_indices = CROP_CLASS_INDICES[crop_key]
        predicted_crop_display = CROP_DISPLAY_NAMES.get(crop_key, crop_key.replace("_", " ").title())
    else:
        # Auto-detect: sum probabilities per crop, pick best crop
        scaled_all = raw / TEMPERATURE
        exp_all = np.exp(scaled_all - np.max(scaled_all))
        prob_all = exp_all / exp_all.sum()

        crop_scores: Dict[str, float] = {}
        for c, idxs in CROP_CLASS_INDICES.items():
            crop_scores[c] = float(prob_all[idxs].sum())
        best_crop = max(crop_scores, key=lambda c: crop_scores[c])
        best_crop_prob = crop_scores[best_crop]

        if best_crop_prob < 0.05:
            return _unknown_scan_response(
                plot_id, "Unknown / Unsupported Plant",
                retake_guidance="The model could not identify a supported crop. Photograph a single leaf of a supported Indian crop."
            )

        crop_key = best_crop
        eligible_indices = CROP_CLASS_INDICES[crop_key]
        predicted_crop_display = CROP_DISPLAY_NAMES.get(crop_key, crop_key.replace("_", " ").title())

    # ── 5. Disease-level softmax within selected crop ────────────────────────
    crop_logits = raw[eligible_indices] / TEMPERATURE
    crop_exp = np.exp(crop_logits - np.max(crop_logits))
    crop_probs = crop_exp / crop_exp.sum()

    sorted_pairs = sorted(
        zip(eligible_indices, crop_probs.tolist()),
        key=lambda x: x[1],
        reverse=True,
    )
    top_idx, top_prob = sorted_pairs[0]
    top_label = INDIA_CLASSES[top_idx]
    second_prob = sorted_pairs[1][1] if len(sorted_pairs) > 1 else 0.0
    disease_margin = float(top_prob - second_prob)

    # ── 6. Confidence gate ───────────────────────────────────────────────────
    is_confident = (
        quality_ok
        and top_prob >= CONFIDENCE_THRESHOLD
        and disease_margin >= 0.05
    )

    if not is_confident:
        cond = INDIA_CLASSES[top_idx].split("::")[-1] if "::" in INDIA_CLASSES[top_idx] else INDIA_CLASSES[top_idx]
        if language == "hi":
            retake_msg = (
                f"AI मॉडल का विश्वास स्तर कम है ({top_prob:.0%})। "
                "एक स्पष्ट, करीबी तस्वीर प्राकृतिक रोशनी में लें।"
            )
        elif language == "bn":
            retake_msg = (
                f"AI মডেলের আস্থার মাত্রা কম ({top_prob:.0%})। "
                "প্রাকৃতিক আলোতে একটি স্পষ্ট পাতার ছবি তুলুন।"
            )
        else:
            retake_msg = (
                f"Model confidence is low ({top_prob:.0%}). "
                "Retake a sharp close-up of a single diseased leaf in even natural light. "
                "For assistance, contact Kisan Call Centre: 1800-180-1551."
            )
        return _unknown_scan_response(
            plot_id,
            "Unknown / Low Confidence",
            crop=predicted_crop_display,
            retake_guidance=quality_reason or retake_msg,
        )

    # ── 7. Build top-5 predictions ───────────────────────────────────────────
    top5_preds: List[DiseasePrediction] = []
    for idx, prob in sorted_pairs[:5]:
        label = INDIA_CLASSES[idx]
        info = _get_disease_info(label)
        crop_disp = info.get("crop", predicted_crop_display)
        disease_disp = (
            info.get("local_names", {}).get(language, info.get("disease_name", label.split("::")[-1]))
            if language != "en"
            else info.get("disease_name", label.split("::")[-1])
        )
        top5_preds.append(DiseasePrediction(
            class_name=label,
            crop=crop_disp,
            disease_name=disease_disp,
            confidence=round(float(prob), 4),
        ))

    # ── 8. Build full response ────────────────────────────────────────────────
    best_info = _get_disease_info(top_label)
    disease_name = (
        best_info.get("local_names", {}).get(language, best_info.get("disease_name", top_label.split("::")[-1]))
        if language != "en"
        else best_info.get("disease_name", top_label.split("::")[-1])
    )

    guidance = generate_scan_guidance(
        crop=best_info.get("crop", predicted_crop_display),
        disease=disease_name,
        language=language,
    )
    if guidance:
        mgmt_summary = " ".join(guidance["summary"])
        scan_practices = (
            guidance["precautions"]
            + [f"Avoid: {item}" for item in guidance["avoid"]]
            + [f"Next step: {item}" for item in guidance["next_steps"]]
        )
        scan_chemical_warning = (
            "Gemma 4 provides general AI guidance, not a confirmed diagnosis or treatment prescription. "
            "Do not apply chemicals based on this scan; confirm with your local KVK or agricultural extension officer."
        )
    else:
        mgmt_summary = (
            f"Possible {disease_name} detected on {best_info.get('crop', predicted_crop_display)}. "
            "This screening may be wrong. Monitor the plant and confirm the diagnosis with a local KVK before treatment."
        )
        scan_practices = _get_localized_list(best_info.get("cultural_practices"), language)
        if not scan_practices:
            scan_practices = [
                "Monitor affected plants and photograph symptom changes for an agricultural specialist.",
                "Avoid applying pesticides or fungicides until the diagnosis is confirmed.",
            ]
        scan_chemical_warning = (
            "AI guidance is unavailable. Do not apply chemicals based on this scan; "
            "confirm with your local KVK or agricultural extension officer."
        )

    sources_raw = best_info.get("sources", [])
    sources_out = [
        SourceCitation(
            source_id=s.get("source_id", ""),
            title=s.get("title", ""),
            publisher=s.get("publisher", ""),
            license=s.get("license", ""),
            passage_text=s.get("passage_text", ""),
        )
        for s in sources_raw
    ] if sources_raw else []

    return ScanResponse(
        scan_id=f"scan_{uuid.uuid4().hex[:10]}",
        plot_id=plot_id,
        crop=best_info.get("crop", predicted_crop_display),
        top_disease=disease_name,
        confidence=round(float(top_prob), 4),
        status="confident",
        predictions=top5_preds,
        symptoms=_get_localized_list(best_info.get("symptoms"), language),
        causes=_get_localized_list(best_info.get("causes"), language),
        management_summary=mgmt_summary,
        cultural_practices=scan_practices,
        chemical_warning=scan_chemical_warning,
        retake_guidance=None,
        sources=sources_out,
        model_version=MODEL_VERSION,
        is_demo_data=False,
        guidance_is_demo_data=guidance is None,
        created_at=datetime.datetime.utcnow().isoformat(),
    )
