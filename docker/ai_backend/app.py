"""
Tanuki AI Backend - Flask WSGI application served via uWSGI.
Provides an OpenAI-compatible API proxy for local AI models.
"""

import os
from flask import Flask, request, jsonify, Response
import requests

app = Flask(__name__)

# Configuration from environment variables
UPSTREAM_URL = os.environ.get("AI_UPSTREAM_URL", "http://localhost:8000/v1")
UPSTREAM_API_KEY = os.environ.get("AI_UPSTREAM_API_KEY", "EMPTY")


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """Proxy chat completions to the upstream AI model server."""
    auth_value = "Bearer " + UPSTREAM_API_KEY
    headers = {
        "Content-Type": "application/json",
        "Authorization": auth_value,
    }

    try:
        resp = requests.post(
            f"{UPSTREAM_URL}/chat/completions",
            json=request.get_json(),
            headers=headers,
            timeout=120,
            stream=request.json.get("stream", False),
        )

        if request.json.get("stream", False):
            return Response(
                resp.iter_content(chunk_size=1024),
                content_type=resp.headers.get("Content-Type", "text/event-stream"),
                status=resp.status_code,
            )

        return jsonify(resp.json()), resp.status_code

    except requests.exceptions.ConnectionError:
        return jsonify({"error": "AI backend is not reachable"}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "AI backend timed out"}), 504


@app.route("/v1/models", methods=["GET"])
def list_models():
    """Proxy model listing to the upstream AI model server."""
    auth_value = "Bearer " + UPSTREAM_API_KEY
    headers = {"Authorization": auth_value}

    try:
        resp = requests.get(
            f"{UPSTREAM_URL}/models",
            headers=headers,
            timeout=10,
        )
        return jsonify(resp.json()), resp.status_code
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        return jsonify({"error": "AI backend is not reachable"}), 503


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
