"""Country configuration loader and registry service for AgriBridge."""
import json
import os
import glob
from typing import Dict, Any, List, Optional

CONFIGS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "configs", "countries")
)


class CountryService:
    """Manages multi-country declarative configurations for digital public goods."""

    def __init__(self, configs_dir: str = CONFIGS_DIR):
        self.configs_dir = configs_dir
        self._configs: Dict[str, Dict[str, Any]] = {}
        self.reload_configs()

    def reload_configs(self):
        self._configs.clear()
        if not os.path.exists(self.configs_dir):
            return

        json_files = glob.glob(os.path.join(self.configs_dir, "*.json"))
        for fpath in json_files:
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    code = cfg.get("country_code", "").upper()
                    if code:
                        self._configs[code] = cfg
                        # Also allow matching by lowercase code or file stem
                        stem = os.path.splitext(os.path.basename(fpath))[0].lower()
                        self._configs[stem] = cfg
            except Exception as e:
                print(f"Error loading country config {fpath}: {e}")

    def list_countries(self) -> List[Dict[str, Any]]:
        seen = set()
        result = []
        for key, cfg in self._configs.items():
            code = cfg.get("country_code", "")
            if code not in seen:
                seen.add(code)
                result.append({
                    "country_code": code,
                    "country_name": cfg.get("country_name", code),
                    "default_locale": cfg.get("default_locale", "en"),
                    "supported_languages": cfg.get("supported_languages", []),
                    "default_coordinates": cfg.get("default_coordinates", {}),
                    "crop_count": len(cfg.get("crops", []))
                })
        return result

    def get_config(self, identifier: str) -> Optional[Dict[str, Any]]:
        norm = identifier.strip().upper()
        if norm in self._configs:
            return self._configs[norm]
        norm_lower = identifier.strip().lower()
        if norm_lower in self._configs:
            return self._configs[norm_lower]
        return None

    def get_crops_for_country(self, identifier: str) -> List[Dict[str, Any]]:
        cfg = self.get_config(identifier)
        if cfg:
            return cfg.get("crops", [])
        return []


country_service = CountryService()
