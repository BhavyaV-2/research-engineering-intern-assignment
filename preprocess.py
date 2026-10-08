import json
import logging
import pandas as pd
from sentence_transformers import SentenceTransformer
import umap.umap_ as umap
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def parse_jsonl(file_path: str) -> pd.DataFrame:
    records: List[Dict[str, Any]] = []
    
    # We will safely iterate and parse
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                row = json.loads(line)
                data = row.get("data", {})
                
                # Extract fields
                record = {
                    "id": data.get("id"),
                    "title": data.get("title", ""),
                    "selftext": data.get("selftext", ""),
                    "author": data.get("author_fullname") or data.get("author", ""),
                    "subreddit": data.get("subreddit", ""),
                    "created_utc": data.get("created_utc"),
                    "url": data.get("url", "")
                }
                records.append(record)
            except json.JSONDecodeError:
                logging.warning(f"Malformed JSON on line {line_num}, skipping.")
            except Exception as e:
                logging.warning(f"Error parsing line {line_num}: {e}, skipping.")
                
    df = pd.DataFrame(records)
    
    # Drop irrelevant columns (all extracted ones are relevant, but we drop rows with all empty)
    df.dropna(how='all', inplace=True)
    
    # Create full_text
    df['title'] = df['title'].fillna('')
    df['selftext'] = df['selftext'].fillna('')
    df['full_text'] = df['title'].astype(str) + " " + df['selftext'].astype(str)
    df['full_text'] = df['full_text'].str.strip()
    
    logging.info(f"Shape after parsing JSONL: {df.shape}")
    return df

def calculate_bot_scores(df: pd.DataFrame) -> pd.DataFrame:
    df['created_utc'] = pd.to_numeric(df['created_utc'], errors='coerce')
    df_sorted = df.sort_values(by=['author', 'created_utc']).copy()
    
    bot_scores = {}
    for author in df_sorted['author'].unique():
        if not author:
            continue
            
        score = 0
        author_data = df_sorted[df_sorted['author'] == author]
        
        # 1. Posting Velocity < 60s
        time_diffs = author_data['created_utc'].diff()
        min_time_diff = time_diffs.min()
        if pd.notna(min_time_diff) and min_time_diff < 60:
            score += 40
            
        # 2. Cross-Pollination 3+ subreddits
        unique_subs = author_data['subreddit'].nunique()
        if unique_subs >= 3:
            score += 30
            
        # 3. High URL Duplication
        author_urls = author_data[author_data['url'].str.strip() != ""]['url']
        if author_urls.duplicated().any():
            score += 30
            
        score = min(score, 100)
        bot_scores[author] = score
        
    df['bot_suspicion_score'] = df['author'].map(bot_scores).fillna(0).astype('int')
    
    logging.info(f"Shape after calculating bot scores: {df.shape}")
    return df

def generate_embeddings_and_umap(df: pd.DataFrame) -> pd.DataFrame:
    # Load model
    logging.info("Loading sentence-transformers model...")
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    
    texts = df['full_text'].tolist()
    
    logging.info("Generating embeddings in batches...")
    embeddings = model.encode(texts, batch_size=8, show_progress_bar=True)
    
    df['embedding'] = embeddings.tolist()
    
    logging.info("Running UMAP dimensionality reduction...")
    reducer = umap.UMAP(n_components=2, metric='cosine', random_state=42)
    embedding_2d = reducer.fit_transform(embeddings)
    
    df['x_coord'] = embedding_2d[:, 0]
    df['y_coord'] = embedding_2d[:, 1]
    
    logging.info(f"Shape after ML processing: {df.shape}")
    return df

def main():
    input_file = "data.jsonl"
    output_file = "dataset.parquet"
    
    logging.info("Starting Phase 1: Data Pre-processing Pipeline")
    
    # A. Parsing & Extraction
    df = parse_jsonl(input_file)
    if df.empty:
        logging.error("DataFrame is empty after parsing. Ensure data.jsonl is present and valid.")
        return
        
    # B. Bot Suspicion Heuristic
    df = calculate_bot_scores(df)
    
    # C. Machine Learning (Embeddings & UMAP)
    df = generate_embeddings_and_umap(df)
    
    # D. Export
    logging.info(f"Exporting data to {output_file}...")
    df.to_parquet(output_file, engine='pyarrow')
    logging.info("Pipeline completely executed.")

if __name__ == "__main__":  # pragma: no cover
    main()
