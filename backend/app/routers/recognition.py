"""
Recognition Analytics Router — All endpoints for recognition intelligence.
"""
from fastapi import APIRouter, HTTPException, Query
from ..recognition_loader import get_recognition, is_recognition_loaded, compute_gini, ACTION_VERBS, CLICHE_PATTERNS, SENIORITY_ORDER
import numpy as np, re

router = APIRouter()


def _check():
    if not is_recognition_loaded():
        raise HTTPException(503, "Recognition data not loaded.")
    return get_recognition()


@router.get("/summary")
async def summary():
    df = _check()
    recipient_counts = df['recipient_title'].value_counts()
    gini = compute_gini(recipient_counts.values.tolist())
    cats = df['category_name'].value_counts()
    return {
        "total_awards": len(df),
        "unique_recipients": df['recipient_title'].nunique(),
        "unique_nominators": df['nominator_title'].nunique(),
        "total_unique_roles": len(set(df['recipient_title'].unique()) | set(df['nominator_title'].unique())),
        "gini": round(gini, 3),
        "avg_specificity": round(float(df['specificity'].mean()), 3),
        "avg_word_count": round(float(df['word_count'].mean()), 1),
        "cross_function_rate": round(float((~df['same_function']).mean() * 100), 1),
        "dominant_category": cats.index[0] if len(cats) > 0 else "",
        "dominant_category_pct": round(float(cats.iloc[0] / len(df) * 100), 1) if len(cats) > 0 else 0,
        "direction_split": df['direction'].value_counts().to_dict(),
        "unique_award_titles": df['award_title'].nunique(),
    }


@router.get("/categories")
async def categories():
    df = _check()
    result = []
    for cat_id in sorted(df['category_id'].unique()):
        cat_df = df[df['category_id'] == cat_id]
        cat_name = cat_df['category_name'].iloc[0]
        subs = []
        for sub_id in sorted(cat_df['subcategory_id'].unique()):
            sub_df = cat_df[cat_df['subcategory_id'] == sub_id]
            subs.append({"id": sub_id, "name": sub_df['subcategory_name'].iloc[0],
                         "count": len(sub_df), "avg_specificity": round(float(sub_df['specificity'].mean()), 3)})
        result.append({"id": cat_id, "name": cat_name, "count": len(cat_df),
                        "percentage": round(len(cat_df) / len(df) * 100, 1),
                        "avg_specificity": round(float(cat_df['specificity'].mean()), 3),
                        "subcategories": subs})
    return {"categories": result}


@router.get("/subcategories")
async def subcategories(category_id: str = Query(None)):
    df = _check()
    if category_id:
        df = df[df['category_id'] == category_id]
    result = df.groupby(['subcategory_id','subcategory_name','category_id','category_name']).agg(
        count=('message','count'), avg_specificity=('specificity','mean')
    ).reset_index().sort_values('count', ascending=False)
    return {"subcategories": [
        {"id": r['subcategory_id'], "name": r['subcategory_name'], "category_id": r['category_id'],
         "category_name": r['category_name'], "count": int(r['count']),
         "avg_specificity": round(float(r['avg_specificity']), 3)}
        for _, r in result.iterrows()
    ]}


@router.get("/inequality")
async def inequality():
    df = _check()
    counts = df['recipient_title'].value_counts().values.tolist()
    gini = compute_gini(counts)
    sorted_c = sorted(counts)
    n = len(sorted_c)
    cumulative = np.cumsum(sorted_c) / sum(sorted_c)
    lorenz = [{"x": round(i / n * 100, 1), "y": round(float(cumulative[i]) * 100, 1)} for i in range(0, n, max(1, n // 20))]
    lorenz.append({"x": 100, "y": 100})
    top_10 = sum(sorted(counts, reverse=True)[:max(1, n // 10)]) / sum(counts) * 100
    bottom_50 = sum(sorted_c[:n // 2]) / sum(counts) * 100
    single = sum(1 for c in counts if c == 1)
    power = df['recipient_title'].value_counts().head(10)
    return {
        "gini": round(gini, 3), "lorenz_curve": lorenz,
        "top_10_share": round(top_10, 1), "bottom_50_share": round(bottom_50, 1),
        "single_award_roles": single, "total_roles": n,
        "power_recipients": [{"role": r, "count": int(c)} for r, c in power.items()],
    }


@router.get("/flow")
async def flow():
    df = _check()
    direction = df['direction'].value_counts()
    cross = float((~df['same_function']).mean() * 100)
    # Cross-function heatmap
    heatmap = df.groupby(['nominator_function','recipient_function']).size().reset_index(name='count')
    heatmap_data = [{"source": r['nominator_function'], "target": r['recipient_function'], "value": int(r['count'])} for _, r in heatmap.iterrows()]
    # Seniority flow
    sen_flow = df.groupby(['nominator_seniority','recipient_seniority']).size().reset_index(name='count')
    flow_data = [{"source": r['nominator_seniority'], "target": r['recipient_seniority'], "value": int(r['count'])} for _, r in sen_flow.nlargest(20, 'count').iterrows()]
    # Reciprocal pairs
    pairs = df.groupby(['nominator_title','recipient_title']).size().reset_index(name='n')
    rev = pairs.merge(pairs, left_on=['nominator_title','recipient_title'], right_on=['recipient_title','nominator_title'], suffixes=('','_r'))
    reciprocal = len(rev) // 2
    return {
        "direction_split": {k: int(v) for k, v in direction.items()},
        "direction_pct": {k: round(int(v) / len(df) * 100, 1) for k, v in direction.items()},
        "cross_function_rate": round(cross, 1),
        "same_function_rate": round(100 - cross, 1),
        "reciprocal_pairs": reciprocal,
        "heatmap": heatmap_data, "seniority_flow": flow_data,
    }


@router.get("/nlp-quality")
async def nlp_quality():
    df = _check()
    bands = df['specificity_band'].value_counts().reindex(['Very Vague','Vague','Moderate','Specific','Highly Specific'], fill_value=0)
    return {
        "avg_specificity": round(float(df['specificity'].mean()), 3),
        "median_specificity": round(float(df['specificity'].median()), 3),
        "specificity_distribution": [{"band": b, "count": int(c)} for b, c in bands.items()],
        "quantified_impact_rate": round(float(df['has_numbers'].mean() * 100), 1),
        "action_verb_rate": round(float((df['action_verb_count'] > 0).mean() * 100), 1),
        "avg_action_verbs": round(float(df['action_verb_count'].mean()), 2),
        "cliche_rate": round(float((df['cliche_count'] > 0).mean() * 100), 1),
        "avg_word_count": round(float(df['word_count'].mean()), 1),
        "length_stats": {"min": int(df['word_count'].min()), "max": int(df['word_count'].max()),
                         "median": int(df['word_count'].median()), "p25": int(df['word_count'].quantile(0.25)),
                         "p75": int(df['word_count'].quantile(0.75))},
    }


@router.get("/fairness")
async def fairness():
    df = _check()
    by_func = df.groupby('recipient_function')['specificity'].agg(['mean','count']).reset_index()
    by_func.columns = ['function','avg_specificity','count']
    by_sen = df.groupby('recipient_seniority')['specificity'].agg(['mean','count']).reset_index()
    by_sen.columns = ['seniority','avg_specificity','count']
    avg = float(df['specificity'].mean())
    cat_by_func = df.groupby(['recipient_function','category_name']).size().reset_index(name='count')
    return {
        "avg_specificity": round(avg, 3),
        "by_function": [{"function": r['function'], "avg_specificity": round(float(r['avg_specificity']), 3),
                         "count": int(r['count']), "below_avg": float(r['avg_specificity']) < avg}
                        for _, r in by_func.sort_values('avg_specificity').iterrows()],
        "by_seniority": [{"seniority": r['seniority'], "avg_specificity": round(float(r['avg_specificity']), 3),
                          "count": int(r['count']), "below_avg": float(r['avg_specificity']) < avg}
                         for _, r in by_sen.sort_values('avg_specificity').iterrows()],
        "category_bias": [{"function": r['recipient_function'], "category": r['category_name'], "count": int(r['count'])}
                          for _, r in cat_by_func.iterrows()],
    }


@router.get("/network")
async def network():
    df = _check()
    edges_df = df.groupby(['nominator_title','recipient_title']).size().reset_index(name='weight')
    all_roles = set(df['recipient_title'].unique()) | set(df['nominator_title'].unique())
    in_deg = df['recipient_title'].value_counts().to_dict()
    out_deg = df['nominator_title'].value_counts().to_dict()
    nodes = [{"id": r, "in_degree": in_deg.get(r, 0), "out_degree": out_deg.get(r, 0),
              "total": in_deg.get(r, 0) + out_deg.get(r, 0),
              "function": next((infer_function_cached(r) for _ in [1]), 'Other')}
             for r in list(all_roles)[:200]]  # limit for performance
    edges = [{"source": r['nominator_title'], "target": r['recipient_title'], "weight": int(r['weight'])}
             for _, r in edges_df.nlargest(300, 'weight').iterrows()]
    return {
        "nodes": nodes, "edges": edges,
        "total_nodes": len(all_roles), "total_edges": len(edges_df),
        "density": round(len(edges_df) / max(1, len(all_roles) * (len(all_roles) - 1)) * 100, 3),
    }


def infer_function_cached(title):
    from ..recognition_loader import infer_function
    return infer_function(title)


@router.get("/nominators")
async def nominators():
    df = _check()
    nom_stats = df.groupby('nominator_title').agg(
        total=('message','count'),
        avg_specificity=('specificity','mean'),
        categories=('category_name', lambda x: x.nunique()),
        functions=('recipient_function', lambda x: x.nunique()),
        dominant_cat=('category_name', lambda x: x.value_counts().index[0]),
        dominant_pct=('category_name', lambda x: x.value_counts().iloc[0] / len(x) * 100),
    ).reset_index()
    nom_stats['composite'] = (
        nom_stats['total'] / nom_stats['total'].max() * 30 +
        nom_stats['avg_specificity'] / max(nom_stats['avg_specificity'].max(), 0.01) * 35 +
        nom_stats['categories'] / max(nom_stats['categories'].max(), 1) * 25 +
        nom_stats['functions'] / max(nom_stats['functions'].max(), 1) * 10
    )
    nom_stats = nom_stats.sort_values('composite', ascending=False)
    leaderboard = [
        {"role": r['nominator_title'], "total": int(r['total']),
         "avg_specificity": round(float(r['avg_specificity']), 3),
         "category_diversity": int(r['categories']), "function_breadth": int(r['functions']),
         "dominant_category": r['dominant_cat'], "concentration_pct": round(float(r['dominant_pct']), 1),
         "blind_spot": float(r['dominant_pct']) >= 70,
         "composite_score": round(float(r['composite']), 1)}
        for _, r in nom_stats.head(50).iterrows()
    ]
    coaching = [l for l in leaderboard if l['avg_specificity'] < 0.2 and l['category_diversity'] <= 2]
    blind_spots = [l for l in leaderboard if l['blind_spot']]
    return {"leaderboard": leaderboard, "coaching_candidates": coaching, "blind_spots": blind_spots}


@router.get("/award-types")
async def award_types():
    df = _check()
    types = df['award_type'].value_counts()
    cross = df.groupby(['award_type','category_name']).size().reset_index(name='count')
    return {
        "distribution": [{"type": t, "count": int(c), "pct": round(int(c) / len(df) * 100, 1)} for t, c in types.items()],
        "cross_tab": [{"award_type": r['award_type'], "category": r['category_name'], "count": int(r['count'])} for _, r in cross.iterrows()],
    }


@router.get("/explorer")
async def explorer(category: str = None, function: str = None, seniority: str = None,
                   specificity_min: float = None, award_type: str = None,
                   search: str = None, limit: int = 50, offset: int = 0):
    df = _check()
    if category: df = df[df['category_id'] == category]
    if function: df = df[df['recipient_function'] == function]
    if seniority: df = df[df['recipient_seniority'] == seniority]
    if specificity_min is not None: df = df[df['specificity'] >= specificity_min]
    if award_type: df = df[df['award_type'] == award_type]
    if search: df = df[df['message'].str.contains(search, case=False, na=False)]
    total = len(df)
    page = df.iloc[offset:offset + limit]
    return {
        "total": total, "offset": offset, "limit": limit,
        "awards": [
            {"message": r['message'][:300], "full_message": r['message'],
             "award_title": r['award_title'], "recipient_title": r['recipient_title'],
             "nominator_title": r['nominator_title'], "category": r.get('category_name',''),
             "subcategory": r.get('subcategory_name',''), "category_id": r.get('category_id',''),
             "specificity": round(float(r['specificity']), 3), "direction": r.get('direction',''),
             "recipient_function": r.get('recipient_function',''), "award_type": r.get('award_type',''),
             "word_count": int(r.get('word_count', 0))}
            for _, r in page.iterrows()
        ],
    }


@router.get("/top-roles")
async def top_roles():
    df = _check()
    top_recv = df['recipient_title'].value_counts().head(15)
    top_nom = df['nominator_title'].value_counts().head(15)
    return {
        "top_recipients": [{"role": r, "count": int(c)} for r, c in top_recv.items()],
        "top_nominators": [{"role": r, "count": int(c)} for r, c in top_nom.items()],
    }
