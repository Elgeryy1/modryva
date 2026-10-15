import { describe, expect, it } from "vitest";
import { computeWhaleTax } from "./whale-tax.js";

describe("computeWhaleTax", () => {
  it("taxes a single whale above the default threshold", () => {
    const balances = [
      { userId: 1, balance: 100 },
      { userId: 2, balance: 100 },
      { userId: 3, balance: 100 },
      { userId: 4, balance: 100 },
      { userId: 5, balance: 1000 },
    ];
    // median = 100, threshold = 500, tax = round((1000-500)*0.1) = 50
    expect(computeWhaleTax(balances)).toEqual([{ userId: 5, tax: 50 }]);
  });

  it("returns empty for empty input", () => {
    expect(computeWhaleTax([])).toEqual([]);
  });

  it("returns empty when nobody exceeds the threshold", () => {
    const balances = [
      { userId: 1, balance: 10 },
      { userId: 2, balance: 20 },
      { userId: 3, balance: 30 },
      { userId: 4, balance: 40 },
    ];
    // median = (20+30)/2 = 25, threshold = 125, none above
    expect(computeWhaleTax(balances)).toEqual([]);
  });

  it("sorts by tax descending", () => {
    const balances = [
      { userId: 3, balance: 10 },
      { userId: 4, balance: 10 },
      { userId: 5, balance: 10 },
      { userId: 1, balance: 1000 },
      { userId: 2, balance: 600 },
    ];
    // median = 10, threshold = 50; taxes: u1 = round(950*0.1)=95, u2 = round(550*0.1)=55
    expect(computeWhaleTax(balances)).toEqual([
      { userId: 1, tax: 95 },
      { userId: 2, tax: 55 },
    ]);
  });

  it("breaks tax ties by userId ascending", () => {
    const balances = [
      { userId: 3, balance: 10 },
      { userId: 4, balance: 10 },
      { userId: 5, balance: 10 },
      { userId: 2, balance: 600 },
      { userId: 1, balance: 600 },
    ];
    // median = 10, threshold = 50; both taxed 55, ordered by userId asc
    expect(computeWhaleTax(balances)).toEqual([
      { userId: 1, tax: 55 },
      { userId: 2, tax: 55 },
    ]);
  });

  it("honors custom multipleOfMedian and taxRate", () => {
    const balances = [
      { userId: 1, balance: 10 },
      { userId: 2, balance: 10 },
      { userId: 3, balance: 10 },
      { userId: 4, balance: 100 },
    ];
    // median = (10+10)/2 = 10, threshold = 10*2 = 20, tax = round((100-20)*0.5) = 40
    expect(
      computeWhaleTax(balances, { multipleOfMedian: 2, taxRate: 0.5 }),
    ).toEqual([{ userId: 4, tax: 40 }]);
  });

  it("rounds the tax to the nearest integer", () => {
    const balances = [
      { userId: 1, balance: 10 },
      { userId: 2, balance: 10 },
      { userId: 3, balance: 10 },
      { userId: 4, balance: 57 },
    ];
    // median = 10, threshold = 50, tax = round((57-50)*0.1) = round(0.7) = 1
    expect(computeWhaleTax(balances)).toEqual([{ userId: 4, tax: 1 }]);
  });

  it("does not tax a balance exactly at the threshold", () => {
    const balances = [
      { userId: 1, balance: 100 },
      { userId: 2, balance: 100 },
      { userId: 3, balance: 100 },
      { userId: 4, balance: 100 },
      { userId: 5, balance: 500 },
    ];
    // median = 100, threshold = 500, user 5 is at (not above) the threshold
    expect(computeWhaleTax(balances)).toEqual([]);
  });

  it("is order-independent for the same multiset of balances", () => {
    const a = [
      { userId: 3, balance: 10 },
      { userId: 1, balance: 1000 },
      { userId: 5, balance: 10 },
      { userId: 2, balance: 600 },
      { userId: 4, balance: 10 },
    ];
    const b = [
      { userId: 1, balance: 1000 },
      { userId: 2, balance: 600 },
      { userId: 3, balance: 10 },
      { userId: 4, balance: 10 },
      { userId: 5, balance: 10 },
    ];
    expect(computeWhaleTax(a)).toEqual(computeWhaleTax(b));
  });

  it("does not mutate its input", () => {
    const balances = [
      { userId: 2, balance: 600 },
      { userId: 1, balance: 10 },
      { userId: 3, balance: 10 },
    ];
    const snapshot = balances.map((entry) => ({ ...entry }));
    computeWhaleTax(balances);
    expect(balances).toEqual(snapshot);
  });
});
