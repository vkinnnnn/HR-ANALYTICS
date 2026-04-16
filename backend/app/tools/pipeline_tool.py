"""
app/tools/pipeline_tool.py

Pipeline tool — trigger data processing, taxonomy generation, annotation.
"""

from langchain_core.tools import tool


@tool
def run_pipeline(instruction: str) -> str:
    """
    Use this tool when the user wants to process new data, regenerate taxonomy,
    run annotations, or execute the full data pipeline.

    This is a placeholder that returns a status message.
    The actual pipeline is triggered via POST /api/pipeline/run endpoint.

    Examples:
    - Run the annotation pipeline on the new data
    - Regenerate the taxonomy
    - Process this dataset
    - Re-run the classification pipeline
    """
    q = instruction.lower()

    if any(word in q for word in ['taxonomy', 'classify', 'classification']):
        return (
            "PIPELINE_TRIGGER:taxonomy_generation\n\n"
            "The taxonomy generation pipeline has been queued. This will:\n"
            "1. Analyze all unique job titles and classify into families\n"
            "2. Standardize grade levels (IC/Manager/Director/VP/C-Suite)\n"
            "3. Classify career moves (promotions/laterals/demotions)\n\n"
            "Check the upload page for progress. This typically takes 2-5 minutes."
        )

    if any(word in q for word in ['annotate', 'annotation', 'topic', 'category']):
        return (
            "PIPELINE_TRIGGER:annotation\n\n"
            "The annotation pipeline has been queued. This will:\n"
            "1. Extract topics and themes from recognition messages\n"
            "2. Tag awards by type (Thank You, Launch, Leadership, etc.)\n"
            "3. Compute message specificity and quality scores\n\n"
            "Check the upload page for progress."
        )

    # Generic pipeline trigger
    return (
        "PIPELINE_TRIGGER:full_pipeline\n\n"
        "The full data processing pipeline has been queued. This will:\n"
        "1. Validate and deduplicate data\n"
        "2. Generate taxonomy (job families, grades, move types)\n"
        "3. Run annotation (topics, themes, quality)\n"
        "4. Rebuild knowledge base (ChromaDB embeddings)\n"
        "5. Retrain ML models (flight risk, promotion prediction)\n\n"
        "Check the upload page for progress. Full pipeline takes 5-15 minutes."
    )
