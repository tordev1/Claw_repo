# Mode: AI/ML Product
## Overview
ML-powered application with model training/serving, feature engineering, A/B testing infrastructure, and GPU orchestration.
## Architecture Template
- Model Serving: FastAPI + ONNX or TorchServe
- Training: PyTorch/TensorFlow + MLflow for tracking
- Feature Store: Feast or custom
- Infrastructure: Kubernetes + GPU nodes
- Monitoring: Evidently AI for drift detection
- Experimentation: Weights & Biases
## Task Breakdown Template
1. Data collection + labeling pipeline
2. Feature engineering
3. Model training + evaluation
4. Model serving API
5. A/B testing framework
6. Monitoring + drift detection
7. GPU infra setup
8. Integration with product
## Team Composition
- ML Engineering: 2 workers
- Backend: 1 worker
- Data Engineering: 1 worker
- DevOps: 1 worker (GPU infra)
- Performance: 1 worker
## Model Recommendations
- ML Engineering: claude-sonnet (complex ML code)
- Data Engineering: claude-sonnet
## Common Pitfalls
- Training/serving skew
- GPU cost overruns
- Model latency in production
- Data labeling quality
