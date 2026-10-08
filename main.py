import os
from dotenv import load_dotenv
load_dotenv()
import duckdb
import numpy as np
import networkx as nx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from contextlib import asynccontextmanager
from google import genai
import json
import logging

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = duckdb.connect()
    app.state.db.execute("CREATE VIEW IF NOT EXISTS dataset AS SELECT * FROM 'dataset.parquet'")
    
    app.state.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    
    keys_env = os.getenv("GEMINI_API_KEYS", "")
    app.state.api_keys = [k.strip() for k in keys_env.split(",") if k.strip()]
    app.state.key_index = 0
    
    yield
    app.state.db.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_next_gemini_client(app: FastAPI):
    if not hasattr(app.state, 'api_keys') or not app.state.api_keys:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEYS not configured in environment.")
    key = app.state.api_keys[app.state.key_index]
    app.state.key_index = (app.state.key_index + 1) % len(app.state.api_keys)
    return genai.Client(api_key=key)

@app.get("/api/search")
async def search(query: str, limit: int = 20):
    model = app.state.model
    db = app.state.db
    
    query_emb = model.encode([query])[0]
    
    res = db.execute("SELECT id, title, subreddit, author, created_utc, bot_suspicion_score, embedding FROM dataset").df()
    if len(res) == 0:
        return []
    embeddings = np.stack(res['embedding'].values)
    
    query_norm = np.linalg.norm(query_emb)
    emb_norms = np.linalg.norm(embeddings, axis=1)
    
    norms = query_norm * emb_norms
    norms[norms == 0] = 1e-10
    
    similarities = np.dot(embeddings, query_emb) / norms
    res['similarity_score'] = similarities
    
    res_sorted = res.sort_values('similarity_score', ascending=False)
    
    top_score = res_sorted.iloc[0]['similarity_score']
    if top_score < 0.35:
        try:
            client = get_next_gemini_client(app)
            prompt = f"The user searched for '{query}' in a political dataset, but no matches were found. Suggest 3 valid, alternative US political search queries (e.g., 'border policy', 'inflation', 'foreign relations'). Return ONLY a JSON array of 3 strings."
            response = client.models.generate_content(
                model='gemini-2.5-flash', 
                contents=prompt
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:-3]
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:-3]
            
            suggestions = json.loads(raw_text)
        except Exception as e:
            logging.error(f"Gemini API Error: {e}")
            suggestions = ['border policy', 'inflation', 'foreign relations']
            
        return {
            "status": "404_SEMANTIC",
            "message": "No highly relevant posts found.",
            "suggestions": suggestions
        }
            
    top_matches = res_sorted.head(limit).drop(columns=['embedding'])
    return top_matches.to_dict(orient='records')

@app.get("/api/clusters")
async def clusters(k: int = 10):
    db = app.state.db
    df = db.execute("SELECT id, x_coord, y_coord, subreddit, bot_suspicion_score FROM dataset").df()
    
    if len(df) == 0:
        return []
    
    df['x_coord'] = df['x_coord'].astype(float)
    df['y_coord'] = df['y_coord'].astype(float)
    
    coords = df[['x_coord', 'y_coord']].values
    kmeans = KMeans(n_clusters=k, random_state=42, n_init='auto')
    df['cluster_id'] = kmeans.fit_predict(coords)
    
    return df.to_dict(orient='records')

class NetworkRequest(BaseModel):
    exclude_nodes: List[str] = []

@app.post("/api/network")
async def network(req: NetworkRequest):
    db = app.state.db
    
    query = "SELECT author, subreddit, bot_suspicion_score FROM dataset WHERE author IS NOT NULL AND author != ''"
    params = []
    
    if req.exclude_nodes:
        placeholders = ", ".join(["?"] * len(req.exclude_nodes))
        query += f" AND author NOT IN ({placeholders}) AND subreddit NOT IN ({placeholders})"
        params.extend(req.exclude_nodes)
        params.extend(req.exclude_nodes)
        
    df = db.execute(query, params).df()
    if len(df) == 0:
        return {"nodes": [], "edges": []}
    
    G = nx.Graph()
    bot_scores = dict(zip(df['author'], df['bot_suspicion_score']))
    
    for _, row in df.iterrows():
        author = row['author']
        sub = row['subreddit']
        G.add_node(author, type='author', bot_suspicion_score=bot_scores.get(author, 0))
        G.add_node(sub, type='subreddit')
        G.add_edge(author, sub)
        
    pagerank = nx.pagerank(G)
    
    nodes = []
    for node, data in G.nodes(data=True):
        node_type = data.get('type')
        nodes.append({
            "id": node,
            "type": node_type,
            "pagerank": pagerank.get(node, 0.0),
            "bot_suspicion_score": data.get('bot_suspicion_score', 0) if node_type == 'author' else None
        })
        
    nodes.sort(key=lambda x: x['pagerank'], reverse=True)
    top_100_nodes = nodes[:100]
    
    top_node_ids = set(n["id"] for n in top_100_nodes)
    super_edges = []
    for u, v in G.edges():
        if u in top_node_ids and v in top_node_ids:
            super_edges.append({"source": u, "target": v})
            
    return {"nodes": top_100_nodes, "edges": super_edges}

@app.get("/api/timeline")
async def timeline():
    db = app.state.db
    df = db.execute("SELECT subreddit, created_utc FROM dataset WHERE created_utc IS NOT NULL").df()
    import pandas as pd
    df['created_utc'] = pd.to_numeric(df['created_utc'], errors='coerce')
    df['date'] = pd.to_datetime(df['created_utc'], unit='s').dt.strftime('%b %d')
    top_subs = df['subreddit'].value_counts().head(4).index.tolist()
    df_filtered = df[df['subreddit'].isin(top_subs)]
    grouped = df_filtered.groupby(['date', 'subreddit']).size().unstack(fill_value=0).reset_index()
    # Sort dates chronologically: first we need real dates, but %b %d is a string sorting alphabetically.
    # It's better to sort by actual datetime before converting.
    df_filtered['date_obj'] = pd.to_datetime(df_filtered['created_utc'], unit='s').dt.date
    grouped = df_filtered.groupby(['date_obj', 'subreddit']).size().unstack(fill_value=0).reset_index()
    grouped = grouped.sort_values('date_obj')
    grouped['date'] = pd.to_datetime(grouped['date_obj']).dt.strftime('%b %d')
    grouped = grouped.drop(columns=['date_obj'])
    return grouped.to_dict(orient='records')

@app.get("/api/summary")
async def summary(query: str):
    db = app.state.db
    
    query_str = f"%{query}%"
    df = db.execute(
        "SELECT subreddit, created_utc FROM dataset WHERE full_text ILIKE ?", 
        [query_str]
    ).df()
    
    if len(df) == 0:
        return StreamingResponse(iter(["No data found to aggregate for this query."]), media_type="text/plain")
        
    import pandas as pd
    df['created_utc'] = pd.to_numeric(df['created_utc'], errors='coerce')
    df['date'] = pd.to_datetime(df['created_utc'], unit='s', errors='coerce').dt.date
    
    date_counts = df.groupby('date').size().sort_index()
    top_subs = df['subreddit'].value_counts().head(3).index.tolist()
    
    date_stats = ", ".join([f"{count} posts on {date}" for date, count in date_counts.items()])
    stats_str = f"Data shows {date_stats}. Top communities: {', '.join(top_subs)}."
    
    def generate():
        try:
            client = get_next_gemini_client(app)
            prompt = f"You are an impartial OSINT analyst. Based on these aggregated data trends: {stats_str}, write a 2-sentence journalistic summary explaining the narrative spike and the communities driving it. Remain objective and apolitical."
            response = client.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=prompt
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            logging.error(f"Gemini API Error: {e}")
            yield f"Unable to generate summary due to API Error or missing Keys: {e}"
            
    return StreamingResponse(generate(), media_type="text/plain")

@app.get("/api/summary/network")
async def summary_network():
    db = app.state.db
    # Get top 5 actors with highest bot_suspicion_score and centralities
    df = db.execute("SELECT author, subreddit, bot_suspicion_score FROM dataset WHERE author IS NOT NULL AND author != '' LIMIT 1000").df()
    if len(df) == 0:
        return StreamingResponse(iter(["No network data available."]), media_type="text/plain")

    G = nx.Graph()
    for _, row in df.iterrows():
        G.add_edge(row['author'], row['subreddit'])
    
    pagerank = nx.pagerank(G)
    top_authors = sorted([n for n, d in G.nodes(data=True) if n not in df['subreddit'].values], key=lambda x: pagerank.get(x, 0), reverse=True)[:5]
    
    stats_str = f"Top centralized authors driving traffic across subreddits: {', '.join(str(x) for x in top_authors)}."
    
    def generate():
        try:
            client = get_next_gemini_client(app)
            prompt = f"You are an impartial OSINT Trust & Safety analyst. Based on this Bipartite PageRank data: {stats_str}, write a 2-sentence journalistic summary explaining the Coordinated Inauthentic Behavior (CIB) risk. Use Trust & Safety terminology (e.g. amplification, cross-community coordination)."
            response = client.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=prompt
            )
            for chunk in response:
                if chunk.text: yield chunk.text
        except Exception as e:
            yield f"Unable to generate summary: {e}"
            
    return StreamingResponse(generate(), media_type="text/plain")

@app.get("/api/summary/clusters")
async def summary_clusters(k: int = 10):
    stats_str = f"The semantic space was divided into {k} ideological clusters."
    def generate():
        try:
            client = get_next_gemini_client(app)
            prompt = f"You are an impartial OSINT Trust & Safety analyst. Based on a K-Means clustering of {k} semantic islands, write a 2-sentence brief on how algorithmic sorting isolates communities into disjointed ideological spaces, making them vulnerable to targeted manipulation."
            response = client.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=prompt
            )
            for chunk in response:
                if chunk.text: yield chunk.text
        except Exception as e:
            yield f"Unable to generate summary: {e}"
            
    return StreamingResponse(generate(), media_type="text/plain")

@app.get("/api/cib_events")
async def cib_events():
    db = app.state.db
    query = """
        SELECT author, url, COUNT(DISTINCT subreddit) as sub_count, 
               CAST(MAX(created_utc) - MIN(created_utc) AS INTEGER) as time_delta_seconds
        FROM dataset 
        WHERE url IS NOT NULL AND url != '' AND url != 'None' AND author != '[deleted]'
        GROUP BY author, url 
        HAVING sub_count >= 2
        ORDER BY sub_count DESC, time_delta_seconds ASC
        LIMIT 20
    """
    df = db.execute(query).df()
    return df.to_dict(orient='records')
