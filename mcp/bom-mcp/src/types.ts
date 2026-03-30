export type BomSourceType = "json" | "csv" | "xlsx";
export type BomJobStatus = "queued" | "running" | "succeeded" | "failed";
export type ExportFormat = "json" | "csv" | "xlsx";

export interface SubmitBomInput {
  sourceType: BomSourceType;
  content?: string | Uint8Array | ArrayBuffer | number[];
  fileUrl?: string;
  customer?: string;
  quoteParams?: {
    currency?: string;
    taxRate?: number;
    targetLeadTimeDays?: number;
    webPricing?: boolean;
    webSuppliers?: Array<"digikey_cn" | "ic_net">;
  };
}

export interface BomLine {
  lineNo?: number;
  partNumber: string;
  quantity: number;
  unitPrice?: number;
  description?: string;
  designator?: string;
  manufacturer?: string;
  rawText?: string;
}

export interface JobRecord {
  jobId: string;
  status: BomJobStatus;
  createdAt: string;
  updatedAt: string;
  progress: number;
  inputMeta: {
    sourceType: BomSourceType;
    lineCount: number;
    customer?: string;
  };
  error?: string;
}

export type QuoteCompletionStatus = "completed" | "completed_with_decisions" | "failed";
export type QuoteLineDecisionType = "resolved" | "ambiguous_candidates" | "missing_reliable_price" | "unresolved";
export type QuotePriceSource = "input" | "catalog" | "digikey_cn" | "ic_net" | "manual" | "missing";
export type QuotePriceConfidence = "high" | "medium" | "low";
export type QuotePricingState = "input" | "live_fetch" | "cached" | "stale_fallback";

export interface QuoteLine {
  lineNo: number;
  partNumber: string;
  description?: string;
  designator?: string;
  manufacturer?: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  decisionType: QuoteLineDecisionType;
  needsCustomerDecision: boolean;
  priceSource?: QuotePriceSource;
  priceUpdatedAt?: string;
  sourceRecordedAt?: string;
  priceConfidence?: QuotePriceConfidence;
  pricingState?: QuotePricingState;
  supplier?: string;
  sourceUrl?: string;
  reason: string;
}

export interface PendingDecisionOption {
  partNumber: string;
  manufacturer?: string;
  unitPrice?: number;
  currency?: string;
  leadTime?: string;
  moq?: number;
  note?: string;
}

export interface PendingDecision {
  lineNo: number;
  description?: string;
  originalPartText: string;
  decisionType: Extract<QuoteLineDecisionType, "ambiguous_candidates" | "missing_reliable_price">;
  reason: string;
  recommendedAction: string;
  options: PendingDecisionOption[];
  question?: string;
}

export interface QuoteResult {
  jobId: string;
  status: QuoteCompletionStatus;
  currency: string;
  taxRate: number;
  totals: {
    subtotal: number;
    tax: number;
    grandTotal: number;
  };
  lines: QuoteLine[];
  pendingDecisions: PendingDecision[];
  failures: Array<{ lineNo: number; code: string; message: string }>;
  warnings: string[];
}

export interface BomQuoteSummary {
  totalLines: number;
  resolvedLines: number;
  pendingDecisionLines: number;
  failedLines: number;
  subtotal: number;
  tax: number;
  grandTotal: number;
}

export interface BomQuoteAggregate {
  bomId: string;
  bomName: string;
  quotedAt: string;
  currency: string;
  summary: BomQuoteSummary;
  lines: QuoteLine[];
  pendingDecisions: PendingDecision[];
  failures: Array<{ lineNo: number; code: string; message: string }>;
  notes: string[];
}

export interface MultiBomQuoteResult {
  requestId: string;
  customer?: string;
  quotedAt: string;
  currency: string;
  summary: {
    bomCount: number;
    totalLines: number;
    resolvedLines: number;
    pendingDecisionLines: number;
    failedLines: number;
  };
  boms: BomQuoteAggregate[];
  crossBomWarnings: string[];
}

export interface SubmitBomOutput {
  jobId: string;
  acceptedAt: string;
  status: "queued";
}

export interface GetBomJobResultOutput {
  status: BomJobStatus;
  progress: number;
  summary: {
    totalLines: number;
    resolvedLines: number;
    pendingDecisionLines: number;
    failedLines: number;
  };
  errors: string[];
}

export interface ExportQuoteOutput {
  filePath: string;
  fileName: string;
  format: ExportFormat;
  mimeType: string;
  expiresAt: string;
  downloadUrl?: string;
}
