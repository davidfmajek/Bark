import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from flask import Flask, jsonify
from flask_cors import CORS
from summarize import (
    InvalidEstablishmentIdError,
    get_reviews_for_establishment,
    build_summary_prompt,
    generate_summary,
    save_summary,
)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))


@app.errorhandler(InvalidEstablishmentIdError)
def handle_invalid_establishment_id(e):
    return jsonify({"error": str(e)}), 400


@app.route("/")
def index():
    return {"message": "BARK API. Use the frontend at http://localhost:5173", "health": "/api/health"}


@app.route("/api/health")
def health():
    return {"status": "ok"}


@app.route("/api/debug/reviews/<establishment_id>")
def debug_reviews(establishment_id):
    return {"reviews": get_reviews_for_establishment(establishment_id)}


@app.route("/api/debug/prompt/<establishment_id>")
def debug_prompt(establishment_id):
    reviews = get_reviews_for_establishment(establishment_id)
    prompt = build_summary_prompt(reviews)
    return {"prompt": prompt}


@app.route("/api/debug/summary/<establishment_id>")
def debug_summary(establishment_id):
    reviews = get_reviews_for_establishment(establishment_id)
    prompt = build_summary_prompt(reviews)
    summary = generate_summary(prompt)
    return {"summary": summary}


@app.route("/api/spots/<establishment_id>/summarize", methods=["POST"])
def summarize_establishment(establishment_id):
    reviews = get_reviews_for_establishment(establishment_id)

    if len(reviews) == 0:
        return jsonify({"error": "No eligible reviews to summarize"}), 400

    prompt = build_summary_prompt(reviews)
    summary = generate_summary(prompt)
    save_summary(establishment_id, summary, reviews)

    return jsonify({
        "establishment_id": establishment_id,
        "summary": summary,
        "review_count": len(reviews),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)