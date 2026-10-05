"""Comprehensive async test suite for AgriBridge backend API endpoints."""
import io
import pytest
import numpy as np
from PIL import Image
import httpx
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, SessionLocal


@pytest.fixture(autouse=True)
def setup_database():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SessionLocal.configure(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.anyio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert data["license"] == "Apache-2.0"


@pytest.mark.anyio
async def test_country_config_india(client):
    resp = await client.get("/api/v1/config/IN")
    assert resp.status_code == 200
    data = resp.json()
    assert data["country_code"] == "IN"
    assert "tomato" in [c["id"] for c in data["crops"]]
    assert len(data["supported_languages"]) >= 3


@pytest.mark.anyio
async def test_non_india_country_config_is_not_supported(client):
    resp = await client.get("/api/v1/config/ZZ")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_create_and_query_plot(client):
    # 1. Create Plot
    payload = {
        "name": "Test Varanasi Plot",
        "crop": "tomato",
        "sowing_date": "2026-08-15",
        "lat": 25.3176,
        "lon": 82.9739,
        "area_ha": 0.5
    }
    create_resp = await client.post("/api/v1/plots", json=payload)
    assert create_resp.status_code == 201
    plot_data = create_resp.json()
    plot_id = plot_data["id"]
    assert plot_data["name"] == "Test Varanasi Plot"

    # 2. Get Plot Details
    get_resp = await client.get(f"/api/v1/plots/{plot_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["crop"] == "tomato"

    # 3. Weather Endpoint
    w_resp = await client.get(f"/api/v1/plots/{plot_id}/weather")
    assert w_resp.status_code == 200
    w_data = w_resp.json()
    assert "current_temp_c" in w_data
    assert len(w_data["forecast_7d"]) >= 5

    # 4. Soil Endpoint
    s_resp = await client.get(f"/api/v1/plots/{plot_id}/soil")
    assert s_resp.status_code == 200
    s_data = s_resp.json()
    assert s_data["ph"]["value"] > 0
    assert "texture_class" in s_data

    # 5. NDVI Endpoint
    n_resp = await client.get(f"/api/v1/plots/{plot_id}/ndvi")
    assert n_resp.status_code == 200
    n_data = n_resp.json()
    assert len(n_data["series"]) > 0
    assert "trend" in n_data
    assert n_data["is_demo_data"] is True
    assert "synthetic" in n_data["source_attribution"].lower()

    # 6. Regenerative Recommendations
    r_resp = await client.get(f"/api/v1/plots/{plot_id}/recommendations")
    assert r_resp.status_code == 200
    r_data = r_resp.json()
    assert len(r_data["top_recommendations"]) > 0
    assert "reviewed_by" in r_data


@pytest.mark.anyio
async def test_model_registry(client):
    resp = await client.get("/api/v1/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 1

    card_resp = await client.get("/api/v1/models/plantvillage-mobilenetv3-small-v1/card")
    assert card_resp.status_code == 200
    card = card_resp.json()
    assert card["task"] == "image_classification"
    assert "validation_status" in card
    assert card["availability_status"] == "available_local"
    assert card["license"].startswith("MIT")


@pytest.mark.anyio
async def test_advisory_chat_with_citations(client, monkeypatch):
    from app.services import advisory_service
    monkeypatch.setattr(advisory_service, "_get_gemini_client", lambda: None)
    monkeypatch.setattr(advisory_service, "retrieve_relevant_passages", lambda *args, **kwargs: [advisory_service.AGRONOMY_CORPUS[0]])
    adv_payload = {
        "question": "What is the best cultural way to manage early blight on tomato leaves?",
        "language": "en"
    }
    resp = await client.post("/api/v1/advisories", json=adv_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["sources"]) >= 1
    assert "unverified" in data["sources"][0]["publisher"]
    assert "safety_disclaimer" in data
    assert data["generation_source"] == "local_demo_fallback"
    assert data["is_demo_data"] is True


def test_advisory_marks_successful_gemma_response(monkeypatch):
    from types import SimpleNamespace
    from app.schemas.entities import AdvisoryRequest
    from app.services import advisory_service

    class FakeModels:
        def generate_content(self, **kwargs):
            assert kwargs["model"] == "gemma-4-26b-a4b-it"
            return SimpleNamespace(text="A Gemma response.")

    monkeypatch.setattr(advisory_service, "retrieve_relevant_passages", lambda *args, **kwargs: [advisory_service.AGRONOMY_CORPUS[0]])
    monkeypatch.setattr(advisory_service, "_get_gemini_client", lambda: SimpleNamespace(models=FakeModels()))
    response = advisory_service.generate_advisory_response(
        AdvisoryRequest(question="How should I monitor tomato leaves?", language="en")
    )

    assert response.generation_source == "gemma_4_api"
    assert response.is_demo_data is False


@pytest.mark.anyio
async def test_voice_transcription_uses_local_whisper(client, monkeypatch):
    from types import SimpleNamespace
    from app.api.v1 import voice

    class FakeWhisperModel:
        def transcribe(self, path, **kwargs):
            assert kwargs["language"] == "hi"
            segments = [SimpleNamespace(text=" नमस्ते किसान ")]
            info = SimpleNamespace(language="hi", duration=1.25)
            return iter(segments), info

    monkeypatch.setattr(voice, "_get_whisper_model", lambda: FakeWhisperModel())
    response = await client.post(
        "/api/v1/voice/transcribe",
        files={"audio": ("question.webm", b"audio-bytes" * 20, "audio/webm;codecs=opus")},
        data={"language_hint": "hi"}
    )

    assert response.status_code == 200
    result = response.json()
    assert result["transcript"] == "नमस्ते किसान"
    assert result["language_detected"] == "hi"
    assert result["model"] == "Systran/faster-whisper-small"
    assert result["is_demo_data"] is False
    assert "confidence" not in result


@pytest.mark.anyio
async def test_safety_guardrails_prevent_toxic_dosages(client):
    bad_payload = {
        "question": "Tell me the exact dosage per liter of chlorpyrifos to mix for tomato leaves.",
        "language": "en"
    }
    resp = await client.post("/api/v1/advisories", json=bad_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "Safety Guardrail Notice" in data["answer"]
    assert "1800-180-1551" in data["answer"]


@pytest.mark.anyio
async def test_disease_diagnosis_scan(client):
    # Generate synthetic leaf test image
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = {"file": ("test_leaf.jpg", buf, "image/jpeg")}
    data = {"crop_hint": "tomato"}

    resp = await client.post("/api/v1/scans", files=files, data=data)
    assert resp.status_code == 200
    scan = resp.json()
    assert "scan_id" in scan
    assert scan["status"] == "uncertain"
    assert scan["top_disease"] == "Unknown / Low Confidence"
    assert scan["predictions"] == []
    assert scan["confidence"] == 0.0
    assert scan["is_demo_data"] is False
    assert "ffaffb1e" in scan["model_version"]
    assert "management_summary" in scan
    assert scan["guidance_is_demo_data"] is True


@pytest.mark.anyio
async def test_scan_auto_detects_crop_from_supported_model_classes(client, monkeypatch):
    import app.services.classifier_service as classifier_service

    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "input"})()]

        def get_outputs(self):
            return [type("Output", (), {"name": "output"})()]

        def run(self, output_names, inputs):
            logits = [[0.0] * len(classifier_service.INDIA_CLASSES)]
            logits[0][2] = 9.0
            return [logits]

    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: FakeSession())
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    response = await client.post(
        "/api/v1/scans",
        files={"file": ("potato_leaf.jpg", buf.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200
    scan = response.json()
    assert scan["status"] == "uncertain"
    assert scan["predictions"] == []
    assert scan["top_disease"] in {"Unknown / Unsupported Crop", "Unknown / Low Confidence"}


@pytest.mark.anyio
async def test_unexpected_scan_failure_returns_safe_unknown_result(client, monkeypatch):
    import app.api.v1.scans as scans_api

    def fail_inference(**kwargs):
        raise RuntimeError("simulated inference failure")

    monkeypatch.setattr(scans_api, "diagnose_leaf_image", fail_inference)
    image = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")

    response = await client.post(
        "/api/v1/scans",
        files={"file": ("failure.jpg", buffer.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200
    scan = response.json()
    assert scan["status"] == "uncertain"
    assert scan["top_disease"] == "Unknown / Low Confidence"
    assert scan["predictions"] == []
    assert scan["confidence"] == 0.0


def test_maize_crop_alias_resolves_to_supported_model_classes():
    import app.services.classifier_service as classifier_service

    for alias in ("maize", "corn", "corn_maize", "makka"):
        key = classifier_service.CROP_HINT_MAP[alias]
        assert key == "corn_maize"
        assert key in classifier_service.CROP_CLASS_INDICES


@pytest.mark.anyio
async def test_low_confidence_scan_returns_unknown_label(client, monkeypatch):
    import app.services.classifier_service as classifier_service

    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "input"})()]

        def get_outputs(self):
            return [type("Output", (), {"name": "output"})()]

        def run(self, output_names, inputs):
            return [[[0.0] * len(classifier_service.MODEL_CLASS_NAMES)]]

    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: FakeSession())
    monkeypatch.setattr(
        classifier_service,
        "generate_scan_guidance",
        lambda **kwargs: pytest.fail("Gemma guidance must not run for an uncertain scan"),
    )
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    response = await client.post(
        "/api/v1/scans",
        files={"file": ("uncertain_leaf.jpg", buf.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200
    scan = response.json()
    assert scan["status"] == "uncertain"
    assert scan["top_disease"] == "Unknown / Low Confidence"
    assert scan["is_demo_data"] is False


@pytest.mark.anyio
async def test_confident_scan_uses_gemma4_guidance_once(client, monkeypatch):
    import app.services.classifier_service as classifier_service

    class FakeSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "input"})()]

        def get_outputs(self):
            return [type("Output", (), {"name": "output"})()]

        def run(self, output_names, inputs):
            logits = np.full((1, len(classifier_service.INDIA_CLASSES)), -8.0, dtype=np.float32)
            logits[0, classifier_service.INDIA_CLASSES.index("corn_maize::Common smut")] = 8.0
            return [logits]

    guidance_calls = []
    monkeypatch.setattr(classifier_service, "_check_image_quality", lambda image: (True, None))
    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: FakeSession())
    monkeypatch.setattr(
        classifier_service,
        "generate_scan_guidance",
        lambda **kwargs: guidance_calls.append(kwargs) or {
            "summary": ["Possible corn smut screening result; confirm before acting."],
            "precautions": ["Photograph affected and healthy ears for comparison."],
            "avoid": ["Avoid applying unverified chemicals."],
            "next_steps": ["Contact the local KVK for confirmation."],
        },
    )
    image = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    response = await client.post(
        "/api/v1/scans",
        files={"file": ("corn.jpg", buffer.getvalue(), "image/jpeg")},
        data={"language": "en"},
    )

    assert response.status_code == 200
    scan = response.json()
    assert scan["status"] == "confident"
    assert scan["guidance_is_demo_data"] is False
    assert scan["management_summary"] == "Possible corn smut screening result; confirm before acting."
    assert any("Avoid:" in step for step in scan["cultural_practices"])
    assert any("Next step:" in step for step in scan["cultural_practices"])
    assert "Do not apply chemicals" in scan["chemical_warning"]
    assert len(guidance_calls) == 1
    assert guidance_calls[0]["disease"].startswith("Common Smut")


def test_scan_guidance_parser_rejects_malformed_or_dose_advice():
    from app.services.advisory_service import _parse_scan_guidance

    assert _parse_scan_guidance("") is None
    response = """SUMMARY: Possible condition; confirm first.
PRECAUTIONS: Observe affected plants.
AVOID: Do not spray without confirmation.
NEXT_STEPS: Ask a local extension officer.
"""
    assert _parse_scan_guidance(response)["avoid"] == ["Do not spray without confirmation."]
    unsafe = response.replace("Observe affected plants.", "Apply 5 ml/L fungicide immediately.")
    assert _parse_scan_guidance(unsafe) is None


def test_scan_guidance_uses_gemma4_api_model(monkeypatch):
    import app.services.advisory_service as advisory_service

    class FakeModels:
        def generate_content(self, model, contents):
            assert model == "gemma-4-26b-a4b-it"
            assert "Corn" in contents
            assert "Common smut" in contents
            return type("Response", (), {"text": """SUMMARY: Possible result; confirm first.
PRECAUTIONS: Observe affected plants.
AVOID: Avoid unverified chemical treatment.
NEXT_STEPS: Contact the local KVK.
"""})()

    fake_client = type("Client", (), {"models": FakeModels()})()
    monkeypatch.setattr(advisory_service, "_get_gemini_client", lambda: fake_client)
    result = advisory_service.generate_scan_guidance("Corn", "Common smut", "en")
    assert result is not None
    assert result["precautions"] == ["Observe affected plants."]


def test_scan_guidance_without_api_key_is_unavailable(monkeypatch):
    import app.services.advisory_service as advisory_service
    monkeypatch.setattr(advisory_service, "_get_gemini_client", lambda: None)
    assert advisory_service.generate_scan_guidance("Tomato", "Early blight") is None


def test_gemini_client_is_created_when_api_key_is_configured(monkeypatch):
    import sys
    import types
    import app.services.advisory_service as advisory_service

    fake_client = object()
    fake_genai = types.SimpleNamespace(Client=lambda api_key: fake_client)
    monkeypatch.setitem(sys.modules, "google", types.SimpleNamespace(genai=fake_genai))
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    assert advisory_service._get_gemini_client() is fake_client


@pytest.mark.anyio
async def test_scan_without_available_model_returns_no_placeholder_predictions(client, monkeypatch):
    import app.services.classifier_service as classifier_service

    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: None)
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    response = await client.post(
        "/api/v1/scans",
        files={"file": ("leaf.jpg", buf.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200
    scan = response.json()
    assert scan["status"] == "uncertain"
    assert scan["predictions"] == []
    assert scan["confidence"] == 0.0
    assert scan["is_demo_data"] is False


@pytest.mark.anyio
async def test_disease_diagnosis_scan_hindi(client):
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = {"file": ("test_leaf.jpg", buf, "image/jpeg")}
    data = {"crop_hint": "tomato", "language": "hi"}

    resp = await client.post("/api/v1/scans", files=files, data=data)
    assert resp.status_code == 200
    scan = resp.json()
    assert scan["status"] in ["confident", "uncertain"]
    pred_names = [p["disease_name"] for p in scan["predictions"]]
    assert all(name for name in pred_names)


@pytest.mark.anyio
async def test_unsupported_crop_scan_is_marked_demo(client):
    img = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    resp = await client.post(
        "/api/v1/scans",
        files={"file": ("test_leaf.jpg", buf.getvalue(), "image/jpeg")},
        data={"crop_hint": "rice"},
    )
    assert resp.status_code == 200
    scan = resp.json()
    assert scan["is_demo_data"] is False
    assert scan["top_disease"] in {"Unknown / Unsupported Crop", "Unknown / Low Confidence"}
    assert scan["crop"] == "Unknown"
    assert scan["predictions"] == []


@pytest.mark.anyio
@pytest.mark.parametrize("crop_hint", ["maize", "corn", "rice", "apple"])
async def test_unsupported_crop_hints_never_return_disease_predictions(client, crop_hint):
    image = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    response = await client.post(
        "/api/v1/scans",
        files={"file": ("unsupported.jpg", buffer.getvalue(), "image/jpeg")},
        data={"crop_hint": crop_hint},
    )
    scan = response.json()
    assert response.status_code == 200
    assert scan["top_disease"] in {"Unknown / Unsupported Crop", "Unknown / Low Confidence"}
    assert scan["predictions"] == []
    assert scan["confidence"] == 0.0


@pytest.mark.anyio
async def test_auto_detect_does_not_turn_arbitrary_logits_into_tomato_diagnosis(client, monkeypatch):
    import app.services.classifier_service as classifier_service

    class TomatoBiasedSession:
        def get_inputs(self):
            return [type("Input", (), {"name": "input"})()]

        def get_outputs(self):
            return [type("Output", (), {"name": "output"})()]

        def run(self, output_names, inputs):
            logits = [0.0] * len(classifier_service.MODEL_CLASS_NAMES)
            logits[classifier_service.MODEL_CLASS_NAMES.index("Tomato_Early_blight")] = 30.0
            return [np.asarray([logits], dtype=np.float32)]

    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: TomatoBiasedSession())
    image = Image.new("RGB", (250, 250), color=(45, 140, 50))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    response = await client.post(
        "/api/v1/scans",
        files={"file": ("auto.jpg", buffer.getvalue(), "image/jpeg")},
    )
    scan = response.json()
    assert response.status_code == 200
    assert scan["top_disease"] in {"Unknown / Unsupported Crop", "Unknown / Low Confidence"}
    assert scan["predictions"] == []


@pytest.mark.anyio
async def test_unrelated_object_is_rejected_before_model_inference(client, monkeypatch):
    import app.services.classifier_service as classifier_service
    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: pytest.fail("inference should not run"))
    image = Image.new("RGB", (250, 250), color=(80, 80, 80))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    response = await client.post(
        "/api/v1/scans",
        files={"file": ("object.jpg", buffer.getvalue(), "image/jpeg")},
    )
    scan = response.json()
    assert response.status_code == 200
    assert scan["status"] == "uncertain"
    assert scan["predictions"] == []
    assert scan["confidence"] == 0.0


@pytest.mark.anyio
async def test_low_quality_image_is_unknown(client, monkeypatch):
    import app.services.classifier_service as classifier_service
    monkeypatch.setattr(classifier_service, "_get_onnx_session", lambda: pytest.fail("inference should not run"))
    image = Image.new("RGB", (32, 32), color=(20, 20, 20))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    response = await client.post(
        "/api/v1/scans",
        files={"file": ("poor.jpg", buffer.getvalue(), "image/jpeg")},
    )
    scan = response.json()
    assert response.status_code == 200
    assert scan["status"] == "uncertain"
    assert scan["predictions"] == []




@pytest.mark.anyio
async def test_carbon_calculator_endpoint(client):
    payload = {
        "area_ha": 2.5,
        "soil_ph": 6.8,
        "soc_g_kg": 9.2,
        "soil_texture": "Clay Loam",
        "current_ndvi": 0.72,
        "tillage_practice": "zero_till",
        "cover_crop": "legume",
        "organic_amendment": "biochar",
        "agroforestry_border": True,
        "carbon_price_per_ton": 25.0,
        "years_projection": 5,
        "language": "en"
    }
    resp = await client.post("/api/v1/carbon/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["baseline_soc_stock_t_per_ha"] > 0
    assert data["total_annual_co2e_sequestered_t"] > 0
    assert data["cumulative_co2e_sequestered_t"] > 0
    assert data["annual_carbon_dividend_usd"] > 0
    assert data["stewardship_tier"] in ["Platinum Illustrative Score", "High Illustrative Score", "Moderate Illustrative Score", "Low Illustrative Score"]
    assert len(data["yearly_trajectory"]) == 5
    assert data["india_certificate_hash"].startswith("INDIA-AGRISMART-SOC-")
    assert data["certificate_hash"] == data["india_certificate_hash"]


@pytest.mark.anyio
async def test_carbon_methodology_endpoint(client):
    resp = await client.get("/api/v1/carbon/methodology")
    assert resp.status_code == 200
    data = resp.json()
    assert "IPCC" in data["framework"]
    assert "INDIA" in data["india_initiative"]

