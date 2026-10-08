"""Model Registry Service serving open model cards for AgriBridge."""
import os
import glob
import json
from typing import List, Dict, Any, Optional

MODELS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "registry")
)


class ModelRegistryService:
    """Provides transparency and metadata for deployed AI models."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        self._cards: Dict[str, Dict[str, Any]] = {}
        self.reload_cards()

    def reload_cards(self):
        self._cards.clear()
        if not os.path.exists(self.models_dir):
            return

        json_files = glob.glob(os.path.join(self.models_dir, "*.json"))
        for fpath in json_files:
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    card = json.load(f)
                    model_id = card.get("id")
                    if model_id:
                        self._cards[model_id] = card
            except Exception as e:
                print(f"Error loading model card {fpath}: {e}")

    def list_models(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "task": c.get("task"),
                "version": c.get("version"),
                "license": c.get("license"),
                "architecture": c.get("architecture"),
                "format": c.get("format"),
                "model_source": c.get("model_source"),
                "license_url": c.get("license_url"),
                "availability_status": c.get("availability_status"),
                "inference_mode": c.get("inference_mode")
            }
            for c in self._cards.values()
        ]

    def get_card(self, model_id: str) -> Optional[Dict[str, Any]]:
        # Allow exact match or partial match
        if model_id in self._cards:
            return self._cards[model_id]
        for mid, card in self._cards.items():
            if model_id.lower() in mid.lower():
                return card
        return None


model_registry_service = ModelRegistryService()
