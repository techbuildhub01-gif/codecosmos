"""
CodeCosmos backend — a small Flask API that fetches a GitHub user's data
via the GitHub GraphQL API and returns clean JSON for the 3D frontend.

The GitHub token lives ONLY here (server-side) so it is never exposed to
the browser. Set it in backend/.env  (see .env.example).
"""

import os
import re
import time

from flask import Flask, jsonify
from flask_cors import CORS

# Load variables from a local .env file if python-dotenv is installed.
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import requests

app = Flask(__name__)

# --- config (from environment) ---
GITHUB_PAT = os.getenv("GITHUB_PAT", "").strip()
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
CACHE_TTL = int(os.getenv("CACHE_TTL", "120"))  # seconds
GITHUB_GRAPHQL = "https://api.github.com/graphql"

CORS(app, resources={r"/api/*": {"origins": [o.strip() for o in CORS_ORIGINS.split(",")]}})

# Valid GitHub usernames: letters, digits, hyphens, max 39 chars.
USERNAME_RE = re.compile(r"^[A-Za-z0-9-]{1,39}$")

# Simple in-memory cache so repeated views don't hammer the GitHub API.
_cache = {}  # key: login.lower() -> (timestamp, data)

GRAPHQL_QUERY = """
query($login: String!) {
  rateLimit { remaining limit resetAt }
  user(login: $login) {
    login
    name
    avatarUrl
    bio
    url
    location
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, isFork: false, ownerAffiliations: OWNER,
                 orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        name
        description
        url
        stargazerCount
        forkCount
        isArchived
        createdAt
        pushedAt
        primaryLanguage { name color }
        pullRequests(states: OPEN) { totalCount }
        defaultBranchRef {
          target {
            ... on Commit {
              history { totalCount }
            }
          }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { contributionCount date weekday }
        }
      }
    }
  }
}
"""


def transform(raw):
    """Turn the raw GraphQL response into a compact shape the frontend wants."""
    user = raw.get("data", {}).get("user")
    if user is None:
        return None

    repos = []
    for n in user["repositories"]["nodes"]:
        commits = 0
        dbr = n.get("defaultBranchRef")
        if dbr and dbr.get("target") and dbr["target"].get("history"):
            commits = dbr["target"]["history"]["totalCount"]
        lang = n.get("primaryLanguage") or {}
        repos.append({
            "name": n["name"],
            "description": n.get("description") or "",
            "url": n["url"],
            "stars": n["stargazerCount"],
            "forks": n["forkCount"],
            "isArchived": n.get("isArchived", False),
            "createdAt": n["createdAt"],
            "pushedAt": n["pushedAt"],
            "language": lang.get("name"),
            "languageColor": lang.get("color") or "#8b949e",
            "openPRs": n["pullRequests"]["totalCount"],
            "commits": commits,
        })

    cal = user["contributionsCollection"]["contributionCalendar"]
    days = []
    for w in cal["weeks"]:
        for d in w["contributionDays"]:
            days.append({
                "count": d["contributionCount"],
                "date": d["date"],
                "weekday": d["weekday"],
            })

    langs = {}
    for r in repos:
        if r["language"]:
            langs[r["language"]] = langs.get(r["language"], 0) + 1
    top_languages = sorted(langs.items(), key=lambda kv: -kv[1])

    rate = raw.get("data", {}).get("rateLimit") or {}

    return {
        "user": {
            "login": user["login"],
            "name": user.get("name") or user["login"],
            "avatarUrl": user["avatarUrl"],
            "bio": user.get("bio") or "",
            "url": user["url"],
            "location": user.get("location") or "",
            "followers": user["followers"]["totalCount"],
            "following": user["following"]["totalCount"],
        },
        "repos": repos,
        "contributions": {
            "total": cal["totalContributions"],
            "days": days,
        },
        "stats": {
            "repoCount": user["repositories"]["totalCount"],
            "totalStars": sum(r["stars"] for r in repos),
            "totalForks": sum(r["forks"] for r in repos),
            "totalCommits": sum(r["commits"] for r in repos),
            "topLanguages": [{"name": k, "count": v} for k, v in top_languages],
        },
        "rateLimit": {
            "remaining": rate.get("remaining"),
            "limit": rate.get("limit"),
            "resetAt": rate.get("resetAt"),
        },
    }


@app.route("/")
def root():
    return jsonify({
        "name": "CodeCosmos API",
        "ok": True,
        "tokenConfigured": bool(GITHUB_PAT),
        "try": "/api/galaxy/torvalds",
    })


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "tokenConfigured": bool(GITHUB_PAT)})


@app.route("/api/galaxy/<login>")
def galaxy(login):
    login = (login or "").strip()
    if not USERNAME_RE.match(login):
        return jsonify({"error": "That doesn't look like a valid GitHub username."}), 400

    if not GITHUB_PAT:
        return jsonify({
            "error": "The server has no GitHub token. Add GITHUB_PAT to backend/.env and restart."
        }), 500

    now = time.time()
    cached = _cache.get(login.lower())
    if cached and now - cached[0] < CACHE_TTL:
        return jsonify({**cached[1], "cached": True})

    try:
        resp = requests.post(
            GITHUB_GRAPHQL,
            json={"query": GRAPHQL_QUERY, "variables": {"login": login}},
            headers={
                "Authorization": f"Bearer {GITHUB_PAT}",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
    except requests.RequestException as e:
        return jsonify({"error": f"Could not reach GitHub: {e}"}), 502

    if resp.status_code == 401:
        return jsonify({"error": "GitHub rejected the token (401). Check GITHUB_PAT in backend/.env."}), 502

    try:
        raw = resp.json()
    except ValueError:
        return jsonify({"error": "GitHub returned an unexpected (non-JSON) response."}), 502

    if raw.get("errors"):
        msg = raw["errors"][0].get("message", "Unknown GraphQL error")
        return jsonify({"error": f"GitHub GraphQL error: {msg}"}), 502

    data = transform(raw)
    if data is None:
        return jsonify({"error": f"GitHub user '{login}' was not found."}), 404

    _cache[login.lower()] = (now, data)
    return jsonify({**data, "cached": False})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
