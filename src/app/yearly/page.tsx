"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Icon } from "@/components/AppShell";
import { YearChart } from "@/components/Charts";
import { byMonth, totals } from "@/lib/aggregate";
import { categoriesFor, emojiFor, TYPE_LABEL } from "@/lib/categories";
import { currentMonth, shortWon, won } from "@/lib/format";
import { useTransactions } from "@/lib/hooks";
import type { Transaction, TxType } from "@/lib/types";
import { useMonth } from "@/lib/useMonth";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const SECTIONS: TxType[] = ["income", "expense", "saving"];

interface Row {
  category: string;
  byMonth: number[];
  total: number;
}

/** 유형별로 카테고리 × 월 합계 표를 만든다. 카테고리 순서는 기본 목록 순서를 따른다(금액 순위로 바뀌지 않게). */
function buildMatrix(txs: Transaction[], type: TxType): Row[] {
  const map = new Map<string, number[]>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const arr = map.get(t.category) ?? new Array(12).fill(0);
    arr[Number(t.date.slice(5, 7)) - 1] += t.amount;
    map.set(t.category, arr);
  }
  const order = categoriesFor(type, [...map.keys()]).map((c) => c.name);
  return order
    .filter((c) => map.has(c))
    .map((category) => {
      const arr = map.get(category)!;
      return { category, byMonth: arr, total: arr.reduce((a, b) => a + b, 0) };
    });
}

export default function YearlyPage() {
  const router = useRouter();
  const [month, setMonth] = useMonth();
  const [year, setYear] = useState(month.slice(0, 4));
  const { data: txs, loading, error } = useTransactions(`${year}-01-01`, `${year}-12-31`);
  const [showAmounts, setShowAmounts] = useState<"short" | "full">("short");

  const thisMonth = currentMonth();
  // 올해면 지난 달까지만(진행 중인 달 제외) 평균, 지난 해면 12개월
  const elapsed = year < thisMonth.slice(0, 4) ? 12 : year === thisMonth.slice(0, 4) ? Number(thisMonth.slice(5)) : 0;

  const view = useMemo(() => {
    const months = MONTHS.map((m) => `${year}-${m}`);
    const monthly = byMonth(txs, months);
    const sum = totals(txs);
    const activeMonths = monthly.filter((m) => m.expense + m.income + m.saving > 0).length;
    return {
      monthly,
      sum,
      activeMonths,
      matrix: Object.fromEntries(SECTIONS.map((t) => [t, buildMatrix(txs, t)])) as Record<TxType, Row[]>,
    };
  }, [txs, year]);

  const avgBase = Math.max(1, Math.min(elapsed || 12, view.activeMonths || 1));
  const left = view.sum.income - view.sum.expense - view.sum.saving;
  const fmt = showAmounts === "short" ? shortWon : (n: number) => n.toLocaleString("ko-KR");
  const maxExpenseCell = Math.max(1, ...view.matrix.expense.flatMap((r) => r.byMonth));

  function openMonth(m: string) {
    setMonth(m);
    router.push("/");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="rounded-full p-2 text-ink-2" aria-label="이전 해" onClick={() => setYear(String(Number(year) - 1))}>
            <Icon d="M15 6l-6 6 6 6" size={20} />
          </button>
          <h1 className="min-w-[5.5rem] text-center text-lg font-bold">{year}년</h1>
          <button className="rounded-full p-2 text-ink-2" aria-label="다음 해" onClick={() => setYear(String(Number(year) + 1))}>
            <Icon d="M9 6l6 6-6 6" size={20} />
          </button>
        </div>
        <button className="chip" onClick={() => setShowAmounts(showAmounts === "short" ? "full" : "short")}>
          {showAmounts === "short" ? "원 단위로" : "만 단위로"}
        </button>
      </header>

      {error && <p className="card p-3 text-sm text-danger">불러오지 못했어요: {error}</p>}

      <section className="card grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
        <div>
          <p className="text-xs text-muted">연간 수입</p>
          <p className="tabular text-lg font-bold text-plus">{won(view.sum.income)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">연간 지출</p>
          <p className="tabular text-lg font-bold">{won(view.sum.expense)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">연간 저축</p>
          <p className="tabular text-lg font-bold">{won(view.sum.saving)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">남은 돈</p>
          <p className={`tabular text-lg font-bold ${left < 0 ? "text-danger" : ""}`}>{won(left)}</p>
        </div>
        <div className="col-span-2 flex justify-between border-t border-line pt-3 text-xs text-ink-2">
          <span>
            월평균 지출 <b className="tabular text-ink">{won(view.sum.expense / avgBase)}</b>
          </span>
          <span>
            저축률{" "}
            <b className="tabular text-ink">{view.sum.income ? Math.round((view.sum.saving / view.sum.income) * 100) : 0}%</b>
          </span>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">월별 현황</h2>
        <YearChart data={view.monthly} selected={month} onSelect={openMonth} />
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-baseline justify-between p-4 pb-2">
          <h2 className="font-semibold">월별 요약</h2>
          <span className="text-[11px] text-muted">달을 누르면 그 달 상세로 이동</span>
        </div>
        <table className="tabular w-full text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pl-4 text-left font-normal">월</th>
              <th className="py-2 text-right font-normal">수입</th>
              <th className="py-2 text-right font-normal">지출</th>
              <th className="py-2 text-right font-normal">저축</th>
              <th className="py-2 pr-4 text-right font-normal">남은 돈</th>
            </tr>
          </thead>
          <tbody>
            {view.monthly.map((m) => {
              const rest = m.income - m.expense - m.saving;
              const empty = m.income + m.expense + m.saving === 0;
              return (
                <tr
                  key={m.month}
                  onClick={() => openMonth(m.month)}
                  className={`cursor-pointer border-b border-line/50 last:border-0 active:bg-line/40 ${m.month === thisMonth ? "bg-accent/5" : ""}`}
                >
                  <td className="py-2.5 pl-4 font-medium">{Number(m.month.slice(5))}월</td>
                  {empty ? (
                    <td colSpan={4} className="py-2.5 pr-4 text-right text-muted">
                      –
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 text-right text-plus">{fmt(m.income)}</td>
                      <td className="py-2.5 text-right">{fmt(m.expense)}</td>
                      <td className="py-2.5 text-right text-ink-2">{fmt(m.saving)}</td>
                      <td className={`py-2.5 pr-4 text-right font-semibold ${rest < 0 ? "text-danger" : ""}`}>{fmt(rest)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-line font-semibold">
            <tr>
              <td className="py-2.5 pl-4">합계</td>
              <td className="py-2.5 text-right text-plus">{fmt(view.sum.income)}</td>
              <td className="py-2.5 text-right">{fmt(view.sum.expense)}</td>
              <td className="py-2.5 text-right text-ink-2">{fmt(view.sum.saving)}</td>
              <td className={`py-2.5 pr-4 text-right ${left < 0 ? "text-danger" : ""}`}>{fmt(left)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="p-4 pb-2">
          <h2 className="font-semibold">카테고리 × 월</h2>
          <p className="text-[11px] text-muted">지출 칸은 금액이 클수록 진하게 표시돼요 · 옆으로 밀어서 보기</p>
        </div>
        <div className="overflow-x-auto">
          <table className="tabular w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="text-muted">
              <tr>
                <th className="sticky left-0 z-10 border-b border-line bg-card py-2 pl-4 pr-2 text-left font-normal">카테고리</th>
                {MONTHS.map((m) => (
                  <th key={m} className="border-b border-line px-2 py-2 text-right font-normal">
                    <button className={`${`${year}-${m}` === thisMonth ? "font-bold text-ink" : ""}`} onClick={() => openMonth(`${year}-${m}`)}>
                      {Number(m)}월
                    </button>
                  </th>
                ))}
                <th className="border-b border-line px-2 py-2 text-right font-semibold text-ink">합계</th>
                <th className="border-b border-line py-2 pl-2 pr-4 text-right font-normal">월평균</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((type) => {
                const rows = view.matrix[type];
                if (!rows.length) return null;
                const sub = MONTHS.map((_, i) => rows.reduce((s, r) => s + r.byMonth[i], 0));
                const subTotal = sub.reduce((a, b) => a + b, 0);
                return (
                  <Fragment key={type}>
                    <tr className="font-semibold">
                      <td className="sticky left-0 z-10 border-b border-line bg-card py-2 pl-4 pr-2">{TYPE_LABEL[type]} 합계</td>
                      {sub.map((v, i) => (
                        <td key={i} className={`border-b border-line px-2 py-2 text-right ${type === "income" ? "text-plus" : ""}`}>
                          {v ? fmt(v) : <span className="text-muted">–</span>}
                        </td>
                      ))}
                      <td className={`border-b border-line px-2 py-2 text-right ${type === "income" ? "text-plus" : ""}`}>{fmt(subTotal)}</td>
                      <td className="border-b border-line py-2 pl-2 pr-4 text-right">{fmt(Math.round(subTotal / avgBase))}</td>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.category}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-line/50 bg-card py-2 pl-4 pr-2 text-ink-2">
                          {emojiFor(type, r.category)} {r.category}
                        </td>
                        {r.byMonth.map((v, i) => (
                          <td
                            key={i}
                            title={v ? `${r.category} ${Number(MONTHS[i])}월 ${won(v)}` : undefined}
                            className="border-b border-line/50 px-2 py-2 text-right"
                            style={
                              type === "expense" && v
                                ? { background: `color-mix(in srgb, var(--s-expense) ${Math.round(6 + (v / maxExpenseCell) * 44)}%, transparent)` }
                                : undefined
                            }
                          >
                            {v ? fmt(v) : <span className="text-muted/60">·</span>}
                          </td>
                        ))}
                        <td className="border-b border-line/50 px-2 py-2 text-right font-medium">{fmt(r.total)}</td>
                        <td className="border-b border-line/50 py-2 pl-2 pr-4 text-right text-ink-2">{fmt(Math.round(r.total / avgBase))}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !txs.length && <p className="py-8 text-center text-sm text-muted">{year}년 내역이 없어요</p>}
      </section>
    </div>
  );
}
