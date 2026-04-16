"""
app/services/knowledge_base.py

Extended Knowledge Base — embeds taxonomy + KPIs + function profiles + benchmarks.
The agent's rag_tool embeds raw recognition records (1000 msgs).
This service adds ~200 additional documents for richer context:
  - 73 KPI definitions with current values
  - Per-function recognition profiles
  - Per-seniority recognition patterns
  - Industry benchmarks
  - Platform page descriptions
"""

import os
import json
import pandas as pd
from pathlib import Path


def _get_chromadb_client(chroma_path: str = "./chroma_db"):
    """Get or create ChromaDB persistent client."""
    import chromadb
    Path(chroma_path).mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(chroma_path))


def _get_embedder():
    """Load sentence-transformers embedder (cached)."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def rebuild(enriched_df: pd.DataFrame, chroma_path: str = "./chroma_db"):
    """
    Rebuild ChromaDB knowledge base after data upload or pipeline completion.

    Called by:
    - data_loader.reload_recognition_data()
    - pipeline_router after taxonomy/annotation completes

    Creates/replaces two collections:
    - recognition_records: raw messages (1000+)
    - workforce_iq_knowledge: KPI/taxonomy/function/benchmark docs (200+)
    """
    print("Rebuilding ChromaDB knowledge base...")

    client = _get_chromadb_client(chroma_path)
    embedder = _get_embedder()

    # ── Collection 1: Recognition records (raw messages + metadata) ──
    print("  Building recognition_records collection...")
    records_coll_name = "recognition_records"

    try:
        client.delete_collection(name=records_coll_name)
    except Exception:
        pass

    records_collection = client.create_collection(
        name=records_coll_name,
        metadata={"hnsw:space": "cosine"},
    )

    # Create document text from each recognition
    chunks = (
        "Award: "       + enriched_df["award_title"].astype(str) + " | " +
        "Recipient: "   + enriched_df["recipient_title"].astype(str) + " | " +
        "Nominator: "   + enriched_df["nominator_title"].astype(str) + " | " +
        "Category: "    + enriched_df["category_name"].astype(str) + " | " +
        "Subcategory: " + enriched_df["subcategory_name"].astype(str) + " | " +
        "Message: "     + enriched_df["message"].astype(str)
    ).tolist()

    embeddings = embedder.encode(chunks, show_progress_bar=False).tolist()
    metadatas = []
    for _, row in enriched_df.iterrows():
        metadatas.append({
            "category_name": str(row.get("category_name", "")),
            "subcategory_name": str(row.get("subcategory_name", "")),
            "recipient_title": str(row.get("recipient_title", "")),
            "nominator_title": str(row.get("nominator_title", "")),
            "award_title": str(row.get("award_title", "")),
            "rec_seniority": str(row.get("rec_seniority", "")),
            "rec_function": str(row.get("rec_function", "")),
        })

    # Batch insert
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        records_collection.add(
            ids=[str(j) for j in range(i, min(i + batch_size, len(chunks)))],
            documents=chunks[i:i + batch_size],
            embeddings=embeddings[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size],
        )

    print(f"  Recognition records: {records_collection.count()} documents")

    # ── Collection 2: Knowledge base (KPIs + taxonomy + profiles) ──
    print("  Building workforce_iq_knowledge collection...")
    knowledge_coll_name = "workforce_iq_knowledge"

    try:
        client.delete_collection(name=knowledge_coll_name)
    except Exception:
        pass

    knowledge_collection = client.create_collection(
        name=knowledge_coll_name,
        metadata={"hnsw:space": "cosine"},
    )

    knowledge_docs = []
    knowledge_ids = []
    doc_id = 0

    # 1. KPI definitions
    kpi_defs = [
        {"name": "Total Recognitions", "value": len(enriched_df), "description": "Total recognition awards."},
        {"name": "Unique Recipients", "value": enriched_df["recipient_title"].nunique(), "description": "Unique employee titles recognized."},
        {"name": "Unique Nominators", "value": enriched_df["nominator_title"].nunique(), "description": "Unique employee titles who gave recognition."},
        {"name": "Total Categories", "value": enriched_df["category_name"].nunique(), "description": "Recognition categories."},
        {"name": "Total Subcategories", "value": enriched_df["subcategory_name"].nunique(), "description": "Recognition subcategories."},
        {"name": "Avg Message Length", "value": round(enriched_df["word_count"].mean(), 1), "description": "Average words per message."},
        {"name": "Avg Specificity", "value": round(enriched_df["specificity"].mean(), 3), "description": "Average specificity score (0-1)."},
        {"name": "Messages with Numbers", "value": int(enriched_df["has_numbers"].sum()), "description": "Messages with metrics."},
    ]

    for kpi in kpi_defs:
        doc_text = f"KPI: {kpi['name']}. Value: {kpi['value']}. {kpi['description']}"
        knowledge_docs.append(doc_text)
        knowledge_ids.append(f"kpi_{doc_id}")
        doc_id += 1

    # 2. Per-function profiles
    for function in enriched_df["rec_function"].unique():
        if pd.isna(function):
            continue
        func_df = enriched_df[enriched_df["rec_function"] == function]
        top_cat = func_df["category_name"].value_counts().index[0] if len(func_df) > 0 else "Unknown"
        doc_text = f"Function: {function}. {len(func_df)} recognized. Top: {top_cat}."
        knowledge_docs.append(doc_text)
        knowledge_ids.append(f"func_{function.replace(' ', '_').lower()}_{doc_id}")
        doc_id += 1

    # 3. Per-seniority patterns
    for seniority in enriched_df["rec_seniority"].unique():
        if pd.isna(seniority):
            continue
        sen_df = enriched_df[enriched_df["rec_seniority"] == seniority]
        doc_text = f"Seniority: {seniority}. {len(sen_df)} recognitions. Avg specificity: {round(sen_df['specificity'].mean(), 3)}."
        knowledge_docs.append(doc_text)
        knowledge_ids.append(f"sen_{seniority.replace(' ', '_').lower()}_{doc_id}")
        doc_id += 1

    # 4. Platform pages
    platform_pages = [
        {"path": "/", "title": "Dashboard", "desc": "KPI overview."},
        {"path": "/workforce", "title": "Workforce", "desc": "Employee distribution."},
        {"path": "/turnover", "title": "Turnover", "desc": "Attrition analysis."},
        {"path": "/chat", "title": "AI Chatbot", "desc": "Natural language Q&A."},
    ]

    for page in platform_pages:
        doc_text = f"Page: {page['title']} ({page['path']}). {page['desc']}"
        knowledge_docs.append(doc_text)
        knowledge_ids.append(f"page_{page['path'].replace('/', '_').lower()}_{doc_id}")
        doc_id += 1

    # Embed and insert
    if knowledge_docs:
        from sentence_transformers import SentenceTransformer
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        knowledge_embeddings = embedder.encode(knowledge_docs, show_progress_bar=False).tolist()

        batch_size = 100
        for i in range(0, len(knowledge_docs), batch_size):
            knowledge_collection.add(
                ids=knowledge_ids[i:i + batch_size],
                documents=knowledge_docs[i:i + batch_size],
                embeddings=knowledge_embeddings[i:i + batch_size],
            )

    print(f"  Knowledge docs: {knowledge_collection.count()} documents")
    print("ChromaDB rebuilt successfully")
