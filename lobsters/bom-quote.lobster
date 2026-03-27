name: bom-quote
args:
  bomFile:
    required: true
  customer:
    required: false
  currency:
    default: "CNY"
  priceBook:
    default: "default"
  exportFormat:
    default: "xlsx"
  requireReview:
    default: true
  minMatchConfidence:
    default: 0.85
  anomalyPriceJumpPct:
    default: 0.30
  anomalyLeadTimeDays:
    default: 45
  comparisonStrategy:
    default: "balanced"

env:
  WORKFLOW: "bom-quote"
  MCP_SERVICE: "bom-mcp"

steps:
  - id: parse_bom
    command: >
      openclaw.invoke --tool bom-mcp --action parse_bom
      --args-json '{
        "bomFile":"${args.bomFile}"
      }'

  - id: normalize_fields
    command: >
      openclaw.invoke --tool bom-mcp --action normalize_fields
      --args-json '{
        "currency":"${args.currency}"
      }'
    stdin: $parse_bom.json

  - id: resolve_parts
    command: >
      openclaw.invoke --tool bom-mcp --action resolve_parts
      --args-json '{
        "minMatchConfidence":${args.minMatchConfidence}
      }'
    stdin: $normalize_fields.json

  - id: lookup_price_history
    command: >
      openclaw.invoke --tool bom-mcp --action lookup_price_history
      --args-json '{
        "priceBook":"${args.priceBook}",
        "currency":"${args.currency}"
      }'
    stdin: $resolve_parts.json

  - id: fetch_vendor_quotes
    command: >
      openclaw.invoke --tool bom-mcp --action fetch_vendor_quotes
      --args-json '{
        "currency":"${args.currency}"
      }'
    stdin: $lookup_price_history.json

  - id: extract_prices
    command: >
      openclaw.invoke --tool bom-mcp --action extract_prices
      --args-json '{}'
    stdin: $fetch_vendor_quotes.json

  - id: clean_quotes
    command: >
      openclaw.invoke --tool bom-mcp --action clean_quotes
      --args-json '{
        "currency":"${args.currency}"
      }'
    stdin: $extract_prices.json

  - id: compare_quotes
    command: >
      openclaw.invoke --tool bom-mcp --action compare_quotes
      --args-json '{
        "currency":"${args.currency}",
        "strategy":"${args.comparisonStrategy}"
      }'
    stdin: $clean_quotes.json

  - id: detect_anomalies
    command: >
      openclaw.invoke --tool bom-mcp --action detect_anomalies
      --args-json '{
        "priceJumpPct":${args.anomalyPriceJumpPct},
        "leadTimeDays":${args.anomalyLeadTimeDays},
        "minMatchConfidence":${args.minMatchConfidence}
      }'
    stdin: $compare_quotes.json

  - id: prepare_review
    command: >
      openclaw.invoke --tool bom-mcp --action prepare_review
      --args-json '{
        "customer":"${args.customer}",
        "currency":"${args.currency}"
      }'
    stdin: $detect_anomalies.json
    condition: $args.requireReview == true && $detect_anomalies.json.requiresHumanReview == true

  - id: review_gate
    command: >
      openclaw.invoke --tool bom-mcp --action prepare_review
      --args-json '{
        "customer":"${args.customer}",
        "currency":"${args.currency}",
        "mode":"approval-preview"
      }'
    stdin: $detect_anomalies.json
    approval: required
    condition: $args.requireReview == true && $detect_anomalies.json.requiresHumanReview == true

  - id: finalize_quote_reviewed
    command: >
      openclaw.invoke --tool bom-mcp --action finalize_quote
      --args-json '{
        "customer":"${args.customer}",
        "currency":"${args.currency}",
        "reviewApproved":true
      }'
    stdin: $detect_anomalies.json
    condition: $args.requireReview == true && $detect_anomalies.json.requiresHumanReview == true && $review_gate.approved == true

  - id: finalize_quote_auto
    command: >
      openclaw.invoke --tool bom-mcp --action finalize_quote
      --args-json '{
        "customer":"${args.customer}",
        "currency":"${args.currency}",
        "reviewApproved":false
      }'
    stdin: $detect_anomalies.json
    condition: $detect_anomalies.json.requiresHumanReview != true

  - id: export_quote_reviewed
    command: >
      openclaw.invoke --tool bom-mcp --action export_quote
      --args-json '{
        "format":"${args.exportFormat}",
        "customer":"${args.customer}"
      }'
    stdin: $finalize_quote_reviewed.json
    condition: $finalize_quote_reviewed.ok == true

  - id: export_quote_auto
    command: >
      openclaw.invoke --tool bom-mcp --action export_quote
      --args-json '{
        "format":"${args.exportFormat}",
        "customer":"${args.customer}"
      }'
    stdin: $finalize_quote_auto.json
    condition: $finalize_quote_auto.ok == true

  - id: write_price_history_reviewed
    command: >
      openclaw.invoke --tool bom-mcp --action write_price_history
      --args-json '{
        "priceBook":"${args.priceBook}",
        "customer":"${args.customer}"
      }'
    stdin: $finalize_quote_reviewed.json
    condition: $finalize_quote_reviewed.ok == true

  - id: write_price_history_auto
    command: >
      openclaw.invoke --tool bom-mcp --action write_price_history
      --args-json '{
        "priceBook":"${args.priceBook}",
        "customer":"${args.customer}"
      }'
    stdin: $finalize_quote_auto.json
    condition: $finalize_quote_auto.ok == true
