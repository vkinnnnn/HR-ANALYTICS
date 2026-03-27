# Pipeline Integration — Migration Notes

## Source: Regata3010/HR-Analytics
## Target: vkinnnnn/HR-ANALYTICS (Workforce Analytics Platform)

### What Was Adapted

| Source Capability | Source Location | Local Adaptation | Local Location |
|---|---|---|---|
| PipelineRun model (id, status, log, cost) | `backend/app/database.py` | Extended with progress tracking, cancellation, artifacts | `backend/app/database.py` |
| Run state machine (pending→running→done/failed) | `backend/pipeline/runners.py` | Same pattern, async DB updates | `backend/app/services/run_manager.py` |
| Cancel flag registry (Dict[int, Event]) | `backend/pipeline/runners.py` | Adopted as-is with cleanup | `backend/app/services/run_manager.py` |
| BackgroundTasks dispatch | `backend/app/routers/pipeline.py` | Thread-based dispatch with own event loop | `backend/app/services/run_manager.py` |
| Batch-of-20 processing with checkpoints | `create_taxonomy.py` | Generic BatchConfig utility (configurable size/workers/retries) | `backend/app/services/batch_processor.py` |
| ThreadPoolExecutor parallel batches | `run_topic_annotation.py` | Generic `run_parallel()` utility | `backend/app/services/batch_processor.py` |
| Log append + status update helpers | `backend/pipeline/runners.py` | Async `append_log()` + `update_progress()` | `backend/app/services/run_manager.py` |
| `/api/pipeline/runs` CRUD | `backend/app/routers/pipeline.py` | Full endpoint set with artifacts | `backend/app/routers/pipeline_router.py` |
| `/api/pipeline/runs/{id}/log` polling | `backend/app/routers/pipeline.py` | Adopted for frontend live-polling | `backend/app/routers/pipeline_router.py` |
| Cost tracking per-run | `backend/pipeline/runners.py` | `total_cost` field preserved | `backend/app/database.py` |

### What Was Intentionally NOT Copied

| Source Feature | Reason |
|---|---|
| Taxonomy grounded-theory prompts | Domain-specific to recognition messages. We use rule-based taxonomy. |
| Pickle serialization of LLM responses | Fragile format. We use JSON cache instead. |
| Bedrock LLM provider | Not used. OpenAI only for now. |
| `create_taxonomy.py` / `run_topic_annotation.py` | Recognition-era scripts. Our pipeline uses workforce-specific runners. |
| Hardcoded $3/$15 pricing | Replaced with configurable per-run cost tracking. |

### New Pipeline Run Types (Workforce Domain)

| run_type | Description | Runner |
|---|---|---|
| `data_reload` | Full CSV reload + enrichment | `pipeline_runners.data_reload_runner` |
| `taxonomy_regen` | Re-classify grades, titles, career moves | `pipeline_runners.taxonomy_regen_runner` |
| `flight_risk_train` | Retrain ML model | `pipeline_runners.flight_risk_train_runner` |
| `report_generate` | LLM executive summary | `pipeline_runners.report_generate_runner` |
| `export_bundle` | Power BI ZIP export | `pipeline_runners.export_bundle_runner` |

### New Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_BATCH_SIZE` | 50 | Items per batch |
| `MAX_WORKERS` | 4 | Parallel worker threads (capped at 8) |
| `MAX_RETRIES` | 3 | Retry attempts per batch |
| `CHECKPOINT_EVERY_N_BATCHES` | 5 | Save checkpoint interval |
| `CHECKPOINT_DIR` | checkpoints | Checkpoint file directory |
| `MAX_UPLOAD_SIZE_MB` | 100 | Max CSV upload size |

### New API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/pipeline/start` | Start a pipeline run |
| GET | `/api/pipeline/runs` | List recent runs |
| GET | `/api/pipeline/runs/{id}` | Run detail + config + artifacts |
| GET | `/api/pipeline/runs/{id}/log` | Live log polling |
| POST | `/api/pipeline/runs/{id}/cancel` | Cancel a running job |
| GET | `/api/pipeline/runs/{id}/artifacts/{aid}/download` | Download artifact file |
| GET | `/api/pipeline/run-types` | List available run types |

### Test Coverage

- `test_batch_processor.py` — 12 tests: batching, retry, cancel, checkpoint, resume, parallel
- `test_run_lifecycle.py` — 9 tests: create, start, complete, fail, cancel, progress, log, list, artifacts
- `test_pipeline_api.py` — 7 tests: endpoints, validation, existing API intact
