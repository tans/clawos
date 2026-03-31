import { quoteCustomerMessage } from "../domain/quote-customer-message";
import { validateTaxRate } from "./quote-params";
import type { MultiBomQuoteResult } from "../types";

interface QuoteCustomerMessageInput {
  message: string;
  customer?: string;
  currency?: string;
  taxRate?: number;
  webPricing?: boolean;
  webSuppliers?: Array<"digikey_cn" | "ickey_cn" | "ic_net">;
}

export async function quoteCustomerMessageTool(input: QuoteCustomerMessageInput): Promise<MultiBomQuoteResult> {
  if (!input.message?.trim()) {
    throw new Error("message 不能为空");
  }
  validateTaxRate(input.taxRate, "taxRate");

  return quoteCustomerMessage({
    message: input.message,
    customer: input.customer,
    currency: input.currency,
    taxRate: input.taxRate,
    webPricing: input.webPricing,
    webSuppliers: input.webSuppliers,
  });
}
