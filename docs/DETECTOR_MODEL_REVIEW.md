# Crop Disease Detector Model Review

Reviewed 2026-10-04. This records what can be integrated safely from the two supplied papers; it does not claim that AgriBridge reproduces their results.

## Decision

Neither paper provides an openly licensed, downloadable disease-classification checkpoint or a separately licensed implementation that can be integrated and verified here. The articles themselves are CC BY 4.0, but that license applies to the articles; it does not establish redistribution rights for unpublished code or model weights. Do not replace the currently bundled detector with randomly initialized or reconstructed-but-untrained weights.

The current pinned MobileNetV3-Small ONNX model remains the only runnable detector. AgriBridge now reports `Unknown / Low Confidence` when its existing confidence/quality gate rejects a prediction, and returns an empty prediction list when local inference is unavailable instead of manufacturing equal-probability classes. Its supported labels remain limited to the 15 registry classes.

## ConvGeM-NeXt

- Paper: Arshad et al., [“ConvGeM-next: a deep learning framework for plant disease detection”](https://doi.org/10.3389/fpls.2026.1763739), *Frontiers in Plant Science* (2026), CC BY 4.0.
- Method: ConvNeXt-Base backbone, learnable generalized-mean pooling, and a BatchNorm/ReLU/dropout classifier head. The paper reports about 89M parameters and 27 PlantDoc classes.
- Reported result: the paper highlights 94.69% PlantDoc accuracy in one table, but its repeated-run table reports 92.19% ± 2.58%. Treat 94.69% as a paper-reported result, not an independently verified expectation. Training is described on a Google Cloud TPU v3-8; the reported runtime/accuracy does not establish practical CPU latency for AgriBridge.
- Availability and rights: the article links PlantVillage and PlantDoc datasets but does not publish a model checkpoint or code repository/license. The PlantDoc dataset repository states CC BY 4.0. The paper does not resolve the exact redistribution terms for its PlantVillage source or resulting weights. Do not redistribute a ConvGeM-NeXt checkpoint until the authors and data terms are verified.

## Improved Vision Mamba reference

- Paper: Zhang and Liu, [“Multi-scale feature fusion-based vision mamba for robust plant disease image classification on field-acquired PlantDoc data”](https://doi.org/10.3389/fpls.2026.1842426), *Frontiers in Plant Science* (2026), CC BY 4.0.
- Method: 12-layer Vision Mamba with multi-scale feature fusion (MFFM), adaptive channel attention (ACAM), lightweight residual connections (LRC), and a 27-class head.
- Reported result: 92.67% PlantDoc accuracy for the headline run; the paper also reports 92.41% ± 0.24% across five folds. It reports 31.4M parameters, 7.2 GFLOPs, and 8.4 ms/image on an RTX 4090. Those results do not establish CPU or AgriBridge-hardware performance.
- Availability and rights: the article says further details are available from the corresponding author; it does not provide a public model checkpoint or licensed implementation. Article CC BY does not grant rights to unprovided code/weights. PlantDoc is identified as the evaluation dataset; redistribution of a resulting checkpoint still needs explicit review.

## Data references

- PlantDoc classification set: [original repository](https://github.com/pratikkayal/PlantDoc-Dataset), whose README identifies CC BY 4.0. It is a small, web-sourced field dataset; check source-image and attribution requirements before redistributing derivatives.
- PlantVillage: [dataset source cited by ConvGeM-NeXt](https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset). The paper does not state a precise license for that copy. Verify the exact dataset revision and terms before training or redistributing weights derived from it.

## Requirements before replacing the current model

1. Obtain the exact checkpoint and source code from the authors or reproduce training from a fixed dataset snapshot.
2. Obtain written clarification of code, checkpoint, and each dataset's redistribution/commercial terms; record revisions and SHA-256 hashes.
3. Export to ONNX and benchmark CPU and supported GPU providers on AgriBridge's target hardware.
4. Calibrate an abstention threshold on a held-out field set, including non-leaf and unsupported-crop images; preserve an explicit unknown outcome.
5. Run end-to-end API tests and report independently reproduced per-class field metrics before enabling the model by default.
