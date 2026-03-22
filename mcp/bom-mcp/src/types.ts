export type BomSourceType = "json" | "csv" | "xlsx";
export type BomJobStatus = "queued" | "running" | "succeeded" | "failed";
export type ExportFormat = "json" | "csv" | "xlsx";

export interface SubmitBomInput {
  sourceType: BomSourceType;
  content?: string;
  fileUrl?: string;
  customer?: string;
  quoteParams?: {
    currency?: string;
    taxRate?: number;
    targetLeadTimeDays?: number;
  };
}

export interface BomLine {
  partNumber: string;
  quantity: number;
  unitPrice?: number;
  description?: string;
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

export interface QuoteItem {
  partNumber: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface QuoteResult {
  jobId: string;
  currency: string;
  taxRate: number;
  totals: {
    subtotal: number;
    tax: number;
    grandTotal: number;
  };
  items: QuoteItem[];
  missingItems: Array<{ partNumber: string; reason: string }>;
  warnings: string[];
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
    successLines: number;
    failedLines: number;
  };
  errors: string[];
}

export interface ExportQuoteOutput {
  downloadUrl: string;
  expiresAt: string;
}
