"""
BARK — minimal Flask backend placeholder.
"""
import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env from backend/ or repo root
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))


@app.route("/")
def index():
    return {"message": "BARK API. Use the frontend at http://localhost:5173", "health": "/api/health"}


@app.route("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
