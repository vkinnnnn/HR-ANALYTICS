"""
app/tools/graph_tool.py

Neo4j AuraDB graph queries with NetworkX fallback.
Neo4j graph schema:
  Nodes: RoleGroup {name, total_received, top_category}
         Role      {title, group}
         Category  {name}
         Subcategory {name, category}
  Relationships:
    (RoleGroup)-[:RECOGNIZED {count, top_category}]->(RoleGroup)
    (Role)-[:RECEIVED {award_title, category, subcategory}]->(Role)
"""

import re
import json
import pandas as pd
import networkx as nx
from functools import lru_cache
from langchain_core.tools import tool

from app.config import settings
from app.data_loader import get_recognition_data

NEO4J_URI        = settings.neo4j_uri
NEO4J_USERNAME   = settings.neo4j_username
NEO4J_PASSWORD   = settings.neo4j_password

_driver        = None
_nx_graph      = None
_neo4j_failed  = False


def _get_driver():
    global _driver, _neo4j_failed
    if _neo4j_failed:
        return None
    if _driver is not None:
        return _driver
    if not NEO4J_URI or not NEO4J_PASSWORD:
        return None
    try:
        from neo4j import GraphDatabase
        _driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USERNAME, NEO4J_PASSWORD),
            connection_timeout=5,
        )
        _driver.verify_connectivity()
        print("[graph_tool] Neo4j AuraDB connected.")
        return _driver
    except Exception as e:
        print(f"[graph_tool] Neo4j unavailable: {e} -- switching to NetworkX fallback.")
        _neo4j_failed = True
        _driver = None
        return None
    try:
        from neo4j import GraphDatabase
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
        _driver.verify_connectivity()
        print("[graph_tool] Neo4j AuraDB connected.")
        return _driver
    except Exception as e:
        print(f"[graph_tool] Neo4j unavailable: {e} — using NetworkX.")
        return None


def _run_cypher(cypher: str, params: dict = {}) -> list:
    driver = _get_driver()
    if not driver:
        return []
    with driver.session() as session:
        return [dict(r) for r in session.run(cypher, **params)]


def _extract_n(query: str, default: int = 10) -> int:
    m = re.search(r"top\s+(\d+)", query)
    if m:
        return int(m.group(1))
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
             "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    for w, n in words.items():
        if w in query:
            return n
    return default


# ── NetworkX fallback ─────────────────────────────────────────────────────────

def classify_role(title: str) -> str:
    if not title or pd.isna(title):
        return "Other"
    t = title.lower()
    if any(k in t for k in ["customer service", "customer success", "helpdesk"]):
        return "Customer Service"
    if any(k in t for k in ["engineer", "software", "qa", "technical", "devops", "architect"]):
        return "Engineering"
    if any(k in t for k in ["design", "creative", "ux", "ui", "copywriter", "content"]):
        return "Design/Creative"
    if any(k in t for k in ["account", "finance", "payroll", "buyer", "procurement", "financial"]):
        return "Finance/Admin"
    if any(k in t for k in ["director", "vp", "head of", "chief", "president", "senior director"]):
        return "Leadership"
    if any(k in t for k in ["hr", "hx", "people", "talent", "recruit"]):
        return "People/HR"
    if any(k in t for k in ["market", "brand", "media", "pr ", "communications"]):
        return "Marketing"
    if any(k in t for k in ["product", "program", "project"]):
        return "Product/Program"
    if any(k in t for k in ["data", "analy", "insight", "research"]):
        return "Data/Analytics"
    if any(k in t for k in ["sales", "business develop", "revenue"]):
        return "Sales/BD"
    return "Other"


@lru_cache(maxsize=1)
def _build_nx_graph() -> nx.DiGraph:
    df = get_recognition_data()
    G = nx.DiGraph()

    for _, row in df.iterrows():
        nom   = str(row.get("nominator_title", "")).strip()
        rec   = str(row.get("recipient_title", "")).strip()
        cat   = str(row.get("category_name", "")).strip()
        nom_g = classify_role(nom)
        rec_g = classify_role(rec)

        if not nom or not rec:
            continue
        for node, grp in [(nom, nom_g), (rec, rec_g)]:
            if not G.has_node(node):
                G.add_node(node, group=grp)
        if G.has_edge(nom_g, rec_g):
            G[nom_g][rec_g]["weight"] += 1
        else:
            G.add_edge(nom_g, rec_g, weight=1, top_category=cat)

    return G


def _nx_top_relationships(n: int = 10) -> list:
    G = _build_nx_graph()
    edges = [(u, v, d["weight"], d.get("top_category", "")) for u, v, d in G.edges(data=True)]
    return sorted(edges, key=lambda x: x[2], reverse=True)[:n]


def _nx_most_central(n: int = 10) -> list:
    G = _build_nx_graph()
    centrality = nx.degree_centrality(G)
    return sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:n]


def _nx_cross_team(n: int = 10) -> list:
    G = _build_nx_graph()
    edges = [(u, v, d["weight"]) for u, v, d in G.edges(data=True) if u != v]
    return sorted(edges, key=lambda x: x[2], reverse=True)[:n]


def _nx_bridges(n: int = 10) -> list:
    G = _build_nx_graph()
    u = G.to_undirected()
    btw = nx.betweenness_centrality(u)
    return sorted(btw.items(), key=lambda x: x[1], reverse=True)[:n]


# ── Main tool ─────────────────────────────────────────────────────────────────

@tool
def graph_query(question: str) -> str:
    """
    Use this tool for relationship and network questions about the recognition dataset.
    Best for understanding who recognizes whom, collaboration patterns, influential roles,
    and cross-department recognition flows.

    Uses Neo4j AuraDB if available, NetworkX otherwise.

    Examples:
    - Which departments recognize each other most?
    - Who are the most central hubs in the recognition network?
    - What is the recognition flow between engineering and product?
    - Who are the bridge roles that span multiple departments?
    - Which groups give and receive the most recognition?
    - Are there mutual recognition pairs (both ways)?
    """
    q      = question.lower()
    driver = _get_driver()
    n      = _extract_n(q)
    output = []

    # ── Strongest relationships / cross-department flow ───────────────────────
    if any(w in q for w in ["strongest", "most", "top", "highest", "between", "each other",
                             "flow", "cross", "department"]):
        if driver:
            records = _run_cypher("""
                MATCH (a:RoleGroup)-[r:RECOGNIZED]->(b:RoleGroup)
                WHERE a.name <> b.name
                RETURN a.name AS from_group, b.name AS to_group,
                       r.count AS count, r.top_category AS top_category
                ORDER BY r.count DESC LIMIT $n
            """, {"n": n})
            output.append(f"=== Top {n} Cross-Department Recognition Flows ===\n")
            for rec in records:
                output.append(
                    f"  {rec['from_group']} → {rec['to_group']}: "
                    f"{rec['count']} recognitions (mainly: {rec['top_category']})"
                )
        else:
            edges = _nx_cross_team(n)
            output.append(f"=== Top {n} Cross-Team Recognition Flows ===\n")
            for u, v, w in edges:
                output.append(f"  {u} → {v}: {w} recognitions")
        output.append("")

    # ── Mutual / bidirectional recognition ────────────────────────────────────
    if any(w in q for w in ["mutual", "bidirectional", "each other", "both ways", "reciprocal"]):
        if driver:
            records = _run_cypher("""
                MATCH (a:RoleGroup)-[r1:RECOGNIZED]->(b:RoleGroup)-[r2:RECOGNIZED]->(a)
                WHERE id(a) < id(b)
                RETURN a.name AS group1, b.name AS group2,
                       r1.count AS a_to_b, r2.count AS b_to_a,
                       r1.count + r2.count AS total
                ORDER BY total DESC
            """)
            output.append("=== Mutual Recognition Pairs (Both Directions) ===\n")
            for rec in records:
                output.append(
                    f"  {rec['group1']} ↔ {rec['group2']}: "
                    f"{rec['total']} total ({rec['a_to_b']} + {rec['b_to_a']})"
                )
            output.append("")

    # ── Most central / influential ────────────────────────────────────────────
    if any(w in q for w in ["central", "influential", "hub", "important", "key player", "connected"]):
        if driver:
            records = _run_cypher("""
                MATCH (g:RoleGroup)
                OPTIONAL MATCH (g)-[out:RECOGNIZED]->()
                OPTIONAL MATCH ()-[in:RECOGNIZED]->(g)
                WITH g,
                     coalesce(sum(out.count), 0) AS given,
                     coalesce(sum(in.count), 0)  AS received
                RETURN g.name AS group,
                       given, received,
                       given + received AS total_connections
                ORDER BY total_connections DESC LIMIT $n
            """, {"n": n})
            output.append("=== Most Central Role Groups ===\n")
            for rec in records:
                output.append(
                    f"  {rec['group']}: {rec['total_connections']} total "
                    f"(gave {rec['given']}, received {rec['received']})"
                )
        else:
            nodes = _nx_most_central(n)
            output.append("=== Most Connected Roles (by centrality score) ===\n")
            for name, score in nodes:
                output.append(f"  {name}: centrality {round(score, 4)}")
        output.append("")

    # ── Bridge roles ──────────────────────────────────────────────────────────
    if any(w in q for w in ["bridge", "span", "connector", "cross-team", "cross team"]):
        if driver:
            records = _run_cypher("""
                MATCH (n:RoleGroup)
                WITH n, size((n)-[:RECOGNIZED]->()) AS out_deg,
                        size(()-[:RECOGNIZED]->(n)) AS in_deg
                WHERE out_deg > 0 AND in_deg > 0
                ORDER BY (out_deg + in_deg) DESC LIMIT $n
                RETURN n.name AS group, out_deg, in_deg
            """, {"n": n})
            output.append("=== Bridge Role Groups (span across teams) ===\n")
            for rec in records:
                output.append(
                    f"  {rec['group']}: gave {rec['out_deg']}, received {rec['in_deg']}"
                )
        else:
            bridges = _nx_bridges(n)
            output.append("=== Bridge Roles (by betweenness centrality) ===\n")
            for name, score in bridges:
                output.append(f"  {name}: bridge score {round(score, 4)}")
        output.append("")

    # ── Top givers ────────────────────────────────────────────────────────────
    if any(w in q for w in ["gives most", "top giver", "nominates most", "most active giver", "who gives"]):
        if driver:
            records = _run_cypher("""
                MATCH (g:RoleGroup)-[r:RECOGNIZED]->()
                RETURN g.name AS group, sum(r.count) AS total_given
                ORDER BY total_given DESC LIMIT $n
            """, {"n": n})
            output.append("=== Groups That Give the Most Recognitions ===\n")
            for rec in records:
                output.append(f"  {rec['group']}: {rec['total_given']} given")
        else:
            G = _build_nx_graph()
            totals = {node: sum(d["weight"] for _, _, d in G.out_edges(node, data=True))
                      for node in G.nodes()}
            top = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:n]
            output.append("=== Groups That Give the Most Recognitions ===\n")
            for name, total in top:
                output.append(f"  {name}: {total} given")
        output.append("")

    # ── Top receivers ─────────────────────────────────────────────────────────
    if any(w in q for w in ["receives most", "most recognized", "top receiver", "who receives"]):
        if driver:
            records = _run_cypher("""
                MATCH ()-[r:RECOGNIZED]->(g:RoleGroup)
                RETURN g.name AS group, sum(r.count) AS total_received
                ORDER BY total_received DESC LIMIT $n
            """, {"n": n})
            output.append("=== Groups That Receive the Most Recognitions ===\n")
            for rec in records:
                output.append(f"  {rec['group']}: {rec['total_received']} received")
        output.append("")

    # ── Fallback: general network summary ─────────────────────────────────────
    if not output:
        if driver:
            stats = _run_cypher("""
                MATCH (n:RoleGroup)
                OPTIONAL MATCH (n)-[r:RECOGNIZED]->()
                WITH count(DISTINCT n) AS groups, count(r) AS rels
                RETURN groups, rels
            """)
            if stats:
                s = stats[0]
                output.append("=== Recognition Network Summary ===\n")
                output.append(f"  Role groups: {s.get('groups', 'N/A')}")
                output.append(f"  Relationships: {s.get('rels', 'N/A')}")
                output.append("")
            top_rels = _run_cypher("""
                MATCH (a:RoleGroup)-[r:RECOGNIZED]->(b:RoleGroup)
                RETURN a.name AS from_group, b.name AS to_group, r.count AS count
                ORDER BY r.count DESC LIMIT 5
            """)
            output.append("Top 5 recognition relationships:")
            for rec in top_rels:
                output.append(f"  {rec['from_group']} → {rec['to_group']}: {rec['count']}")
        else:
            G = _build_nx_graph()
            output.append("=== Recognition Network Summary (NetworkX) ===\n")
            output.append(f"  Role groups: {G.number_of_nodes()}")
            output.append(f"  Relationships: {G.number_of_edges()}")
            output.append("\nTop 5 recognition flows:")
            for u, v, w, cat in _nx_top_relationships(5):
                output.append(f"  {u} → {v}: {w} (mainly: {cat})")

    return "\n".join(output) if output else "No graph data available."
