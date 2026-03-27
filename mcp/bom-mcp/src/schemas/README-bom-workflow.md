# BOM Workflow Schemas

This file set is a draft for the next-generation `bom-mcp` workflow actions designed to pair with `lobsters/bom-quote.lobster`.

## Purpose

- Keep the current async job-style tools intact
- Provide a stable action/schema target for the full Lobster workflow
- Make it possible to migrate incrementally from:
  - `submit_bom`
  - `get_bom_job_result`
  - `get_quote`
  - `export_quote`

into a more composable staged pipeline.

## Suggested migration path

1. Keep existing tools for compatibility
2. Add a new action router layer for staged actions
3. Reuse current domain modules where possible:
   - `domain/bom-parser.ts` -> `parse_bom`
   - `domain/normalizer.ts` -> `normalize_fields`
   - `domain/quote-builder.ts` / `domain/pricing.ts` -> `compare_quotes` / `finalize_quote`
4. Add adapters for:
   - part resolution
n   - historical price lookup
   - vendor quote fetching
   - anomaly detection
5. Once stable, optionally implement a `run_full_quote` convenience action on top of the staged ones

## Notes

- `export_quote_v2` is named separately on purpose to avoid colliding with the current legacy `export_quote(jobId, format)` contract.
- `prepare_review` is intended to feed Lobster approvals; approval itself should stay in Lobster, not in MCP.
- `detect_anomalies.output.requiresHumanReview` is the main branch signal used by the workflow.
