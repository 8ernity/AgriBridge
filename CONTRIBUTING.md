# Contributing to AgriBridge 🌱

Thank you for your interest in contributing to **AgriBridge**, an open-source digital public good designed to empower smallholder farmers worldwide.

## 🤝 Code of Conduct
We are committed to providing a friendly, safe, and welcoming environment for all. Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## 🚀 How to Contribute

1. **Fork the Repository** and clone your fork locally.
2. **Create a Topic Branch**:
   ```bash
   git checkout -b feature/environmental-adapter-extension
   ```
3. **Set Up Development Environment**:
   - Backend: Python 3.11 with `pip install -r backend/requirements.txt`
   - Frontend: Node 18+ with `cd frontend && npm install`
4. **Make Changes adhering to standards**:
   - Python code must follow PEP 8 and include type hints.
   - React components must be accessible (WCAG 2.1 AA targets, touch targets >= 48px).
   - Ensure all third-party datasets or models comply with our [Licensing Register](docs/DATA_LICENSES.md).
5. **Run Tests**:
   ```bash
   cd backend && pytest
   ```
6. **Submit a Pull Request** with a clear explanation of your additions or fixes.

