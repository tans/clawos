export function validateTaxRate(taxRate: number | undefined, fieldName: string): void {
  if (taxRate !== undefined && (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 1)) {
    throw new Error(`${fieldName} 必须在 0 到 1 之间`);
  }
}
