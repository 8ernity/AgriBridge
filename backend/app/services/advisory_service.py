"""Experimental advisory using dense retrieval, optional Gemma 4 API generation, and demo snippets."""
import os
import uuid
import datetime
import asyncio
import logging
import re
from typing import AsyncGenerator, Dict, Any, List, Optional
import numpy as np
from app.schemas.entities import AdvisoryRequest, AdvisoryResponse, SourceCitation

logger = logging.getLogger(__name__)
GEMMA_MODEL_ID = "gemma-4-26b-a4b-it"

# Curated demonstration snippets; source-level verification and licensing remain pending.
AGRONOMY_CORPUS: List[Dict[str, Any]] = [
    {
        "id": "PASSAGE-01",
        "keywords": ["blight", "early blight", "alternaria", "leaf spot", "tomato", "potato", "fungus", "phytophthora"],
        "title": "Integrated Management of Solanaceous Blights (Tomato & Potato)",
        "publisher": "AgriBridge curated demo knowledge base (source attribution unverified)",
        "license": "Attribution and license verification pending",
        "url": None,
        "content_en": "Early blight (Alternaria solani) and late blight (Phytophthora infestans) thrive under prolonged leaf wetness and warm-to-moderate temperatures. Sanitation is crucial: prune lower senescent and infected leaves to prevent soil-splash inoculation. Avoid overhead sprinkler irrigation and use drip lines or furrow irrigation. Apply organic mulch around plant bases to suppress spore splash. Spraying neem seed kernel extract (NSKE 5%) or bio-agents like Trichoderma viride early in the crop cycle provides strong preventive protection. If lesions exceed 20% canopy damage, consult your local Krishi Vigyan Kendra (KVK) for stage-specific intervention.",
        "content_hi": "झुलसा रोग (अगेती और पछेती) पत्तियों पर लगातार नमी और 18-24°C तापमान में तेजी से फैलता है। नियंत्रण के लिए निचली रोगग्रस्त पत्तियों को काटकर नष्ट करें ताकि मिट्टी से फफूंद के बीजाणु न फैलें। फव्वारा सिंचाई के बजाय ड्रिप या थाला विधि का उपयोग करें। शुरुआती रोकथाम के लिए नीम के बीज का अर्क (NSKE 5%) या ट्राइकोडर्मा विरिडी (5 ग्राम/लीटर) का छिड़काव करें। गंभीर संक्रमण होने पर नजदीकी कृषि विज्ञान केंद्र (KVK) से संपर्क करें।",
        "content_bn": "ধসা রোগ (আগে ও পরে) পাতার অতিরিক্ত আর্দ্রতা ও স্যাঁতসেঁতে আবহাওয়ায় দ্রুত ছড়ায়। মাটির জল ছিটকে সংক্রমণ রোধ করতে নিচের আক্রান্ত পাতা কেটে পুড়িয়ে ফেলুন। স্প্রিঙ্কলার সেচের পরিবর্তে ড্রিপ সেচ ব্যবহার করুন। নিম বীজের নির্যাস (NSKE ৫%) বা ট্রাইকোডার্মা ভিরিডি স্প্রে করে প্রাকৃতিকভাবে রোগ নিয়ন্ত্রণ করা যায়। সংক্রমণ তীব্র হলে স্থানীয় কৃষি বিজ্ঞান কেন্দ্র (KVK)-এর সাথে পরামর্শ করুন।"
    },
    {
        "id": "PASSAGE-02",
        "keywords": ["soil", "organic carbon", "ph", "fertilizer", "compost", "nitrogen", "regenerative", "manure", "fym"],
        "title": "Soil Organic Matter Enhancement & Ecological Nutrient Cycling",
        "publisher": "AgriBridge curated demo knowledge base (source attribution unverified)",
        "license": "Attribution and license verification pending",
        "url": None,
        "content_en": "Maintaining soil organic carbon above 0.75% (7.5 g/kg) substantially improves soil microbial biomass and suppresses soil-borne fungal pathogens. Applying well-decomposed Farmyard Manure (FYM) or vermicompost at 5 tonnes per hectare prior to field preparation restores soil moisture-holding capacity in sandy and alluvial plains. Combined application of biofertilizers (Azotobacter, Rhizobium, and Phosphate Solubilizing Bacteria) reduces chemical fertilizer dependency by 20-25%.",
        "content_hi": "मिट्टी में जैविक कार्बन का स्तर 0.75% से ऊपर रखने से लाभकारी सूक्ष्मजीवों की संख्या बढ़ती है और मिट्टी जनित रोग कम होते हैं। बुवाई से पूर्व 5 टन प्रति हेक्टेयर की दर से अच्छी सड़ी हुई गोबर की खाद (FYM) या केंचुआ खाद (वर्मीकम्पोस्ट) मिलाने से मिट्टी की जल-धारण क्षमता सुधरती है। एजोटोबैक्टर व पीएसबी जैसे जैव उर्वरकों का प्रयोग रासायनिक उर्वरकों पर निर्भरता को 20-25% तक कम करता है।",
        "content_bn": "মাটিতে জৈব কার্বনের মাত্রা ০.৭৫% এর উপরে রাখা মাটির উর্বরতা ও অণুজীবের জন্য অত্যন্ত জরুরি। প্রতি হেক্টরে ৫ টন গোবর সার বা ভার্মিকম্পোস্ট প্রয়োগ করলে মাটির আর্দ্রতা ধরে রাখার ক্ষমতা বাড়ে এবং রাসায়নিক সারের নির্ভরতা ২০-২৫% হ্রাস পায়।"
    },
    {
        "id": "PASSAGE-03",
        "keywords": ["rotation", "crop rotation", "legume", "chickpea", "cowpea", "beans", "cover crop", "green gram", "moong", "urad"],
        "title": "Legume-Inclusive Crop Rotations for Soil Fertility & Pest Suppression",
        "publisher": "AgriBridge curated demo knowledge base (source attribution unverified)",
        "license": "Attribution and license verification pending",
        "url": None,
        "content_en": "Intercropping or rotating cereals with short-duration grain legumes (such as moong bean, urad, chickpea, or cowpea) fixes between 40-70 kg of atmospheric nitrogen per hectare through symbiotic Rhizobium nodules. Crop rotation disrupts host-specific insect pest cycles and pathogen lifecycles, breaking continuous infestation patterns without synthetic chemical fumigation.",
        "content_hi": "धान या गेहूं की फसल के बाद कम अवधि की दलहनी फसलें (जैसे मूँग, उड़द या चना) लगाने से राइजोबियम ग्रंथियों के माध्यम से प्रति हेक्टेयर 40-70 किग्रा वायुमंडलीय नाइट्रोजन का प्राकृतिक स्थिरीकरण होता है। फसल चक्र कीटों और फफूंद के जीवन चक्र को तोड़कर आने वाली फसल को सुरक्षित रखता है।",
        "content_bn": "ধান বা ভুট্টার পর ডাল জাতীয় ফসল (যেমন মুগ, কলাই, ছোলা) চাষ করলে মাটিতে প্রতি হেক্টরে ৪০-৭০ কেজি প্রাকৃতিক নাইট্রোজেন যুক্ত হয় এবং পোকামাকড়ের উপদ্রব হ্রাস পায়।"
    },
    {
        "id": "PASSAGE-04",
        "keywords": ["weather", "rain", "humidity", "heat", "temperature", "forecast", "drought", "water", "agromet"],
        "title": "Weather-Based Farm Operations & Agromet Advisory",
        "publisher": "AgriBridge curated demo knowledge base (source attribution unverified)",
        "license": "Attribution and license verification pending",
        "url": None,
        "content_en": "Relative humidity exceeding 80% combined with overcast skies and temperatures between 18-24°C creates peak risk windows for fungal spore germination and foliar diseases. Postpone foliar spraying immediately prior to anticipated rainfall to prevent pesticide wash-off and aquatic runoff. Ensure proper drainage channels in low-lying plots to avoid waterlogging during high precipitation events.",
        "content_hi": "हवा में 80% से अधिक नमी और 18-24°C तापमान फफूंद जनित रोगों के तेजी से फैलने के लिए अनुकूल वातावरण बनाते हैं। बारिश की संभावना होने पर किसी भी प्रकार का पर्णीय छिड़काव न करें ताकि दवा बह न जाए। भारी बारिश के समय खेत में जल निकासी की समुचित व्यवस्था रखें।",
        "content_bn": "বাতাসে আর্দ্রতা ৮০% এর বেশি এবং মেঘলা আবহাওয়া থাকলে ছত্রাকজনিত রোগের ঝুঁকি বহুগুণ বেড়ে যায়। বৃষ্টির সম্ভাবনা থাকলে গাছে স্প্রে করা বন্ধ রাখুন এবং জমিতে যাতে জল না জমে সে জন্য নিকাশী ব্যবস্থা নিশ্চিত করুন।"
    },
    {
        "id": "PASSAGE-05",
        "keywords": ["pest", "insect", "fall armyworm", "stem borer", "caterpillar", "ipm", "neem", "trap"],
        "title": "Integrated Pest Management (IPM) & Bio-intensive Protection",
        "publisher": "AgriBridge curated demo knowledge base (source attribution unverified)",
        "license": "Attribution and license verification pending",
        "url": None,
        "content_en": "Deploy yellow and blue sticky traps (15-20 traps per hectare) alongside sex pheromone traps to monitor pest entry thresholds for whiteflies, thrips, and borers before economic injury levels are reached. Spray 1500 ppm azadirachtin (neem oil formulation) at 3-5 ml per litre at the first sign of nymph activity. Preserve natural predators including ladybird beetles, Chrysoperla, and spiders by avoiding broad-spectrum organophosphate sprays.",
        "content_hi": "कीटों की निगरानी के लिए प्रति हेक्टेयर 15-20 पीले व नीले चिपचिपे ट्रैप और फेरोमोन ट्रैप लगाएं। कीटों के शुरुआती लक्षण दिखने पर 1500 ppm एजाडिराक्टिन (नीम तेल) 3-5 मिली प्रति लीटर पानी में मिलाकर छिड़कें। लेडीबर्ड बीटल और मकड़ियों जैसे प्राकृतिक मित्र कीटों के संरक्षण हेतु अंधाधुंध रासायनिक कीटनाशकों से बचें।",
        "content_bn": "জমিতে ক্ষতিকর পোকা নজরদারির জন্য হলুদ ও নীল রঙের আঠালো ফাঁদ এবং ফেরোমোন ফাঁদ ব্যবহার করুন। পোকার প্রাথমিক আক্রমণে ১৫০০ পিপিএম নিম তেল প্রতি লিটার জলে ৩-৫ মিলি হারে স্প্রে করুন। বন্ধু পোকা (যেমন লেডিবার্ড বিটল) সংরক্ষণের জন্য বিষাক্ত রাসায়নিক কীটনাশক এড়িয়ে চলুন।"
    }
]

SAFETY_DISCLAIMER = (
    "AgriBridge Advisory is a demo decision-support tool using curated snippets whose source attribution has not been verified. "
    "Do not rely on generated content for pesticide dosing or crop treatment. Confirm decisions with a qualified local "
    "agricultural extension professional."
)

HELPLINE_CONTACT = "Kisan Call Centre (Government of India Toll Free): 1800-180-1551 (6:00 AM - 10:00 PM)"

# Vector Embeddings Cache
_embed_model = None
_corpus_embeddings: Optional[np.ndarray] = None


def _get_embed_model():
    """Lazy-load the BGE vector embedding model via fastembed (ONNX runtime)."""
    global _embed_model
    if _embed_model is None:
        try:
            from fastembed import TextEmbedding
            _embed_model = TextEmbedding("BAAI/bge-small-en-v1.5")
            logger.info("Initialized fastembed BGE vector embedding model successfully.")
        except Exception as e:
            logger.warning(f"Could not load fastembed BGE model: {e}")
            _embed_model = None
    return _embed_model


def _get_corpus_embeddings() -> Optional[np.ndarray]:
    """Precompute and cache vector embeddings for all passages in AGRONOMY_CORPUS."""
    global _corpus_embeddings
    if _corpus_embeddings is not None:
        return _corpus_embeddings
    model = _get_embed_model()
    if model is None:
        return None
    try:
        texts = [f"{p['title']}. {p['content_en']}" for p in AGRONOMY_CORPUS]
        embeddings = list(model.embed(texts))
        _corpus_embeddings = np.array(embeddings, dtype=np.float32)
        return _corpus_embeddings
    except Exception as e:
        logger.warning(f"Failed to precompute corpus embeddings: {e}")
        return None


def retrieve_relevant_passages(query: str, top_k: int = 2) -> List[Dict[str, Any]]:
    """Retrieve top-k relevant agronomic passages using dense BGE vector embeddings with keyword fallback."""
    model = _get_embed_model()
    corpus_vecs = _get_corpus_embeddings()

    if model is not None and corpus_vecs is not None:
        try:
            q_embed = list(model.embed([query]))[0]
            q_vec = np.array(q_embed, dtype=np.float32)
            # Compute cosine similarities (unit-normalized vectors)
            similarities = np.dot(corpus_vecs, q_vec)
            top_indices = np.argsort(similarities)[::-1][:top_k]
            # Ensure relevance threshold (> 0.35)
            selected = [AGRONOMY_CORPUS[idx] for idx in top_indices if similarities[idx] > 0.35]
            if selected:
                return selected
        except Exception as err:
            logger.warning(f"Dense vector retrieval error: {err}. Falling back to keyword matching.")

    # Keyword retrieval fallback
    q_tokens = set(query.lower().split())
    scored = []
    for passage in AGRONOMY_CORPUS:
        score = sum(1 for kw in passage["keywords"] if kw in q_tokens or any(kw in t for t in q_tokens))
        if score > 0:
            scored.append((score, passage))
    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        return [p[1] for p in scored[:top_k]]
    return [AGRONOMY_CORPUS[0], AGRONOMY_CORPUS[1]]


def _check_safety_guardrails(question: str) -> Optional[str]:
    """Safety guardrails: reject uncalibrated chemical dosage recipes and dangerous mixtures."""
    q_lower = question.lower()
    dangerous_keywords = [
        "dosage per liter", "how many ml of chlorpyrifos", "how much chemical to mix",
        "pesticide dose", "poison ratio", "mix pesticide with herbicide", "make homemade pesticide"
    ]
    for d in dangerous_keywords:
        if d in q_lower:
            return (
                "Safety Guardrail Notice: AgriBridge does not provide raw chemical pesticide dosages or unregulated "
                "tank-mixing instructions. Applying uncalibrated chemical concentrations carries high risk of crop leaf "
                "scorching, groundwater contamination, and personal toxicity. Please contact your nearest Krishi Vigyan Kendra "
                "(KVK) or call the toll-free Kisan Call Centre at 1800-180-1551 for approved, calibrated prescriptions based "
                "on your specific sprayer equipment and crop stage."
            )
    return None


def _get_gemini_client():
    """Create the Google Gen AI SDK client when an API key is configured."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as exc:
        logger.warning("Could not initialize Google Gen AI client: %s", exc)
        return None


def _parse_scan_guidance(text: str) -> Optional[Dict[str, Any]]:
    sections: Dict[str, List[str]] = {"summary": [], "precautions": [], "avoid": [], "next_steps": []}
    labels = {
        "SUMMARY": "summary",
        "PRECAUTIONS": "precautions",
        "AVOID": "avoid",
        "NEXT_STEPS": "next_steps",
    }
    current: Optional[str] = None
    for raw_line in text.splitlines():
        line = re.sub(r"^\s*[*#>\-•\s]+", "", raw_line).strip()
        matched = False
        for label, key in labels.items():
            match = re.match(rf"^{label}\s*:\s*(.*)$", line, re.IGNORECASE)
            if match:
                current = key
                if match.group(1).strip():
                    sections[key].append(match.group(1).strip())
                matched = True
                break
        if not matched and current and line:
            sections[current].append(line)

    cleaned = {key: [re.sub(r"^\s*[-*•]\s*", "", item).strip() for item in items if item.strip()]
               for key, items in sections.items()}
    if any(not cleaned[key] for key in ("summary", "precautions", "avoid", "next_steps")):
        return None
    if sum(len(item) for items in cleaned.values() for item in items) > 5000:
        return None
    combined = " ".join(item for items in cleaned.values() for item in items)
    if re.search(r"\b\d+(?:\.\d+)?\s*(?:ml|mg|g|ppm|%)(?:\s*(?:/|per)\s*\w+)?", combined, re.IGNORECASE):
        return None
    return {key: items[:15] for key, items in cleaned.items()}


def generate_scan_guidance(
    crop: str,
    disease: str,
    language: str = "en",
) -> Optional[Dict[str, Any]]:
    """Return safe, structured scan guidance from Gemma 4, or None on any failure."""
    client = _get_gemini_client()
    if client is None:
        return None
    prompt = f"""You provide cautious, general crop-care education for farmers in India.
An image classifier reported a POSSIBLE condition; it may be wrong.
Crop: {crop}
Possible condition: {disease}
Write the CONTENT in language code: {language}
CRITICAL INSTRUCTION: You MUST use the exact English headings below. Do NOT translate the headings 'SUMMARY', 'PRECAUTIONS', 'AVOID', and 'NEXT_STEPS' to {language}.

Return only these four labeled sections, exactly once each, with detailed and pointwise plain text:
SUMMARY: Say this is a possible screening result, not a confirmed diagnosis. Provide a detailed summary.
PRECAUTIONS: Give detailed, pointwise, low-risk, non-chemical immediate precautions.
AVOID: Give detailed, pointwise actions to avoid, especially unconfirmed chemical treatment.
NEXT_STEPS: Give detailed, pointwise observation/confirmation steps and advise contacting a local KVK/agricultural extension officer.

Do not give pesticide/fungicide names, chemical recipes, dosages, or claim certainty.
Do not invent region-specific facts, sources, or symptoms not established by the input.
Make the explanation detailed and pointwise as requested."""
    try:
        response = client.models.generate_content(model=GEMMA_MODEL_ID, contents=prompt)
        if not response or not getattr(response, "text", None):
            return None
        guidance = _parse_scan_guidance(response.text.strip())
        if guidance is None:
            logger.warning("Gemma 4 scan guidance did not match the safe output format")
        return guidance
    except Exception as exc:
        logger.warning("Gemma 4 scan guidance unavailable: %s", exc)
        return None

def generate_scientific_report(crop: str, disease: str, language: str = "en") -> str:
    """Return a detailed scientific report on the disease using Gemma."""
    client = _get_gemini_client()
    if client is None:
        return "Scientific report generation is unavailable at the moment (API key missing)."
    
    prompt = f"""You are an expert plant pathologist and agronomist.
Write a detailed, highly scientific report on the disease '{disease}' affecting '{crop}'.
Language: {language}

Include the following sections clearly labeled with their exact headings:
1. SCIENTIFIC CLASSIFICATION & ETIOLOGY
2. PATHOGENESIS & EPIDEMIOLOGY
3. BIOCHEMICAL & PHYSIOLOGICAL SYMPTOMS
4. INTEGRATED DISEASE MANAGEMENT (IDM)

Provide deep scientific terminology, biological pathways, and environmental triggers.
Return plain text without any markdown symbols like asterisks or hash tags."""
    try:
        response = client.models.generate_content(model=GEMMA_MODEL_ID, contents=prompt)
        if response and getattr(response, "text", None):
            return response.text.strip()
    except Exception as exc:
        logger.error(f"Failed to generate scientific report: {{exc}}")
    return "Error generating the scientific report."
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"Could not initialize Google Generative AI client: {e}")
        return None


def generate_advisory_response(
    request: AdvisoryRequest,
    plot_context: Optional[Dict[str, Any]] = None,
    weather_context: Optional[Dict[str, Any]] = None,
    soil_context: Optional[Dict[str, Any]] = None,
    scan_context: Optional[Dict[str, Any]] = None
) -> AdvisoryResponse:
    """Generate source-grounded agronomic advisory using BGE RAG and LLM reasoning."""
    # Check guardrails
    blocked = _check_safety_guardrails(request.question)
    if blocked:
        return AdvisoryResponse(
            advisory_id=f"adv_{uuid.uuid4().hex[:10]}",
            question=request.question,
            answer=blocked,
            sources=[],
            language=request.language or "en",
            safety_disclaimer=SAFETY_DISCLAIMER,
            generation_source="local_safety_guardrail",
            is_demo_data=False,
            extension_helpline=HELPLINE_CONTACT,
            created_at=datetime.datetime.utcnow().isoformat()
        )

    # Enhance the search query if scan context is present
    search_query = request.question
    if scan_context:
        search_query = f"{scan_context.get('crop')} {scan_context.get('top_disease')} " + request.question

    # 1. Retrieve relevant passages from the bundled demonstration corpus
    selected = retrieve_relevant_passages(search_query, top_k=2)

    lang = request.language or "en"
    lang_key = f"content_{lang}" if f"content_{lang}" in selected[0] else "content_en"

    # Assemble citations
    citations: List[SourceCitation] = [
        SourceCitation(
            source_id=p["id"],
            title=p["title"],
            publisher=p["publisher"],
            url=p.get("url"),
            license=p["license"],
            passage_text=p["content_en"]
        )
        for p in selected
    ]

    # Context items
    ctx_intro = []
    if scan_context:
        ctx_intro.append(f"Recent Diagnosis: {scan_context.get('crop')} has {scan_context.get('top_disease')} ({int(scan_context.get('confidence', 0)*100)}% confidence)")
    if plot_context:
        ctx_intro.append(f"Plot '{plot_context.get('name')}' (Crop: {plot_context.get('crop', '').title()})")
    if weather_context:
        ctx_intro.append(f"Weather: {weather_context.get('current_temp_c')}°C, {weather_context.get('current_condition')}")
    if soil_context:
        ph_val = soil_context.get('ph', {}).get('value', 'N/A')
        ctx_intro.append(f"Soil pH: {ph_val}")

    # Gemma 4 is called only when a server-side API key is configured.
    genai_client = _get_gemini_client()
    llm_answer = None

    if genai_client is not None:
        try:
            sources_text = "\n\n".join([
                f"[Source {i+1}: {p['title']} by {p['publisher']}]\n{p.get(lang_key, p['content_en'])}"
                for i, p in enumerate(selected)
            ])
            lang_name_map = {"en": "English", "hi": "Hindi", "bn": "Bengali"}
            lang_name = lang_name_map.get(lang, "English")
            prompt = (
                f"You are an experimental agricultural information assistant for Indian farming contexts.\n"
                f"IMPORTANT: You MUST answer the farmer's question entirely in the {lang_name} language. Do not reply in English unless {lang_name} is English.\n"
                f"Plot Context: {', '.join(ctx_intro) if ctx_intro else 'General Farm'}\n"
                f"Farmer Question: {request.question}\n\n"
                f"Reference snippets (demo corpus; attribution unverified):\n{sources_text}\n\n"
                f"Rules:\n"
                f"1. Refer only to the supplied demonstration snippets and disclose that source attributions are unverified. Do not invent citations.\n"
                f"2. Never recommend uncalibrated or lethal chemical pesticide tank mixtures. Emphasize IPM, cultural sanitation, and bio-agents.\n"
                f"3. Provide direct, empathetic, and actionable guidance for an Indian smallholder farmer.\n"
            )
            response = genai_client.models.generate_content(
                model=GEMMA_MODEL_ID,
                contents=prompt
            )
            if response and response.text:
                llm_answer = response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini/Gemma generation failed: {e}. Falling back to grounded synthesis.")

    # 3. Grounded deterministic synthesis fallback if LLM is offline or unconfigured
    if not llm_answer:
        answer_parts = []
        if ctx_intro and lang == "hi":
            answer_parts.append(f"🌾 **खेत की वर्तमान स्थिति**: {', '.join(ctx_intro)}.\n")
        elif ctx_intro and lang == "bn":
            answer_parts.append(f"🌾 **জমির বর্তমান পরিস্থিতি**: {', '.join(ctx_intro)}.\n")
        elif ctx_intro:
            answer_parts.append(f"🌾 **Plot Context**: {', '.join(ctx_intro)}.\n")

        for i, p in enumerate(selected, 1):
            content = p.get(lang_key) or p.get("content_en", "")
            answer_parts.append(f"**[Source {i}: {p['title']}]**\n{content}\n")

        # Actionable next steps
        if lang == "hi":
            answer_parts.append(
                "🌱 **सिफारिश**: रासायनिक दवाओं का अनावश्यक उपयोग न करें। पहले प्राकृतिक व जैविक विधियों (जैसे नीम का अर्क, उचित जल निकासी और फसल चक्र) को अपनाएं।"
            )
        elif lang == "bn":
            answer_parts.append(
                "🌱 **পরামর্শ**: রাসায়নিক ওষুধের অপ্রয়োজনীয় ব্যবহার এড়িয়ে চলুন। প্রাকৃতিক জৈব পদ্ধতি এবং সঠিক ফসলের পর্যায়ক্রম অনুসরণ করুন।"
            )
        else:
            answer_parts.append(
                "🌱 **Actionable Guidance**: Prioritize cultural sanitation, correct spacing, and bio-agents before resorting to synthetic chemicals. Monitor foliage daily for changes."
            )
        llm_answer = "\n".join(answer_parts)

    return AdvisoryResponse(
        advisory_id=f"adv_{uuid.uuid4().hex[:10]}",
        question=request.question,
        answer=llm_answer,
        sources=citations,
        language=lang,
        safety_disclaimer=SAFETY_DISCLAIMER,
        generation_source="gemma_4_api" if genai_client is not None and llm_answer else "local_demo_fallback",
        is_demo_data=not (genai_client is not None and llm_answer),
        extension_helpline=HELPLINE_CONTACT,
        created_at=datetime.datetime.utcnow().isoformat()
    )


async def stream_advisory_chunks(
    request: AdvisoryRequest,
    plot_context: Optional[Dict[str, Any]] = None,
    weather_context: Optional[Dict[str, Any]] = None,
    soil_context: Optional[Dict[str, Any]] = None,
    scan_context: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """Streaming responses via Server-Sent Events (SSE) for low-latency feedback on mobile connections."""
    import json
    response_obj = generate_advisory_response(request, plot_context, weather_context, soil_context, scan_context)
    words = response_obj.answer.split(" ")

    for i in range(0, len(words), 3):
        chunk = " ".join(words[i:i+3]) + " "
        yield f"data: {chunk}\n\n"
        await asyncio.sleep(0.03)

    # Send final complete payload with sources
    yield f"event: end\ndata: {json.dumps(response_obj.model_dump())}\n\n"
