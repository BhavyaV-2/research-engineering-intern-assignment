# research-engineering-intern-assignment

# ARBITER Protocol — Anatomy of an Echo Chamber

An investigative OSINT-style dashboard for mapping manufactured polarization on Reddit using:
- **DuckDB** for fast, local analytics on a Parquet dataset
- **Multilingual sentence embeddings (MiniLM, 384D)** for semantic retrieval
- **UMAP + K-Means** for 2D projection and clustering of discourse
- **Bipartite PageRank network analysis** to surface high-leverage authors/communities
- **Gemini** for narrative “macro-synthesis” summaries (with rate-limit aware behavior)

---

## Live Deployments

- **Frontend (Vercel):** https://research-engineering-intern-assignment-3ou01mrw0.vercel.app  
- **Backend API (Hugging Face Space):** https://bhavyav2-arbiter-api.hf.space  
- **Backend Swagger (Docs):** https://bhavyav2-arbiter-api.hf.space/docs  
- **Demo video (3 min):** https://www.loom.com/share/b02f3d81dd1c421e917cf1b96aa89f37

---

## What this app does

### 1) Evidence Archive (Semantic Search)
Searches posts by **meaning**, not keywords, using multilingual embeddings.

### 2) Temporal Analysis (Narrative Velocity Over Time)
Aggregates posting activity over time by subreddit/community to detect spikes and coordination signatures.

### 3) Network Analysis (The Puppeteers)
Builds a bipartite author↔subreddit graph and computes PageRank to identify
high-centrality amplifiers and cross-community propagation patterns.

### 4) Semantic Map (The Semantic Divide)
Projects 384D embeddings into 2D UMAP space and clusters them to visualize ideological/semantic separation.

---

## API Endpoints (Backend)

Base URL: `https://bhavyav2-arbiter-api.hf.space`

- `GET /api/search?query=...` — semantic search results
- `GET /api/clusters?k=10` — UMAP + clustering outputs
- `POST /api/network` — bipartite network graph `{ nodes, edges }`
- `GET /api/timeline` — time-bucketed activity by subreddit
- `GET /api/summary?query=...` — Gemini macro-synthesis summary
- `GET /api/summary/network` — Gemini summary of network risk patterns
- `GET /api/summary/clusters?k=10` — Gemini summary of clustering/echo-chamber structure

---

## Local Development

### Backend (FastAPI)

```bash
# from repo root
python -m venv .venv
source .venv/bin/activate  # (Windows: .venv\Scripts\activate)

pip install -r requirements_phase2.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open: http://localhost:8000/docs

> Note: the backend expects `dataset.parquet` to be present in the backend working directory.

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open: http://localhost:3000

---

## Deployment Notes

### Backend (Hugging Face Spaces)
- Deployed as a **Docker Space**
- Uses a Hugging Face secret named `GEMINI_API_KEYS` (comma-separated, no spaces)

### Frontend (Vercel)
- Root directory set to `frontend`
- Environment variable: `NEXT_PUBLIC_API_URL` = backend base URL

---

## Testing

```bash
python -m pytest -q
```

---

## Tech Stack
- Python, FastAPI, Uvicorn
- DuckDB, Parquet
- SentenceTransformers (MiniLM), UMAP, scikit-learn
- NetworkX/PageRank
- Next.js, React Flow, Recharts
- Deploy: Hugging Face Spaces + Vercel
