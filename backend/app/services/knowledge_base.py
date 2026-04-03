"""
Knowledge Base — ChromaDB vector store for the chatbot's factual memory.

Embeds workforce stats, recognition analytics, KPI definitions, platform
capabilities, and industry benchmarks. Rebuilt from scratch on every data
reload so answers are never stale.
"""

import logging
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from ..config import settings

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_collection() -> chromadb.Collection:
    global _client, _collection
    if _collection is not None:
        return _collection

    _client = chromadb.Client(ChromaSettings(anonymized_telemetry=False))
    _collection = _client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


# ── Document builders ────────────────────────────────────────────────

def _build_workforce_docs(data_cache: dict) -> list[tuple[str, str, dict]]:
    """Build documents from workforce data. Returns list of (id, text, metadata)."""
    docs: list[tuple[str, str, dict]] = []
    emp = data_cache.get("employees")
    if emp is None or emp.empty:
        return docs

    import pandas as pd
    active = emp[emp["is_active"]]
    departed = emp[~emp["is_active"]]
    total = len(emp)
    active_count = len(active)
    dep_count = len(departed)
    turnover = round(dep_count / total * 100, 1) if total else 0
    avg_tenure = round(float(emp["tenure_years"].mean()), 1)
    med_tenure = round(float(emp["tenure_years"].median()), 1)

    docs.append((
        "wf-overview",
        f"Workforce Overview: {total} total employees, {active_count} active, "
        f"{dep_count} departed. Turnover rate: {turnover}%. "
        f"Average tenure: {avg_tenure} years, median: {med_tenure} years. "
        f"Departments: {emp['department_name'].nunique()}. "
        f"Countries: {emp['country'].nunique() if 'country' in emp.columns else 'N/A'}.",
        {"source": "workforce", "domain": "overview"},
    ))

    # Department profiles
    dept_stats = emp.groupby("department_name").agg(
        total=("is_active", "count"),
        active=("is_active", "sum"),
        avg_tenure=("tenure_years", "mean"),
    ).round(1)
    for dept, row in dept_stats.iterrows():
        dep_n = int(row["total"] - row["active"])
        t_rate = round(dep_n / row["total"] * 100, 1) if row["total"] else 0
        docs.append((
            f"wf-dept-{dept}",
            f"Department: {dept}. Total: {int(row['total'])}, Active: {int(row['active'])}, "
            f"Departed: {dep_n}. Turnover: {t_rate}%. Avg tenure: {row['avg_tenure']} years.",
            {"source": "workforce", "domain": "department", "department": str(dept)},
        ))

    # Grade distribution
    if "grade_band" in active.columns:
        grade_dist = active.groupby("grade_band").size()
        grade_text = ", ".join(f"{band}: {count}" for band, count in grade_dist.items())
        docs.append((
            "wf-grades",
            f"Grade distribution (active employees): {grade_text}.",
            {"source": "workforce", "domain": "grades"},
        ))

    # Career mobility
    if "num_role_changes" in active.columns:
        avg_rc = round(float(active["num_role_changes"].mean()), 1)
        avg_tir = int(active["time_in_current_role_days"].mean())
        stuck_3y = int((active["time_in_current_role_days"] > 1095).sum())
        docs.append((
            "wf-careers",
            f"Career mobility: avg {avg_rc} role changes per active employee. "
            f"Avg time in current role: {avg_tir} days. "
            f"{stuck_3y} employees stuck 3+ years in same role "
            f"({round(stuck_3y / active_count * 100, 1)}% of active).",
            {"source": "workforce", "domain": "careers"},
        ))

    # Manager metrics
    span = data_cache.get("manager_span")
    if span is not None and not span.empty:
        avg_span = round(float(span["direct_reports"].mean()), 1)
        max_span = int(span["direct_reports"].max())
        docs.append((
            "wf-managers",
            f"Manager metrics: {len(span)} total managers. "
            f"Avg span of control: {avg_span} direct reports. Max: {max_span}.",
            {"source": "workforce", "domain": "managers"},
        ))

    # Tenure distribution
    tenure_bins = [0, 1, 3, 5, 10, float("inf")]
    labels = ["0-1yr", "1-3yr", "3-5yr", "5-10yr", "10yr+"]
    t_dist = pd.cut(emp["tenure_years"], bins=tenure_bins, labels=labels, right=False).value_counts().reindex(labels)
    t_text = ", ".join(f"{lbl}: {int(c)}" for lbl, c in t_dist.items())
    docs.append((
        "wf-tenure-dist",
        f"Tenure distribution: {t_text}.",
        {"source": "workforce", "domain": "tenure"},
    ))

    # Country breakdown
    if "country" in active.columns:
        country_dist = active.groupby("country").size().sort_values(ascending=False).head(10)
        c_text = ", ".join(f"{c}: {n}" for c, n in country_dist.items())
        docs.append((
            "wf-countries",
            f"Geographic distribution (active, top 10): {c_text}.",
            {"source": "workforce", "domain": "geography"},
        ))

    return docs


def _build_recognition_docs(recog_cache: dict) -> list[tuple[str, str, dict]]:
    """Build documents from recognition data."""
    docs: list[tuple[str, str, dict]] = []
    rdf = recog_cache.get("recognition")
    if rdf is None or rdf.empty:
        return docs

    from ..recognition_loader import compute_gini

    total = len(rdf)
    rcounts = rdf["recipient_title"].value_counts()
    gini = round(compute_gini(rcounts.values.tolist()), 3)

    docs.append((
        "rec-overview",
        f"Recognition overview: {total} total awards. "
        f"Unique recipients: {rdf['recipient_title'].nunique()}. "
        f"Gini coefficient: {gini} (0=equal, 1=concentrated). "
        f"Avg specificity: {round(float(rdf['specificity'].mean()), 3)}/1.0.",
        {"source": "recognition", "domain": "overview"},
    ))

    # Category distribution
    if "category_name" in rdf.columns:
        cats = rdf["category_name"].value_counts()
        for cat, count in cats.items():
            pct = round(count / total * 100, 1)
            docs.append((
                f"rec-cat-{cat}",
                f"Recognition category: {cat}. Count: {count} ({pct}% of total).",
                {"source": "recognition", "domain": "categories", "category": str(cat)},
            ))

    # Direction analysis
    if "direction" in rdf.columns:
        direction = rdf["direction"].value_counts()
        d_text = ", ".join(f"{d}: {c}" for d, c in direction.items())
        docs.append((
            "rec-direction",
            f"Recognition flow direction: {d_text}.",
            {"source": "recognition", "domain": "flow"},
        ))

    # Function profiles
    if "recipient_function" in rdf.columns:
        for func in rdf["recipient_function"].unique():
            subset = rdf[rdf["recipient_function"] == func]
            avg_spec = round(float(subset["specificity"].mean()), 3)
            docs.append((
                f"rec-func-{func}",
                f"Function: {func}. Awards received: {len(subset)} ({round(len(subset)/total*100,1)}%). "
                f"Avg specificity: {avg_spec}.",
                {"source": "recognition", "domain": "function", "function": str(func)},
            ))

    # Seniority profiles
    if "recipient_seniority" in rdf.columns:
        for level in rdf["recipient_seniority"].unique():
            subset = rdf[rdf["recipient_seniority"] == level]
            docs.append((
                f"rec-sen-{level}",
                f"Seniority: {level}. Awards received: {len(subset)}. "
                f"Avg specificity: {round(float(subset['specificity'].mean()), 3)}.",
                {"source": "recognition", "domain": "seniority", "seniority": str(level)},
            ))

    return docs


def _build_platform_docs() -> list[tuple[str, str, dict]]:
    """Hardcoded platform capability descriptions."""
    pages = [
        ("Dashboard", "/", "overview dashboard with KPI cards, headcount chart, turnover chart, tenure chart, flight risk table",
         "summary, overview, health, KPIs"),
        ("Workforce", "/workforce", "headcount by department, business unit, function, location, grade distribution",
         "headcount, employees, departments, grades, locations"),
        ("Turnover", "/turnover", "attrition rates by every dimension, trends, tenure-at-departure, danger zones",
         "turnover, attrition, leaving, departures, retention"),
        ("Tenure", "/tenure", "average tenure, cohorts, distribution, long-tenured risk, short-tenure signals",
         "tenure, years of service, how long, cohorts"),
        ("Flight Risk", "/flight-risk", "ML-predicted flight risk scores, feature importance, risk by department",
         "risk, flight risk, leaving soon, retention risk"),
        ("Careers", "/careers", "promotion velocity, career paths, stuck employees, lateral vs upward moves",
         "careers, promotions, stuck, career paths, mobility"),
        ("Managers", "/managers", "span of control, report retention, manager churn, revolving door detection",
         "managers, span of control, direct reports, leadership"),
        ("Org Structure", "/org", "hierarchy depth, department growth/shrinkage, restructuring, layers",
         "organization, hierarchy, structure, layers, depth"),
        ("Categories", "/categories", "recognition taxonomy distribution across categories and subcategories",
         "categories, taxonomy, recognition types"),
        ("Quality", "/quality", "message specificity analysis, action verbs, clichés, word count",
         "quality, specificity, message quality, NLP"),
        ("Flow", "/flow", "recognition flow direction, cross-function recognition patterns, network analysis",
         "flow, direction, cross-function, network"),
        ("Inequality", "/inequality", "Gini coefficient, Lorenz curve, recognition concentration analysis",
         "inequality, Gini, fairness, concentration, Lorenz"),
        ("Data Hub", "/data-hub", "CSV upload, pipeline execution, taxonomy generation, data management",
         "upload, data, pipeline, taxonomy, import"),
        ("Settings", "/settings", "LLM provider configuration, model selection, API key management",
         "settings, configuration, LLM, model, API key"),
    ]
    docs = []
    for name, route, desc, topics in pages:
        docs.append((
            f"platform-{route.strip('/')}",
            f"The {name} page at route {route} shows {desc}. "
            f"Use this page when the user asks about {topics}.",
            {"source": "platform", "domain": "capabilities", "page": name},
        ))
    return docs


def _build_benchmark_docs() -> list[tuple[str, str, dict]]:
    """Industry benchmark documents."""
    benchmarks = [
        ("Turnover Rate", "15-20%", "BLS / SHRM annual surveys",
         "Average voluntary turnover across industries is 15-20%. Tech averages ~13%. Retail/hospitality can exceed 60%."),
        ("Average Tenure", "4.1 years", "Bureau of Labor Statistics",
         "US median employee tenure is 4.1 years. Tech sector averages 3.2 years. Government averages 6.5 years."),
        ("Span of Control", "5-8 direct reports", "McKinsey / Deloitte",
         "Optimal span of control is 5-8 direct reports. Below 4 suggests overhead. Above 10 suggests overload."),
        ("Gini Coefficient", "<0.3 healthy", "Organizational behavior research",
         "Gini below 0.3 indicates healthy distribution. 0.3-0.5 is moderate inequality. Above 0.5 is concentrated."),
        ("Promotion Velocity", "2-3 years per level", "Industry average",
         "Typical time between promotions is 2-3 years. Faster in startups (1-2yr). Slower in large enterprises (3-5yr)."),
    ]
    docs = []
    for metric, value, source, context in benchmarks:
        docs.append((
            f"benchmark-{metric.lower().replace(' ', '-')}",
            f"Industry benchmark for {metric}: {value}. Source: {source}. {context}",
            {"source": "benchmark", "domain": "benchmarks"},
        ))
    return docs


def _build_kpi_docs() -> list[tuple[str, str, dict]]:
    """KPI definition documents."""
    kpis = [
        ("Turnover Rate", "workforce", "departed / total employees x 100", "Percentage of total workforce that has departed"),
        ("Voluntary Turnover", "workforce", "voluntary departures / avg headcount x 100", "Departures initiated by the employee"),
        ("Tenure at Departure", "workforce", "(Expire - Hire) for departed employees", "How long departed employees stayed before leaving"),
        ("Span of Control", "managers", "count of direct reports per manager", "Number of employees reporting to each manager"),
        ("Flight Risk Score", "predictions", "LogisticRegression(tenure, time_in_role, manager_changes, title_changes)", "ML-predicted probability of departure"),
        ("Promotion Velocity", "careers", "avg days between consecutive title changes", "Speed at which employees progress through titles"),
        ("Gini Coefficient", "recognition", "Lorenz-curve-based inequality measure of recognition distribution", "0=perfectly equal, 1=one person gets all recognition"),
        ("Specificity Score", "recognition", "NLP scoring: action verbs +0.15, numbers +0.3, length bonus, cliché penalty", "Quality of recognition message — higher is more specific"),
        ("Cross-Function Rate", "recognition", "percentage of awards where nominator and recipient are in different functions", "Measures recognition across organizational boundaries"),
        ("Stuck Employee Count", "careers", "active employees with time_in_current_role > 3 years", "Employees who may be stagnating in their current role"),
    ]
    docs = []
    for name, domain, formula, meaning in kpis:
        docs.append((
            f"kpi-{name.lower().replace(' ', '-')}",
            f"KPI: {name}. Domain: {domain}. Formula: {formula}. Meaning: {meaning}.",
            {"source": "kpi", "domain": domain, "kpi_name": name},
        ))
    return docs


# ── Public API ───────────────────────────────────────────────────────

def rebuild_knowledge_base(data_cache: dict, recog_cache: dict | None = None) -> int:
    """Wipe and rebuild the entire knowledge base from current data."""
    collection = _get_collection()
    existing = collection.count()
    if existing > 0:
        all_ids = collection.get()["ids"]
        if all_ids:
            collection.delete(ids=all_ids)

    all_docs: list[tuple[str, str, dict]] = []
    all_docs.extend(_build_workforce_docs(data_cache))
    if recog_cache:
        all_docs.extend(_build_recognition_docs(recog_cache))
    all_docs.extend(_build_platform_docs())
    all_docs.extend(_build_benchmark_docs())
    all_docs.extend(_build_kpi_docs())

    if not all_docs:
        logger.warning("No documents to embed in knowledge base")
        return 0

    ids = [d[0] for d in all_docs]
    documents = [d[1] for d in all_docs]
    metadatas = [d[2] for d in all_docs]

    batch_size = 100
    for i in range(0, len(ids), batch_size):
        collection.upsert(
            ids=ids[i : i + batch_size],
            documents=documents[i : i + batch_size],
            metadatas=metadatas[i : i + batch_size],
        )

    total = collection.count()
    logger.info(f"Knowledge base rebuilt: {total} documents embedded")
    return total


def search(query: str, n_results: int = 5, where: dict | None = None) -> list[dict[str, Any]]:
    """Semantic search over the knowledge base."""
    collection = _get_collection()
    if collection.count() == 0:
        return []

    kwargs: dict[str, Any] = {
        "query_texts": [query],
        "n_results": min(n_results, collection.count()),
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)
    output = []
    for i, doc_id in enumerate(results["ids"][0]):
        output.append({
            "id": doc_id,
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "distance": results["distances"][0][i] if results["distances"] else None,
        })
    return output


def get_doc_count() -> int:
    """Return the number of documents in the knowledge base."""
    try:
        return _get_collection().count()
    except Exception:
        return 0
