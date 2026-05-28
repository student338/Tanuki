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


def _auth_headers(content_type=None):
    """Build common authorization headers for upstream requests."""
    headers = {"Authorization": "Bearer " + UPSTREAM_API_KEY}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """Proxy chat completions to the upstream AI model server."""
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    is_stream = body.get("stream", False)

    try:
        resp = requests.post(
            f"{UPSTREAM_URL}/chat/completions",
            json=body,
            headers=_auth_headers("application/json"),
            timeout=120,
            stream=is_stream,
        )

        if is_stream:
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
    try:
        resp = requests.get(
            f"{UPSTREAM_URL}/models",
            headers=_auth_headers(),
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
