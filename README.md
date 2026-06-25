<div align="center">

# 🌌 CodeCosmos

**Turn any GitHub profile into an explorable 3D universe.**

Repositories become stars, commits become asteroid belts, open pull requests become comets,
and the contribution graph becomes a nebula. Fly through your code.

Built by **Sheikh Farjad Ahmed**.

</div>

---

## What it does

- **Stars = repositories** — size scales with star count, colour is the repo's main language.
- **Orbit distance = repo age** — oldest repos ride the outer rings, newest sit close to the core.
- **Asteroid belts = commits** — a denser belt means more commits.
- **Comets = open pull requests** circling each repo.
- **Black hole = the user** at the centre, with a profile card.
- **Nebula = total contributions**, shaping a cloud around everything.
- Search any user, filter by language, lock onto a star (camera flies to it), switch between
  three colour themes, and export the view as a PNG.

## How it's built

A **decoupled full-stack app** — the token stays server-side, the browser just renders.

```
Browser ──▶ Frontend (Vite + React + React Three Fiber / Three.js)
                │  asks for JSON
                ▼
            Backend (Python + Flask) ──▶ GitHub GraphQL API
            (holds the token, caches, transforms the data)
```

| Layer | Tech |
|---|---|
| 3D engine | Three.js + React Three Fiber + drei + postprocessing (bloom) |
| Frontend | Vite, React 18 |
| Backend | Python, Flask, Flask-CORS |
| Data | GitHub GraphQL API |

---

## Run it locally

You need **Python 3.10+**, **Node.js 18+**, and a **GitHub Personal Access Token**
(create one at https://github.com/settings/tokens — a classic token with `read:user`
and `repo` scopes is fine).

### 1. Backend

```bash
cd backend
python -m venv venv

# activate it:
#   Windows:  venv\Scripts\activate
#   Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

# create your env file and paste your token into it
cp .env.example .env      # Windows: copy .env.example .env
#  then edit .env and set GITHUB_PAT=...

python app.py
```

The API runs at **http://localhost:8000**. Test it: open
`http://localhost:8000/api/galaxy/torvalds` — you should see JSON.

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install

cp .env.example .env.local   # Windows: copy .env.example .env.local

npm run dev
```

Open **http://localhost:5173**. It loads the `techbuildhub01-gif` profile by default —
type any username in the search bar to explore others.

---

## Controls

| Action | Control |
|---|---|
| Rotate | left-drag |
| Zoom | scroll |
| Lock onto a star | click it |
| Random star | press `R` |
| Release / recenter | press `Esc`, or the Recenter button |
| Legend | press `?`, or the Legend button |
| Save a picture | Export button |

---

## Deploying (optional)

- **Backend → Render.** New Web Service from this repo, root `backend`, start command
  `gunicorn app:app`. Set env vars `GITHUB_PAT`, `CORS_ORIGINS` (your frontend URL), `PORT`.
- **Frontend → Vercel.** Import the repo, root `frontend`, framework "Vite". Set
  `VITE_API_URL` to your Render backend URL.

Note: free backend tiers sleep when idle, so the first request after a pause can take
~30–60s to wake up.

---

## Ideas to extend it

- Ambient space audio (Web Audio API).
- A side list of repos that syncs with the 3D view.
- Compare two users side by side.
- A "time machine" slider that replays repos appearing by date.

---

<div align="center">
<sub>Inspired by the RepoNova concept — rebuilt from scratch with a Vite frontend,
an age-based orbit layout, a theme system, and original UI by Sheikh Farjad Ahmed.</sub>
</div>
