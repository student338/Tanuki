# Tanuki AI Backend - uWSGI Python container
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uwsgi flask openai requests

COPY docker/uwsgi.ini /app/uwsgi.ini
COPY docker/ai_backend/ /app/ai_backend/

RUN mkdir -p /var/log/uwsgi

EXPOSE 5000

CMD ["uwsgi", "--ini", "/app/uwsgi.ini"]
