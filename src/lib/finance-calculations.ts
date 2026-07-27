export type AccountingCurrency = "BRL" | "USD" | "EUR";

export const accountingCurrencies: AccountingCurrency[] = ["BRL", "USD", "EUR"];
export const defaultAccountingCurrency: AccountingCurrency = "BRL";

export function isAccountingCurrency(value: string | null | undefined): value is AccountingCurrency {
  return accountingCurrencies.includes(value as AccountingCurrency);
}

export function decimalToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return BigInt(0);
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return BigInt(0);
  return BigInt(Math.round(parsed * 100));
}

export function centsToDecimal(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const major = absolute / BigInt(100);
  const minor = absolute % BigInt(100);
  return `${negative ? "-" : ""}${major}.${String(minor).padStart(2, "0")}`;
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: AccountingCurrency = defaultAccountingCurrency
) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return new Intl.NumberFormat("pt-BR", {
    currency,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

export function calculateAroFinancialAmounts({
  agencyFeePercent,
  deductionsAmount = 0,
  modelBaseFee
}: {
  agencyFeePercent: number;
  deductionsAmount?: number;
  modelBaseFee: number;
}) {
  const agencyFeeAmount = roundMoney(modelBaseFee * agencyFeePercent / 100);
  const clientAmountDue = roundMoney(modelBaseFee + agencyFeeAmount);
  const modelNetAmount = roundMoney(modelBaseFee - deductionsAmount);

  return {
    agencyFeeAmount,
    clientAmountDue,
    modelNetAmount
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
