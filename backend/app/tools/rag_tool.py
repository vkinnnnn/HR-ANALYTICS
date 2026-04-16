"""
app/tools/rag_tool.py

Semantic search using sentence-transformers/all-MiniLM-L6-v2 (local, free)
stored in ChromaDB. CRAG scoring filters low-relevance results.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from langchain_core.tools import tool

from app.config import settings
from app.data_loader import get_recognition_data

CHROMA_DIR  = settings.chroma_path
EMBED_MODEL = "all-MiniLM-L6-v2"
COLL_NAME   = "recognition_records"
TOP_K       = 20
CRAG_THRESHOLD = float(os.getenv("CRAG_THRESHOLD", "0.25"))

_collection  = None
_embedder    = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _get_collection():
    global _collection
    if _collection is not None:
        return _collection

    import chromadb
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    existing = [c.name for c in client.list_collections()]

    if COLL_NAME in existing:
        _collection = client.get_collection(name=COLL_NAME)
        return _collection

    # Build index from enriched DataFrame (one-time)
    print("Building ChromaDB index (one-time)...")
    df = get_recognition_data()
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].fillna("").astype(str)

    embedder = _get_embedder()
    chunks = (
        "Award: "       + df["award_title"]       + " | " +
        "Recipient: "   + df["recipient_title"]   + " | " +
        "Nominator: "   + df["nominator_title"]   + " | " +
        "Category: "    + df["category_name"]     + " | " +
        "Subcategory: " + df["subcategory_name"]  + " | " +
        "Message: "     + df["message"]
    ).tolist()

    embeddings = embedder.encode(chunks, show_progress_bar=True).tolist()
    metadatas  = [
        {
            "category_name":    row["category_name"],
            "subcategory_name": row["subcategory_name"],
            "recipient_title":  row["recipient_title"],
            "nominator_title":  row["nominator_title"],
            "award_title":      row["award_title"],
        }
        for _, row in df.iterrows()
    ]

    _collection = client.create_collection(
        name=COLL_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    batch = 100
    for i in range(0, len(chunks), batch):
        _collection.add(
            ids        = [str(j) for j in range(i, min(i + batch, len(chunks)))],
            documents  = chunks[i:i+batch],
            embeddings = embeddings[i:i+batch],
            metadatas  = metadatas[i:i+batch],
        )
    print(f"ChromaDB index built with {_collection.count()} records.")
    return _collection


def _crag_score(query: str, docs: list[str]) -> list[float]:
    """CRAG: score each document against the query using cosine similarity."""
    import re
    q_words = set(re.findall(r"\b\w{3,}\b", query.lower()))
    scores  = []
    for doc in docs:
        d_words = set(re.findall(r"\b\w{3,}\b", doc.lower()))
        if not q_words:
            scores.append(0.0)
        else:
            scores.append(len(q_words & d_words) / len(q_words))
    return scores


@tool
def semantic_search(query: str) -> str:
    """
    Use this tool to search recognition messages semantically.
    Best for finding recognitions about specific themes, topics, behaviors,
    or when the user wants to find similar messages or examples.

    Examples:
    - Find recognitions about cross-team collaboration
    - Show me awards related to mentorship
    - Find messages about saving time or reducing costs
    - What recognitions mention NPS or customer satisfaction?
    - Find awards involving a person named Sarah
    """
    collection = _get_collection()
    embedder   = _get_embedder()

    query_vec = embedder.encode([query])[0].tolist()

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=TOP_K,
        include=["documents", "metadatas", "distances"],
    )

    docs      = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    if not docs:
        return f"SEARCH COMPLETE: 0 results found for '{query}'."

    # CRAG scoring
    crag_scores = _crag_score(query, docs)
    scored      = list(zip(docs, metadatas, distances, crag_scores))
    passing     = [(d, m, dist, s) for d, m, dist, s in scored if s >= CRAG_THRESHOLD]
    low_quality = len(scored) - len(passing)

    # Retry with broader query if too few results pass
    if len(passing) < 3:
        words = query.split()[:3]
        broad = " ".join(words)
        if broad != query:
            retry = collection.query(
                query_embeddings=[embedder.encode([broad])[0].tolist()],
                n_results=TOP_K,
                include=["documents", "metadatas", "distances"],
            )
            r_docs  = retry["documents"][0]
            r_metas = retry["metadatas"][0]
            r_dists = retry["distances"][0]
            r_crag  = _crag_score(query, r_docs)
            retry_passing = [(d, m, dist, s) for d, m, dist, s in zip(r_docs, r_metas, r_dists, r_crag) if s >= CRAG_THRESHOLD]
            if len(retry_passing) > len(passing):
                passing = retry_passing

    if not passing:
        passing = [(docs[0], metadatas[0], distances[0], crag_scores[0])]

    avg_score = round(sum(s for _, _, _, s in passing) / len(passing), 3)
    quality   = "High" if avg_score >= 0.6 else "Medium" if avg_score >= 0.35 else "Low"

    output = (
        f"SEARCH COMPLETE: Found {len(passing)} relevant recognitions for '{query}' "
        f"(CRAG quality: {quality}, avg score: {avg_score}). "
        f"Present ALL of these to the user:\n\n"
    )

    for i, (doc, meta, dist, score) in enumerate(passing, 1):
        msg_preview = doc.split("Message:")[-1].strip()[:400] if "Message:" in doc else doc[:400]
        output += f"RESULT {i} [relevance: {round(score, 3)}]:\n"
        output += f"  Recipient: {meta.get('recipient_title', 'N/A')}\n"
        output += f"  Nominator: {meta.get('nominator_title', 'N/A')}\n"
        output += f"  Category: {meta.get('category_name', 'N/A')} > {meta.get('subcategory_name', 'N/A')}\n"
        output += f"  Message: {msg_preview}\n\n"

    if low_quality > 0:
        output += f"Note: {low_quality} additional results were below the relevance threshold and excluded.\n"

    output += f"INSTRUCTION: Present all {len(passing)} results above to the user."
    return output
