import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysDateKey,
  addMonthsDateKey,
  calculateRevenueShares,
  nicolleNextttOneSeasonDates,
  subtractMonthsDateKey,
  validateRevenueShareTotal
} from "@/lib/international-season-utils";

test("season date helpers calculate contract and payment dates", () => {
  assert.equal(addMonthsDateKey("2026-07-10", 5), "2026-12-10");
  assert.equal(subtractMonthsDateKey("2026-12-10", 2), "2026-10-10");
  assert.equal(addDaysDateKey("2026-12-10", 30), "2027-01-09");
  assert.deepEqual(nicolleNextttOneSeasonDates(), {
    contractStartDate: "2026-07-10",
    contractEndDate: "2026-12-10",
    seasonStartDate: "2026-07-12",
    twoMonthAlertDate: "2026-10-10",
    finalPaymentDueDate: "2027-01-09"
  });
});

test("revenue shares must total exactly 100", () => {
  assert.equal(
    validateRevenueShareTotal([
      { participantType: "model", percentage: 50 },
      { participantType: "receiving_agency", percentage: 40 },
      { participantType: "mother_agency", percentage: 10 }
    ]),
    100
  );

  assert.throws(
    () =>
      validateRevenueShareTotal([
        { participantType: "model", percentage: 50 },
        { participantType: "receiving_agency", percentage: 30 }
      ]),
    /total exactly 100/
  );

  assert.throws(
    () =>
      validateRevenueShareTotal([
        { participantType: "model", percentage: 101 },
        { participantType: "receiving_agency", percentage: -1 }
      ]),
    /cannot be negative/
  );
});

test("gross earnings can stay absent without inventing zero values", () => {
  const shares = calculateRevenueShares(null, [
    { participantType: "model", percentage: 50 },
    { participantType: "receiving_agency", percentage: 40 },
    { participantType: "mother_agency", percentage: 10 }
  ]);

  assert.deepEqual(
    shares.map((share) => share.calculatedAmount),
    [null, null, null]
  );
});

test("50/40/10 calculation is deterministic when gross earnings are informed", () => {
  const shares = calculateRevenueShares(1000, [
    { participantType: "model", percentage: 50 },
    { participantType: "receiving_agency", percentage: 40 },
    { participantType: "mother_agency", percentage: 10 }
  ]);

  assert.deepEqual(
    shares.map((share) => share.calculatedAmount),
    [500, 400, 100]
  );
});
