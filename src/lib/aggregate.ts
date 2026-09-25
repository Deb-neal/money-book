import type { Transaction, TxType } from "./types";
import { daysInMonth } from "./format";

export interface Totals {
  expense: number;
  income: number;
  saving: number;
}

export function totals(txs: Transaction[]): Totals {
  const t: Totals = { expense: 0, income: 0, saving: 0 };
  for (const x of txs) t[x.type] += x.amount;
  return t;
}

export function byMonth(txs: Transaction[], months: string[]): (Totals & { month: string })[] {
  return months.map((month) => ({ month, ...totals(txs.filter((t) => t.date.startsWith(month))) }));
}

export function byCategory(txs: Transaction[], type: TxType) {
  const map = new Map<string, { category: string; amount: number; count: number }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const e = map.get(t.category) ?? { category: t.category, amount: 0, count: 0 };
    e.amount += t.amount;
    e.count += 1;
    map.set(t.category, e);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** 1일~말일 일별 지출 금액 */
export function dailyExpense(txs: Transaction[], month: string): number[] {
  const out = new Array(daysInMonth(month)).fill(0);
  for (const t of txs) {
    if (t.type === "expense" && t.date.startsWith(month)) out[Number(t.date.slice(8)) - 1] += t.amount;
  }
  return out;
}

export function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of txs) map.set(t.date, [...(map.get(t.date) ?? []), t]);
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
