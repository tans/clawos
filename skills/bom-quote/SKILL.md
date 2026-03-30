---
name: bom-quote
description: Use when quoting one or more electronic BOMs from customer messages, spreadsheets, or CSV blocks and the result needs price source, pending decisions, and business-ready export data
---

# BOM Quote

## Overview
Use `bom-mcp` to turn electronic BOM input into a business-usable quote summary. Default to completing the quote automatically; only stop for customer choice when the system marks `ambiguous_candidates` or `missing_reliable_price`.

## When to Use
- Customer sends one or more BOM tables, CSV blocks, or workbook files and wants pricing.
- The quote needs line-level `priceSource`, `priceUpdatedAt`, and decision status.
- The team needs a quick business summary, not a perfect copy of the customer's workbook.

## Workflow
1. If the user message contains one or more BOM blocks, call `quote_customer_message`.
2. Set `currency` to `CNY` unless the user asks otherwise.
3. Enable `webPricing` when local price is missing. Prefer `webSuppliers: ["digikey_cn", "ic_net"]`.
4. Present totals, resolved lines, pending decision lines, failures, and the latest `priceUpdatedAt` values as reference for sales.
5. If the result includes pending decisions:
   - `ambiguous_candidates`: ask the customer to choose among materially different candidate parts.
   - `missing_reliable_price`: tell the customer the exact part was identified but no reliable current price was confirmed.
6. If the user needs a file, use `export_quote` on the generated job result or summarize the multi-BOM result directly.

## Output Guidance
- Lead with BOM count, resolved/pending/failed lines, subtotal, tax, and grand total.
- Include supplier/source wording from `priceSource` rather than inventing confidence language.
- Show `priceUpdatedAt` so business users know when the system last confirmed the price.
- Do not invent substitute parts for exact-MPN missing-price cases.
