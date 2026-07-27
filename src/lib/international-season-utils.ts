export type RevenueShareInput = {
  participantType: string;
  percentage: number;
};

export type CalculatedRevenueShare = RevenueShareInput & {
  calculatedAmount: number | null;
};

export function addMonthsDateKey(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

export function addDaysDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function subtractMonthsDateKey(dateKey: string, months: number) {
  return addMonthsDateKey(dateKey, -months);
}

export function daysBetweenDateKeys(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDateKey}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86400000);
}

export function validateRevenueShareTotal(shares: RevenueShareInput[]) {
  const total = shares.reduce((sum, share) => {
    if (share.percentage < 0) {
      throw new Error("Revenue share percentage cannot be negative.");
    }
    return sum + share.percentage;
  }, 0);

  if (Number(total.toFixed(2)) !== 100) {
    throw new Error("Revenue share percentages must total exactly 100.");
  }

  return total;
}

export function calculateRevenueShares(
  grossEarnings: number | null | undefined,
  shares: RevenueShareInput[]
): CalculatedRevenueShare[] {
  validateRevenueShareTotal(shares);

  return shares.map((share) => ({
    ...share,
    calculatedAmount:
      grossEarnings === null || grossEarnings === undefined
        ? null
        : Number(((grossEarnings * share.percentage) / 100).toFixed(2))
  }));
}

export function nicolleNextttOneSeasonDates() {
  const contractStartDate = "2026-07-10";
  const contractEndDate = addMonthsDateKey(contractStartDate, 5);
  const twoMonthAlertDate = subtractMonthsDateKey(contractEndDate, 2);
  const finalPaymentDueDate = addDaysDateKey(contractEndDate, 30);

  return {
    contractEndDate,
    contractStartDate,
    finalPaymentDueDate,
    seasonStartDate: "2026-07-12",
    twoMonthAlertDate
  };
}
