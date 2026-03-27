# Backend API Deep Dive

FastAPI app at `http://localhost:8000`. CORS allows `http://localhost:3000`.
Entry point: `backend/app/main.py` using async lifespan context manager.
DB: SQLAlchemy async + SQLite (ONLY for PipelineRun metadata, NOT HR data).
All analytics read annotated CSVs directly via pandas.

## 1. Analytics Router (`/api/analytics`)

### Endpoints
- `GET /files` — list available annotated CSV files in output/
- `GET /summary` — total awards, unique recipients/nominators, date range, category counts
- `GET /categories` — top-level category distribution (name, count, percentage)
- `GET /subcategories?category=X` — subcategory breakdown, filterable
- `GET /seasonality?granularity=day|week|month` — award volume over time (pandas resample)
- `GET /trends` — category counts pivoted by month (multi-line chart data)
- `GET /drift` — category share (%) per year for cultural evolution
- `GET /inequality` — Gini coefficient + 20-point Lorenz curve + per-department Gini

### Gini Coefficient
Measures recognition distribution inequality (0=equal, 1=one person gets all).
Also returns Lorenz curve data for visualization.
Computes per-department to identify concentrated recognition cultures.

### Noise Filtering
Excludes: "NONE", "Congratulations", "Special Bonus", "Birthday", "life event", "yos"

## 2. Predictions Router (`/api/predictions`)

### Category Predictor
- TF-IDF (max_features=5000, ngram_range=(1,2)) + LogisticRegression(max_iter=1000, C=5)
- Returns top-3 predictions with confidence scores
- Cached in memory, `/retrain` endpoint to refresh

### Attrition Risk
- Compares recognition volume: last 90 days vs prior 90 days
- Flags employees with ≥50% drop
- Returns: name, department, role, risk_score, days_since_last, recent_drop_pct

### High Performers
- Weighted composite: award count, frequency, diversity, recency, value
- Returns ranked list with scores

### Message Clusters
- SentenceTransformer("all-MiniLM-L6-v2") → 384-dim embeddings → UMAP(n_neighbors=15, min_dist=0.1) → 2D
- Fallback: TF-IDF + PCA if sentence-transformers unavailable
- Returns x,y coordinates + category labels for scatter plot

## 3. Copilot Router (`/api/copilot`)

### Ghost-Writer (`POST /ghost-write`)
Input: employee name, role, department, achievement description, tone (warm|formal|enthusiastic|concise), optional target category
Prompt bans clichés: "goes above and beyond", "team player"
Temperature: 0.7

### Explainer (`POST /explain`)
1. ML fast-prediction (TF-IDF, no LLM cost)
2. LLM explanation quoting specific phrases → category justification

### Team View (`GET /team-view?department=X`)
Per-employee stats: total awards, recent (90d), days since last, top category, is_overlooked (90+d gap)

### Report Generator (`POST /report`)
Sends team stats to LLM → 3-paragraph executive report: findings → patterns → recommendations
Temperature: 0.7

## 4. Fairness Router (`/api/fairness`)

### NLP Word Lists (Pure Python, no external NLP libs)
- ACTION_VERBS: 40+ ("delivered", "built", "led", "automated"...)
- TRAIT_ADJECTIVES: 30+ ("amazing", "hardworking"...)
- CLICHE_PATTERNS: 8 regexes (r"goes? above and beyond", r"team player"...)

### Specificity Score (per message, 0–1)
- +0.4 if contains numbers (quantified impact)
- +0.2 × action_verb_count (capped at 2)
- +0.1 if word_count > 30
- -0.1 if only trait adjectives with no action verbs

### Audit
Groups by: department | business_unit | gender | ethnicity
Computes avg specificity per group
Flags "fairness gaps": groups >0.8 std dev below company average
Optional hr_employees.csv join for demographics

## 5. Network Router (`/api/network`)

### Graph Construction
- Nodes: every recipient + nominator with metadata
- Edges: directed, aggregated nom→rec pairs, weight = award count

### PageRank
Custom numpy: damping=0.85, 50 iterations (no networkx)
Normalized to 1–10 scale for node sizing

### Detection
- is_isolated: receives zero nominations
- is_giver_only: gives but never receives
- reciprocal_pairs: A→B and B→A both exist
- Filters: by business_unit, date_range

## 6. Managers Router (`/api/managers`)

### Scoring (4 dimensions, all min-max normalized 0–1)
| Dimension | Weight | Description |
|---|---|---|
| Frequency | 30% | How many recognitions given |
| Specificity | 35% | Average message quality (fairness scoring) |
| Diversity | 25% | Breadth of taxonomy categories used |
| Recency | 10% | How recently they gave recognition |

### Blind Spot Detection
Manager has blind spot if ≥70% of recognitions fall into single category.

### Coaching Timeline (`/coaching-timeline`)
Month-by-month scoring. delta_3m (last 3 vs prior 3 months) → "improving"/"declining"/"stable"

## 7. Drift Router (`/api/drift`)

### Algorithm
1. TF-IDF vectorize (max 2000 features, bigrams, sublinear TF)
2. Compute category centroid vectors (mean of all messages per category)
3. Cosine distance from each message to its category centroid
4. Flag messages where distance ≥ 0.65 (threshold)
5. KMeans micro-clusters (default k=4) on drifting messages
6. Optional LLM naming ("Emerging: Cross-Team Collaboration")
7. Return per-cluster top TF-IDF terms + sample messages

### Monthly Timeline
Proportion of drifting messages per month — early warning for taxonomy refresh.

## 8. Outcomes Router (`/api/outcomes`)

### Feature Engineering (per employee)
total_awards, awards_per_quarter, category_diversity, recognition_gap_days, avg_award_value, category_name fractional presence (one-hot)

### Three Models
1. **Promotion** (LogisticRegression, 5-fold CV, ROC-AUC): feature importances + likelihood multipliers
2. **Attrition** (LogisticRegression): same structure
3. **Performance** (Ridge Regression, alpha=1.0): continuous rating prediction

### Likelihood Multipliers
outcome_rate(above_median_feature) / baseline_rate — plain-English insight

### Retention Radar (`/retention-radar`)
Combines attrition model scores + business logic → per-employee risk list with recommended action + Ghost-Writer prefill data

## 9. ROI Router (`/api/roi`)

### Calculation
- At-risk: recognition gap ≥90d OR awards_per_quarter < 0.5
- Baseline: $15,000 replacement cost (configurable)
- Reduction rate: 31% (Gallup/SHRM meta-analysis)
- Returns: projected_cost, estimated_savings, net_roi, roi_pct, payback_months

### What-If Scenarios
Gap closure at 10%, 20%, 31%, 40%, 50% rates

### Department Breakdown
Which teams have highest financial exposure

## 10. Pulse Router (`/api/pulse`)
- Week-over-week volume change
- Droughts: employees not recognized in 60+ days
- Dormant managers: haven't given recognition in 60+ days
- Severity: ≥25% drop=Warning, ≥40%=Critical, 180+d drought=Critical
- `/slack-preview`: full Slack Block Kit JSON for webhook

## 11. Pipeline Router (`/api/pipeline`)
- `POST /start` — start taxonomy or annotation run
- `GET /status/{id}` — poll run status
- Tracks in SQLite: PipelineRun(id, run_type, status, input_file, output_file, config_json, log, total_cost, timestamps)

## 12. Export Router (`/api/export`)
- Bundles into ZIP: awards_annotated.csv, outcomes.csv, hr_employees.csv, README.txt
- README includes: Power BI loading instructions, table relationships, DAX measures, visualization ideas
- Uses FastAPI StreamingResponse (no memory buffering)

## Database Model (SQLAlchemy)
```python
class PipelineRun(Base):
    id: Mapped[int] (primary_key, autoincrement)
    run_type: Mapped[str]        # "taxonomy" | "annotation"
    status: Mapped[str]          # "pending" | "running" | "done" | "failed"
    input_file: Mapped[str]
    output_file: Mapped[str | None]
    config_json: Mapped[str | None]
    log: Mapped[str | None]
    total_cost: Mapped[float | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```
