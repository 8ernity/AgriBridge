# Model Sources, Licenses & External Services

This inventory describes model assets and services used by the repository. It is not legal advice or a guarantee that every upstream dataset's terms permit every deployment. Runtime model status is also recorded in `models/registry/`.

## AI Models

| Model / component | Source and use | License / terms | Runtime status |
|---|---|---|---|
| Whisper Small multilingual | [`Systran/faster-whisper-small`](https://huggingface.co/Systran/faster-whisper-small), converted from [`openai/whisper-small`](https://github.com/openai/whisper) | MIT for Whisper code and weights; Systran conversion repo declares MIT. | Local backend CPU inference (`faster-whisper`, int8). Weights download from Hugging Face on first use. Audio is temporarily staged and deleted after processing. |
| BGE-small-en-v1.5 | Base model [`BAAI/bge-small-en-v1.5`](https://huggingface.co/BAAI/bge-small-en-v1.5); FastEmbed maps its model ID to [`Qdrant/bge-small-en-v1.5-onnx-Q`](https://huggingface.co/Qdrant/bge-small-en-v1.5-onnx-Q). | BAAI base model: MIT. Qdrant ONNX export repository metadata: Apache-2.0. | Local ONNX inference through FastEmbed; downloaded on first use. FastEmbed's artifact revision is not pinned in this app. English-only semantic retrieval; keyword fallback otherwise. |
| Gemma 4 `gemma-4-26b-a4b-it` | [Google DeepMind Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4); [Gemma on Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). | Gemma 4 open weights: Apache-2.0. Hosted calls also follow [Gemini API terms](https://ai.google.dev/gemini-api/terms). | Hosted inference for advisory chat and post-scan guidance on confident predictions; `GEMINI_API_KEY` is required. Text prompts containing predicted crop, condition, and language are sent to Google; the uploaded scan image is not sent by this guidance call. Successful scan guidance is labelled Gemma 4; local fallback is separately marked demo. |
| PlantVillage MobileNetV3-Small | [imaflower/plantvillage-mobilenetv3](https://huggingface.co/imaflower/plantvillage-mobilenetv3/tree/d76fe187be1c4c3a5474f835a7a70cd08c7ab085), pinned revision `d76fe187be1c4c3a5474f835a7a70cd08c7ab085`. ONNX SHA-256 `c6a962f699ddc820108231b23454b6a4e242407044c2c2514a0f6294d35428fc`; external weights SHA-256 `c03d114add89db13d850e5bbe0a7c09040cf6caf1acfbbd489c21234fa6dcb5e`. | Upstream Hugging Face model card declares **MIT**. The upstream repository has no standalone `LICENSE` file; AgriBridge preserves source attribution and the pinned source metadata. | Bundled local CPU inference. 15 PlantVillage classes: tomato, potato, and bell pepper. Upstream performance claims and dataset provenance have not been independently reproduced; field performance may be lower. Other crops are unsupported. |
| ConvGeM-NeXt research candidate | [Arshad et al. (2026)](https://doi.org/10.3389/fpls.2026.1763739), ConvNeXt-Base + GeM pooling, reported 27 PlantDoc classes. | Paper: CC BY 4.0. No public checkpoint or separately licensed implementation identified; article license does **not** license absent code/weights. PlantDoc repository declares CC BY 4.0; exact PlantVillage copy and derivative-weight rights need verification. | Research reference only; not integrated. See `docs/DETECTOR_MODEL_REVIEW.md` and `models/registry/crop_disease_research_review.json`. |
| Improved Vision Mamba research candidate | [Zhang and Liu (2026)](https://doi.org/10.3389/fpls.2026.1842426), 12-layer Vision Mamba with MFFM, ACAM, and LRC, reported 27 PlantDoc classes. | Paper: CC BY 4.0. No public checkpoint or separately licensed implementation identified; article license does **not** license absent code/weights. PlantDoc repository declares CC BY 4.0; derivative-weight rights need verification. | Fallback/reference only; not integrated. Reported RTX 4090 timing is not a CPU benchmark. See the model review and registry. |
| Former MobileNetV3 ONNX | Removed binary SHA-256: `96C8E7CDE166B8B428C886820E9F972EE9AC3FE92D0BC7A8CE6129887A73EA10`; it had no source or license metadata. | **Unverified; not redistributed.** | Replaced by the pinned MIT-declared model above. |

## Demonstration Content and Synthetic Values

- Bundled agronomy passages have not been verified against their claimed publishers, exact publications, or reuse licenses. They are demonstration excerpts, not verified citations or agronomic instructions.
- NDVI values are synthetic. The app may query Sentinel-2 STAC scene metadata, but it does not download or process red and near-infrared band pixels to calculate NDVI.
- Seeded plots and outbreak reports, environmental fallbacks, scan placeholders, and carbon calculations are synthetic or illustrative; see `docs/EVALUATION.md`.

## External Services and API Calls

| Service | Purpose / data flow | Notice |
|---|---|---|
| Google Gemini API | Optional Gemma 4 advisory generation and scan guidance. | Requires a server-side key; sends prompts and included text context to Google. Post-scan guidance is only requested after a confident classifier result and does not include the image. Not used for voice transcription. |
| Hugging Face Hub | First-use downloads of Whisper Small and FastEmbed's BGE ONNX artifact. | Inference is local after download; model download requires network access. |
| Open-Meteo | Weather and precipitation requests. | Review current [API terms](https://open-meteo.com/en/terms) and attribution requirements before deployment. Synthetic fallbacks are labeled. |
| ISRIC SoilGrids | Soil property estimates. | [CC BY 4.0](https://www.isric.org/explore/soilgrids); external service terms and attribution apply. |
| Element 84 Earth Search | Sentinel-2 STAC metadata only. | [Catalog/API source](https://github.com/Element84/earth-search); metadata is not used to calculate NDVI. |
| OpenStreetMap tile service | Optional map tiles. | OSM data is [ODbL](https://www.openstreetmap.org/copyright); tile service usage policy and attribution apply. |
| Esri World Imagery | Optional satellite basemap tiles in the map UI. | Proprietary third-party map service; Esri terms apply. It is not an AI inference service. |
| Google Fonts | External font stylesheet. | Browser contacts Google Fonts when online; fonts are presentation assets, not AI inference. |

No other hosted AI inference endpoint is called by the application. Browser speech recognition has been removed; browser speech synthesis is only an optional read-aloud accessibility feature and is not used to recognize or send user speech.

## Key Handling

Create `.env` from `.env.example` and set `GEMINI_API_KEY` locally. `.env` and `.env.*` are ignored by Git; `.env.example` is intentionally allowed. Never put credentials in source, frontend code, model cards, logs, or commits. Hosted inference is optional; without a key, the app returns the local demo fallback.
