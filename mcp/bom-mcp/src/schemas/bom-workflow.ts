import { z } from "zod";

export const CurrencySchema = z.string().min(3).max(8).default("CNY");
export const MatchStatusSchema = z.enum(["matched", "partial", "unmatched", "ambiguous"]);
export const ReviewSeveritySchema = z.enum(["low", "medium", "high"]);
export const QuoteSourceTypeSchema = z.enum(["history", "site", "manual"]);
export const ExportFormatSchema = z.enum(["json", "csv", "xlsx", "pdf"]);

export const ErrorItemSchema = z.object({
  code: z.string(),
  message: z.string(),
  level: z.enum(["info", "warning", "error"]).default("error"),
  lineNo: z.number().int().positive().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const WarningItemSchema = z.object({
  code: z.string(),
  message: z.string(),
  lineNo: z.number().int().positive().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ResponseMetaSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
  version: z.string().optional(),
});

export const EnvelopeBaseSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  jobId: z.string(),
  stage: z.string(),
  warnings: z.array(WarningItemSchema).default([]),
  errors: z.array(ErrorItemSchema).default([]),
  meta: ResponseMetaSchema.default({}),
});

export const BomLineSchema = z.object({
  lineNo: z.number().int().positive(),
  refdes: z.array(z.string()).default([]),
  mpnRaw: z.string(),
  manufacturerRaw: z.string().optional(),
  descriptionRaw: z.string().optional(),
  packageRaw: z.string().optional(),
  qty: z.number().positive(),
  unit: z.string().default("pcs"),
  targetPrice: z.number().nonnegative().nullable().optional(),
  targetCurrency: CurrencySchema.optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export const NormalizedBomLineSchema = BomLineSchema.extend({
  mpnNormalized: z.string(),
  manufacturerNormalized: z.string().optional(),
  descriptionNormalized: z.string().optional(),
  packageNormalized: z.string().optional(),
});

export const PartCandidateSchema = z.object({
  canonicalPartId: z.string(),
  canonicalMpn: z.string(),
  manufacturer: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const PartMatchSchema = z.object({
  lineNo: z.number().int().positive(),
  matchStatus: MatchStatusSchema,
  canonicalPartId: z.string().optional(),
  canonicalMpn: z.string().optional(),
  manufacturer: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  candidates: z.array(PartCandidateSchema).default([]),
});

export const HistoricalPriceSchema = z.object({
  lineNo: z.number().int().positive(),
  canonicalPartId: z.string(),
  source: z.literal("history"),
  supplier: z.string(),
  unitPrice: z.number().nonnegative(),
  currency: CurrencySchema,
  moq: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  quotedAt: z.string(),
  priceBook: z.string(),
});

export const VendorQuoteSchema = z.object({
  lineNo: z.number().int().positive(),
  supplier: z.string(),
  supplierPartNumber: z.string().optional(),
  canonicalPartId: z.string().optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
  unitPrice: z.number().nonnegative(),
  currency: CurrencySchema,
  moq: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  taxIncluded: z.boolean().optional(),
  packaging: z.string().optional(),
  sourceType: QuoteSourceTypeSchema,
  sourceSite: z.string().optional(),
  rawQuoteId: z.string().optional(),
  fetchedAt: z.string().optional(),
});

export const RecommendedQuoteSchema = z.object({
  lineNo: z.number().int().positive(),
  canonicalPartId: z.string().optional(),
  recommendedSupplier: z.string(),
  recommendedUnitPrice: z.number().nonnegative(),
  currency: CurrencySchema,
  extendedPrice: z.number().nonnegative(),
  reason: z.string(),
  score: z.number().min(0).max(1),
  alternatives: z.array(VendorQuoteSchema).default([]),
});

export const ReviewItemSchema = z.object({
  lineNo: z.number().int().positive(),
  type: z.string(),
  severity: ReviewSeveritySchema,
  reason: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export const QuoteTotalsSchema = z.object({
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const FinalQuoteItemSchema = z.object({
  lineNo: z.number().int().positive(),
  partNumber: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  supplier: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  currency: CurrencySchema,
});

export const FinalQuoteDocumentSchema = z.object({
  quoteId: z.string(),
  customer: z.string().optional(),
  currency: CurrencySchema,
  items: z.array(FinalQuoteItemSchema),
  totals: QuoteTotalsSchema,
  generatedAt: z.string(),
});

export const ParseBomInputSchema = z.object({
  jobId: z.string().optional(),
  bomFile: z.string(),
  sheet: z.string().optional(),
  headerRow: z.number().int().positive().default(1),
  options: z.object({
    trimWhitespace: z.boolean().default(true),
  }).default({ trimWhitespace: true }),
});

export const ParseBomOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    bomFile: z.string(),
    detectedFormat: z.enum(["csv", "xlsx", "json", "xls"]).optional(),
    lines: z.array(BomLineSchema),
    stats: z.object({
      lineCount: z.number().int().nonnegative(),
    }),
  }),
});

export const NormalizeFieldsInputSchema = z.object({
  jobId: z.string(),
  currency: CurrencySchema.default("CNY"),
  lines: z.array(BomLineSchema),
});

export const NormalizeFieldsOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    lines: z.array(NormalizedBomLineSchema),
    stats: z.object({
      normalizedCount: z.number().int().nonnegative(),
    }),
  }),
});

export const ResolvePartsInputSchema = z.object({
  jobId: z.string(),
  minMatchConfidence: z.number().min(0).max(1).default(0.85),
  lines: z.array(NormalizedBomLineSchema),
});

export const ResolvePartsOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    lines: z.array(NormalizedBomLineSchema),
    matches: z.array(PartMatchSchema),
    unmatchedLines: z.array(z.number().int().positive()).default([]),
    stats: z.object({
      matched: z.number().int().nonnegative(),
      partialMatched: z.number().int().nonnegative(),
      unmatched: z.number().int().nonnegative(),
    }),
  }),
});

export const LookupPriceHistoryInputSchema = z.object({
  jobId: z.string(),
  priceBook: z.string().default("default"),
  currency: CurrencySchema.default("CNY"),
  lines: z.array(NormalizedBomLineSchema),
  matches: z.array(PartMatchSchema),
});

export const LookupPriceHistoryOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    pricedItems: z.array(HistoricalPriceSchema),
    missingItems: z.array(PartMatchSchema),
    partialItems: z.array(HistoricalPriceSchema).default([]),
    stats: z.object({
      historyHit: z.number().int().nonnegative(),
      missing: z.number().int().nonnegative(),
    }),
  }),
});

export const FetchVendorQuotesInputSchema = z.object({
  jobId: z.string(),
  currency: CurrencySchema.default("CNY"),
  missingItems: z.array(PartMatchSchema),
  vendors: z.array(z.string()).default(["siteA", "siteB", "siteC"]),
  options: z.object({
    timeoutMs: z.number().int().positive().default(8000),
    useCache: z.boolean().default(true),
  }).default({ timeoutMs: 8000, useCache: true }),
});

export const FetchVendorQuotesOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    rawResults: z.array(z.object({
      vendor: z.string(),
      items: z.array(z.unknown()),
    })),
    stats: z.object({
      requestedLines: z.number().int().nonnegative(),
      vendorCount: z.number().int().nonnegative(),
    }),
  }),
});

export const ExtractPricesInputSchema = z.object({
  jobId: z.string(),
  rawResults: z.array(z.object({
    vendor: z.string(),
    items: z.array(z.unknown()),
  })),
});

export const ExtractPricesOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    quotes: z.array(VendorQuoteSchema),
    stats: z.object({
      extractedQuoteCount: z.number().int().nonnegative(),
    }),
  }),
});

export const CleanQuotesInputSchema = z.object({
  jobId: z.string(),
  currency: CurrencySchema.default("CNY"),
  quotes: z.array(VendorQuoteSchema),
});

export const CleanQuotesOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    quotes: z.array(VendorQuoteSchema),
    droppedQuotes: z.array(VendorQuoteSchema).default([]),
    stats: z.object({
      inputQuoteCount: z.number().int().nonnegative(),
      keptQuoteCount: z.number().int().nonnegative(),
    }),
  }),
});

export const CompareQuotesInputSchema = z.object({
  jobId: z.string(),
  pricedItems: z.array(HistoricalPriceSchema).default([]),
  quotes: z.array(VendorQuoteSchema).default([]),
  currency: CurrencySchema.default("CNY"),
  strategy: z.union([
    z.literal("balanced"),
    z.literal("lowest_price"),
    z.literal("fastest_delivery"),
    z.object({
      preferInStock: z.boolean().optional(),
      preferLowerMoq: z.boolean().optional(),
      leadTimeWeight: z.number().min(0).max(1).optional(),
      priceWeight: z.number().min(0).max(1).optional(),
      supplierWeight: z.number().min(0).max(1).optional(),
    }),
  ]).default("balanced"),
});

export const CompareQuotesOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    recommendedItems: z.array(RecommendedQuoteSchema),
    alternativeItems: z.array(z.object({
      lineNo: z.number().int().positive(),
      alternatives: z.array(VendorQuoteSchema),
    })).default([]),
    stats: z.object({
      recommendedCount: z.number().int().nonnegative(),
    }),
  }),
});

export const DetectAnomaliesInputSchema = z.object({
  jobId: z.string(),
  recommendedItems: z.array(RecommendedQuoteSchema),
  rules: z.object({
    priceJumpPct: z.number().min(0).default(0.3),
    leadTimeDays: z.number().int().positive().default(45),
    minMatchConfidence: z.number().min(0).max(1).default(0.85),
    stockShortage: z.boolean().default(true),
    highMoqRatio: z.number().positive().default(3),
  }).default({
    priceJumpPct: 0.3,
    leadTimeDays: 45,
    minMatchConfidence: 0.85,
    stockShortage: true,
    highMoqRatio: 3,
  }),
});

export const DetectAnomaliesOutputSchema = EnvelopeBaseSchema.extend({
  requiresHumanReview: z.boolean(),
  data: z.object({
    reviewItems: z.array(ReviewItemSchema),
    acceptedItems: z.array(RecommendedQuoteSchema),
    stats: z.object({
      reviewCount: z.number().int().nonnegative(),
    }),
  }),
});

export const PrepareReviewInputSchema = z.object({
  jobId: z.string(),
  customer: z.string().optional(),
  currency: CurrencySchema.default("CNY"),
  reviewItems: z.array(ReviewItemSchema),
  recommendedItems: z.array(RecommendedQuoteSchema).default([]),
  mode: z.enum(["standard", "approval-preview"]).default("standard").optional(),
});

export const PrepareReviewOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    summary: z.object({
      customer: z.string().optional(),
      reviewCount: z.number().int().nonnegative(),
      totalAmount: z.number().nonnegative().optional(),
    }),
    reviewItems: z.array(ReviewItemSchema),
    approvalPreview: z.object({
      title: z.string(),
      items: z.array(z.unknown()),
    }),
  }),
});

export const FinalizeQuoteInputSchema = z.object({
  jobId: z.string(),
  customer: z.string().optional(),
  currency: CurrencySchema.default("CNY"),
  recommendedItems: z.array(RecommendedQuoteSchema),
  reviewOverrides: z.array(z.record(z.string(), z.unknown())).default([]),
  reviewApproved: z.boolean().default(false),
});

export const FinalizeQuoteOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    quote: FinalQuoteDocumentSchema,
  }),
});

export const ExportQuoteInputSchema = z.object({
  jobId: z.string(),
  format: ExportFormatSchema.default("xlsx"),
  quote: FinalQuoteDocumentSchema,
});

export const ExportQuoteOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    file: z.object({
      path: z.string(),
      name: z.string(),
      format: ExportFormatSchema,
      size: z.number().int().nonnegative().optional(),
    }),
  }),
});

export const WritePriceHistoryInputSchema = z.object({
  jobId: z.string(),
  priceBook: z.string().default("default"),
  quote: FinalQuoteDocumentSchema,
});

export const WritePriceHistoryOutputSchema = EnvelopeBaseSchema.extend({
  data: z.object({
    writtenCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
  }),
});

export const BomWorkflowActionSchemas = {
  parse_bom: {
    input: ParseBomInputSchema,
    output: ParseBomOutputSchema,
  },
  normalize_fields: {
    input: NormalizeFieldsInputSchema,
    output: NormalizeFieldsOutputSchema,
  },
  resolve_parts: {
    input: ResolvePartsInputSchema,
    output: ResolvePartsOutputSchema,
  },
  lookup_price_history: {
    input: LookupPriceHistoryInputSchema,
    output: LookupPriceHistoryOutputSchema,
  },
  fetch_vendor_quotes: {
    input: FetchVendorQuotesInputSchema,
    output: FetchVendorQuotesOutputSchema,
  },
  extract_prices: {
    input: ExtractPricesInputSchema,
    output: ExtractPricesOutputSchema,
  },
  clean_quotes: {
    input: CleanQuotesInputSchema,
    output: CleanQuotesOutputSchema,
  },
  compare_quotes: {
    input: CompareQuotesInputSchema,
    output: CompareQuotesOutputSchema,
  },
  detect_anomalies: {
    input: DetectAnomaliesInputSchema,
    output: DetectAnomaliesOutputSchema,
  },
  prepare_review: {
    input: PrepareReviewInputSchema,
    output: PrepareReviewOutputSchema,
  },
  finalize_quote: {
    input: FinalizeQuoteInputSchema,
    output: FinalizeQuoteOutputSchema,
  },
  export_quote_v2: {
    input: ExportQuoteInputSchema,
    output: ExportQuoteOutputSchema,
  },
  write_price_history: {
    input: WritePriceHistoryInputSchema,
    output: WritePriceHistoryOutputSchema,
  },
} as const;

export type BomWorkflowActionName = keyof typeof BomWorkflowActionSchemas;
