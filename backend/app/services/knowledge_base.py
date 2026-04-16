"""Knowledge Base — ChromaDB vector store."""

import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
import pandas as pd
from typing import Optional, List, Dict, Any

from ..config import settings

_collection = None

def _get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        try:
            client.delete_collection(name=settings.CHROMA_COLLECTION)
        except:
            pass
        embedding_fn = OpenAIEmbeddingFunction(
            api_key=settings.OPENAI_API_KEY, model_name="text-embedding-3-small"
        )
        _collection = client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION,
            embedding_function=embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )
    return _collection

def rebuild_knowledge_base(data_cache: Dict[str, Any]) -> int:
    """Build knowledge base from workforce + recognition data in unified cache."""
    collection = _get_collection()
    documents, metadatas, ids, doc_id = [], [], [], 0

    emp_df = data_cache.get("employees")
    if emp_df is not None and len(emp_df) > 0:
        active = emp_df["is_active"].sum()
        overview = f"Workforce: {len(emp_df)} employees ({active} active), avg tenure {emp_df[emp_df['is_active']]['tenure_years'].mean():.1f}yr, {emp_df['department_name'].nunique()} departments"
        documents.append(overview)
        metadatas.append({"source": "workforce", "domain": "headcount"})
        ids.append(f"doc_{doc_id}")
        doc_id += 1

    if "recognition_kpis" in data_cache:
        kpis = data_cache.get("recognition_kpis", {})
        rec_doc = f"Recognition Intelligence: {kpis.get('total_awards', 0)} awards to {kpis.get('unique_recipients', 0)} recipients from {kpis.get('unique_nominators', 0)} nominators, avg specificity {kpis.get('avg_specificity', 0):.3f}"
        documents.append(rec_doc)
        metadatas.append({"source": "recognition", "domain": "engagement"})
        ids.append(f"doc_{doc_id}")
        doc_id += 1
    
    # Platform capabilities
    capabilities = [
        "Workforce Analytics: headcount, tenure, turnover by dept/grade/location",
        "Recognition Intelligence: peer awards, collaboration patterns, culture metrics",
        "Flight Risk Prediction: identifies high-risk employees using tenure + role changes",
        "Manager Analytics: span of control, team retention, effectiveness metrics",
        "Career Progression: promotion velocity, grade advancement, career paths",
    ]
    for cap in capabilities:
        documents.append(cap)
        metadatas.append({"source": "capability", "domain": "platform"})
        ids.append(f"doc_{doc_id}")
        doc_id += 1
    
    if documents:
        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    
    return len(documents)

def search(query: str, n_results: int = 5) -> List[Dict[str, Any]]:
    """Semantic search over knowledge base."""
    collection = _get_collection()
    if collection.count() == 0:
        return []
    
    results = collection.query(query_texts=[query], n_results=n_results, include=["documents", "metadatas", "distances"])
    output = []
    if results and results["documents"]:
        for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
            output.append({"document": doc, "source": meta.get("source"), "similarity": 1 - dist})
    return output
