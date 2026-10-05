# Evaluation Status

This repository does not currently include reproducible evaluation datasets, scripts, or run artifacts for its advertised model metrics. Previous numerical accuracy, retrieval, latency, and safety benchmark claims have therefore been removed.

## Current checks

- Backend API tests exercise basic endpoint behavior and use a synthetic generated image for the scan request. They do not measure model accuracy.
- The pinned PlantVillage MobileNetV3-Small ONNX artifact is loaded locally; backend tests verify a real inference path but do not measure disease-classification accuracy. Upstream validation claims have not been independently reproduced, and field photos may differ from the curated dataset.
- Whisper and BGE model quality have not been independently benchmarked on AgriBridge farmer audio or queries.
- Gemma API responses are generated remotely when configured; the local fallback is deterministic demonstration text and is not a model response.
- The advisory corpus is demonstration content. Its source attribution, licensing, and factual claims have not been verified.
- Fallback weather, soil, outbreak, farm, disease-scan, and NDVI values are synthetic and should not be treated as observations.
- Carbon outputs are simplified estimates and are not field calibrated or suitable for carbon-credit certification.

## To publish model metrics

Provide dataset versions and licenses, exact train/validation/test splits, reproducible evaluation scripts, model hashes, environment details, and raw result files. Report field and laboratory performance separately, including class-level metrics and confidence intervals.
