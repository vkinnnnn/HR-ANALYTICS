"""
Taxonomy Router — Exposes taxonomy classification results and re-generation.
"""
from fastapi import APIRouter, HTTPException
from ..data_loader import get_employees, get_history, is_loaded, load_and_process, _data_cache
from ..taxonomy import get_taxonomy, run_taxonomy, clear_taxonomy

router = APIRouter()


@router.get("/summary")
async def taxonomy_summary():
    """High-level taxonomy stats."""
    tax = get_taxonomy()
    if not tax:
        if is_loaded():
            tax = run_taxonomy(get_employees(), get_history())
        else:
            return {"status": "no_data", "message": "Upload data first"}
    return tax.get("summary", {})


@router.get("/grades")
async def grade_taxonomy():
    """Grade classification results."""
    tax = get_taxonomy()
    grade_map = tax.get("grade_map", {})
    # Group by band
    bands = {}
    for grade, info in grade_map.items():
        band = info.get("band", "Unknown")
        if band not in bands:
            bands[band] = []
        bands[band].append({
            "grade": grade,
            "standard_level": info.get("standard_level", grade),
            "track": info.get("track", "unknown"),
            "seniority_rank": info.get("seniority_rank", 0),
        })
    # Sort within each band by seniority
    for band in bands:
        bands[band].sort(key=lambda x: x["seniority_rank"])

    # Count employees per band
    emp = get_employees()
    band_counts = emp["grade_band"].value_counts().to_dict() if "grade_band" in emp.columns else {}

    return {
        "bands": bands,
        "band_counts": {k: int(v) for k, v in band_counts.items()},
        "total_grades": len(grade_map),
    }


@router.get("/functions")
async def function_taxonomy():
    """Function → family classification results."""
    tax = get_taxonomy()
    func_map = tax.get("function_family_map", {})

    # Group by family
    families = {}
    for func, family in func_map.items():
        if family not in families:
            families[family] = []
        families[family].append(func)

    # Count employees per family
    emp = get_employees()
    family_counts = emp["function_family"].value_counts().to_dict() if "function_family" in emp.columns else {}

    return {
        "families": {k: sorted(v) for k, v in sorted(families.items())},
        "family_counts": {k: int(v) for k, v in family_counts.items()},
        "total_functions": len(func_map),
        "total_families": len(families),
    }


@router.get("/job-families")
async def job_family_taxonomy():
    """Job title → family + seniority classification results."""
    tax = get_taxonomy()
    title_map = tax.get("title_map", {})

    # Group by family
    families = {}
    for title, info in title_map.items():
        family = info.get("job_family", "General")
        if family not in families:
            families[family] = []
        families[family].append({
            "title": title,
            "seniority_level": info.get("seniority_level", "Mid-Level"),
        })

    # Count employees per job family
    emp = get_employees()
    family_counts = emp["job_family"].value_counts().to_dict() if "job_family" in emp.columns else {}

    return {
        "families": {k: sorted(v, key=lambda x: x["title"]) for k, v in sorted(families.items())},
        "family_counts": {k: int(v) for k, v in family_counts.items()},
        "total_titles": len(title_map),
        "total_families": len(families),
    }


@router.get("/career-moves")
async def career_move_taxonomy():
    """Career move classifications — promotions, laterals, demotions, restructures."""
    tax = get_taxonomy()
    moves = tax.get("career_moves", [])
    summary = tax.get("summary", {}).get("move_types", {})

    # Get top moves by type
    by_type = {}
    for move in moves:
        mt = move.get("move_type", "unknown")
        if mt not in by_type:
            by_type[mt] = []
        if len(by_type[mt]) < 20:  # Top 20 per type
            by_type[mt].append({
                "from": move.get("from_title", ""),
                "to": move.get("to_title", ""),
                "confidence": move.get("confidence", ""),
                "signals": move.get("signals", []),
            })

    return {
        "total_moves": len(moves),
        "move_type_counts": summary,
        "examples_by_type": by_type,
    }


@router.post("/regenerate")
async def regenerate_taxonomy():
    """Clear cache and re-run taxonomy on current data."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="No data loaded")
    clear_taxonomy()
    emp = get_employees()
    hist = get_history()
    result = run_taxonomy(emp, hist)
    # Re-enrich employee DataFrame
    load_and_process()
    return {
        "status": "regenerated",
        "summary": result.get("summary", {}),
    }
