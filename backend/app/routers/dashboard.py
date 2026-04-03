"""
Dashboard Aggregate Endpoint — replaces frontend fan-out of 6+ parallel API calls.
Returns all data needed by the Dashboard page in a single response.
"""
from fastapi import APIRouter
from ..recognition_loader import get_recognition, is_recognition_loaded, compute_gini
from ..cache import cached_response
import numpy as np

router = APIRouter()


@router.get("/overview")
@cached_response(ttl=60)
async def dashboard_overview():
    """Single aggregate endpoint for the Dashboard page. Replaces 6 separate API calls."""
    if not is_recognition_loaded():
        return {"loaded": False}

    df = get_recognition()
    if df.empty:
        return {"loaded": False}

    # Summary
    recipient_counts = df['recipient_title'].value_counts()
    gini = compute_gini(recipient_counts.values.tolist())
    cats = df['category_name'].value_counts()
    direction = df['direction'].value_counts()

    summary = {
        "total_awards": len(df),
        "gini": round(gini, 3),
        "avg_specificity": round(float(df['specificity'].mean()), 3),
        "cross_function_rate": round(float((~df['same_function']).mean() * 100), 1),
    }

    # Categories (top 4)
    categories = []
    for cat_id in sorted(df['category_id'].unique()):
        cat_df = df[df['category_id'] == cat_id]
        categories.append({
            "id": cat_id,
            "name": cat_df['category_name'].iloc[0],
            "count": len(cat_df),
            "percentage": round(len(cat_df) / len(df) * 100, 1),
        })
    categories.sort(key=lambda c: c['count'], reverse=True)

    # Specificity distribution (5 bands)
    bands = df['specificity_band'].value_counts().reindex(
        ['Very Vague', 'Vague', 'Moderate', 'Specific', 'Highly Specific'], fill_value=0
    )
    specificity_dist = [{"band": b, "count": int(c)} for b, c in bands.items()]

    # Top 10 recognized roles
    top_recv = df['recipient_title'].value_counts().head(10)
    top_roles = [{"role": r, "count": int(c)} for r, c in top_recv.items()]

    # Direction split
    direction_split = {k: int(v) for k, v in direction.items()}

    # Blind spot nominators (concentration >= 70% in one category)
    nom_stats = df.groupby('nominator_title').agg(
        total=('message', 'count'),
        dominant_cat=('category_name', lambda x: x.value_counts().index[0]),
        dominant_pct=('category_name', lambda x: x.value_counts().iloc[0] / len(x) * 100),
    ).reset_index()
    blind_spots = nom_stats[nom_stats['dominant_pct'] >= 70].nlargest(10, 'total')
    blind_spot_list = [
        {"role": r['nominator_title'], "total": int(r['total']),
         "dominant_category": r['dominant_cat'], "concentration_pct": round(float(r['dominant_pct']), 1)}
        for _, r in blind_spots.iterrows()
    ]

    # Grade pyramid (from workforce data if available)
    grade_pyramid = []
    try:
        from ..data_loader import get_employees, is_loaded
        if is_loaded():
            wf = get_employees()
            active = wf[wf['is_active']]
            if 'grade_title' in active.columns:
                grades = active['grade_title'].value_counts().head(12)
                grade_pyramid = [{"grade": g, "count": int(c)} for g, c in grades.items()]
    except Exception:
        pass

    return {
        "loaded": True,
        "summary": summary,
        "categories": categories,
        "specificity_distribution": specificity_dist,
        "top_roles": top_roles,
        "direction_split": direction_split,
        "blind_spots": blind_spot_list,
        "grade_pyramid": grade_pyramid,
    }
