# Scan confidence calibration

The bundled PlantVillage MobileNetV3 model is not calibrated for field/OOD
images. Therefore the API intentionally returns `Unknown / Low Confidence` or
`Unknown / Unsupported Crop` and no disease probability distribution unless
`models/plantvillage-mobilenetv3/calibration.json` (or
`AGRIBRIDGE_SCAN_CALIBRATION_PATH`) contains a validated calibration record.
Do not create this file with guessed thresholds: supported crops will remain
unknown until a suitable held-out, labeled validation set is available.

The record must identify the exact `plantvillage-mobilenetv3-small@d76fe187`
model, include the SHA-256 of the immutable validation manifest, and include
measured `accepted_precision` and `ood_rejection_rate` each at least 0.95.
Threshold values must be chosen from those data, not from the test fixtures:

```json
{
  "calibration_status": "validated",
  "model_version": "plantvillage-mobilenetv3-small@d76fe187",
  "validation_manifest_sha256": "<sha256-of-held-out-manifest>",
  "validation_metrics": {
    "accepted_precision": 0.0,
    "ood_rejection_rate": 0.0
  },
  "temperature": 1.0,
  "minimum_crop_probability": 0.0,
  "minimum_crop_margin": 0.0,
  "minimum_disease_probability": 0.0,
  "minimum_disease_margin": 0.0,
  "minimum_energy": 0.0
}
```

The zeroes above are schema placeholders, not acceptable production thresholds.
Validation must include separate examples for tomato, potato, bell pepper,
healthy leaves, maize/corn, non-leaf objects, soil, and poor-quality images.
Split by source/field (not random near-duplicate images), select temperature
and abstention thresholds on calibration data, and report precision, coverage,
per-crop performance, and OOD rejection on a separate untouched test split.

Image color/texture checks are only inexpensive quality heuristics; they are
not a semantic crop classifier or a guarantee of OOD detection. The current
classifier's class vocabulary is limited to tomato, potato, and bell pepper.
No accuracy improvement is claimed. The test suite checks fail-closed behavior
and mocked logits, not real-world recognition accuracy.
