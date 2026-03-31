---
name: bom-quote
description: Use when quoting one or more electronic BOMs from customer messages, spreadsheets, or CSV blocks and the result needs price source, pending decisions, and business-ready export data
---

# BOM Quote

## Overview
Use `bom-mcp` to turn electronic BOM input into a business-usable quote summary. Default to completing the quote automatically; only stop for customer choice when the system marks `ambiguous_candidates` or `missing_reliable_price`.

## When to Use
- Customer sends one or more BOM tables, CSV blocks, or workbook files and wants pricing.
- The quote needs line-level `priceSource`, `priceUpdatedAt`, `sourceCurrency`, and decision status.
- The team needs a quick business summary, not a perfect copy of the customer's workbook.

## Workflow
1. If the user message contains one or more BOM blocks, call `quote_customer_message`.
2. Set `currency` to `CNY` unless the user asks otherwise.
3. Enable `webPricing` when local price is missing. Prefer `webSuppliers: ["ickey_cn", "digikey_cn", "ic_net"]`.
4. Present totals, resolved lines, pending decision lines, failures, plus `priceUpdatedAt`, `sourceRecordedAt`, `pricingState`, and any `sourceCurrency` / `fxRate` data as business reference.
5. If the result includes pending decisions:
- `ambiguous_candidates`: ask the customer to choose among materially different candidate parts.
- `missing_reliable_price`: tell the customer the exact part was identified but no reliable current price was confirmed.
6. If the user needs a file, use `export_quote` for a single BOM job, or `export_customer_quote` for a multi-BOM customer message.
7. Treat export results as file-first: consume `filePath`, `fileName`, `format`, `mimeType`, and `expiresAt` as the primary contract. Use `downloadUrl` only when the host explicitly provides it.
8. If the tool reports runtime/setup issues, run `doctor` first and use its path/check output to diagnose missing DB, export dir, cache dir, or `publicBaseUrl` configuration.

## Output Guidance
- Lead with BOM count, resolved/pending/failed lines, subtotal, tax, and grand total.
- Include supplier/source wording from `priceSource` rather than inventing confidence language.
- Show both `priceUpdatedAt` and `sourceRecordedAt` so business users can distinguish quote-time processing from the source's last confirmed price time.
- Use `pricingState` to distinguish fresh fetches, cached values, and stale-cache fallback.
- If `sourceCurrency` differs from quote currency, show `sourceUnitPrice`, `sourceCurrency`, `fxRate`, and `fxPair`. If no FX was configured, treat the line as unresolved rather than silently mixing currencies.
- Do not invent substitute parts for exact-MPN missing-price cases.
- Treat `ickey_cn` as a strong public candidate source for manufacturer / stock / MOQ / lead time. Its public pages may still omit a directly usable price, so exact-MPN lines can remain `missing_reliable_price` even when candidate rows are available.
- When returning an export result to the host, prefer reporting the local file metadata directly. Do not assume a `downloadUrl` exists.
