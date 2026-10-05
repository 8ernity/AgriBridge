# Backend Dockerfile for AgriBridge
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and configs
COPY backend/app ./app
COPY configs /configs
COPY models /models

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV HF_HUB_CACHE=/models/hf_cache

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
