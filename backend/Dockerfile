FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (build tools for any wheels)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -r requirements.txt

COPY . .

# Cloud Run provides $PORT; default to 8001 for local parity
ENV PORT=8001
EXPOSE 8001

# Graceful shutdown handled by uvicorn; single worker + async is ideal for Cloud Run
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --timeout-graceful-shutdown 20"]
