"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icon, SETTINGS_ICON } from "@/components/AppShell";
import { CategoryBars, DailyCumulativeChart, YearChart } from "@/components/Charts";
import { EditSheet } from "@/components/EditSheet";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { TransactionRow } from "@/components/TransactionList";
import { byCategory, byMonth, dailyExpense, totals } from "@/lib/aggregate";
import { addMonths, currentMonth, daysInMonth, won } from "@/lib/format";
import { useRecurring, useTransactions } from "@/lib/hooks";
import { pendingRecurring, recurringToTransaction } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { useMonth } from "@/lib/useMonth";

export default function Dashboard() {
  const { store, bump } = useApp();
  const [month, setMonth] = useMonth();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [applying, setApplying] = useState(false);

  const year = month.slice(0, 4);
  const prevMonth = addMonths(month, -1);
  // 선택 연도 전체 + 직전 달(1월의 전월 비교용)을 한 번에 불러온다
  const from = prevMonth < `${year}-01` ? `${prevMonth}-01` : `${year}-01-01`;
  const { data: txs, loading, error } = useTransactions(from, `${year}-12-31`);
  const { data: recurring } = useRecurring();

  const view = useMemo(() => {
    const monthTx = txs.filter((t) => t.date.startsWith(month));
    const prevTx = txs.filter((t) => t.date.startsWith(prevMonth));
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    return {
      monthTx,
      sum: totals(monthTx),
      prevSum: totals(prevTx),
      categories: byCategory(monthTx, "expense"),
      yearly: byMonth(txs, months),
      daily: dailyExpense(monthTx, month),
      prevDaily: dailyExpense(prevTx, prevMonth),
    };
  }, [txs, month, prevMonth, year]);

  const pending = pendingRecurring(recurring, view.monthTx);
  const isCurrent = month === currentMonth();
  const left = view.sum.income - view.sum.expense - view.sum.saving;
  // 이번 달이면 지난달 "같은 날짜까지"와 비교해야 공정하다
  const prevSameDay = isCurrent
    ? view.prevDaily.slice(0, new Date().getDate()).reduce((a, b) => a + b, 0)
    : view.prevSum.expense;
  const diff = view.sum.expense - prevSameDay;

  async function applyRecurring() {
    setApplying(true);
    try {
      await store!.addTransactions(pending.map((r) => recurringToTransaction(month, r)));
      bump();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <MonthSwitcher month={month} onChange={setMonth} />
        <div className="flex items-center gap-1">
          {!isCurrent && (
            <button className="chip" onClick={() => setMonth(currentMonth())}>
              이번 달
            </button>
          )}
          <Link href="/settings/" aria-label="설정" className="rounded-full p-2 text-ink-2">
            <Icon d={SETTINGS_ICON} size={22} />
          </Link>
        </div>
      </header>

      {error && <p className="card p-3 text-sm text-danger">불러오지 못했어요: {error}</p>}

      {pending.length > 0 && !loading && (
        <div className="card flex items-center gap-3 p-3">
          <span className="text-xl">🔁</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">고정 항목 {pending.length}건이 아직 없어요</p>
            <p className="truncate text-xs text-muted">{pending.map((r) => r.title).join(", ")}</p>
          </div>
          <button className="btn btn-primary px-3 py-2 text-sm" disabled={applying} onClick={applyRecurring}>
            {applying ? "반영 중…" : "한 번에 반영"}
          </button>
        </div>
      )}

      <section className="card p-4">
        <p className="text-sm text-ink-2">{isCurrent ? "이번 달" : `${Number(month.slice(5))}월`} 지출</p>
        <p className="mt-1 text-3xl font-bold">{won(view.sum.expense)}</p>
        {prevSameDay > 0 && (
          <p className="mt-1 text-xs text-muted">
            {isCurrent ? "지난달 같은 날보다" : "지난달보다"} <span className="font-semibold text-ink-2">{won(Math.abs(diff))}</span> {diff >= 0 ? "더 썼어요" : "덜 썼어요"}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted">수입</dt>
            <dd className="tabular font-semibold text-plus">{won(view.sum.income)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">저축</dt>
            <dd className="tabular font-semibold">{won(view.sum.saving)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">남은 돈</dt>
            <dd className={`tabular font-semibold ${left < 0 ? "text-danger" : ""}`}>{won(left)}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">지출 흐름</h2>
        <DailyCumulativeChart
          current={view.daily}
          previous={view.prevDaily}
          days={daysInMonth(month)}
          todayIndex={isCurrent ? new Date().getDate() : null}
        />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">카테고리별 지출</h2>
          <Link href="/history/" className="text-xs text-accent">
            전체 내역
          </Link>
        </div>
        <CategoryBars items={view.categories} />
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">{year}년 월별 현황</h2>
          <Link href="/yearly/" className="text-xs text-accent">
            연간 표로 보기
          </Link>
        </div>
        <YearChart data={view.yearly} selected={month} onSelect={setMonth} />
        <p className="mt-2 text-center text-[11px] text-muted">막대를 누르면 그 달로 이동해요</p>
      </section>

      <section className="card px-4 pb-2 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">최근 내역</h2>
          <Link href="/history/" className="text-xs text-accent">
            더보기
          </Link>
        </div>
        <div className="divide-y divide-line/60">
          {view.monthTx.slice(0, 5).map((t) => (
            <TransactionRow key={t.id} tx={t} onClick={() => setEditing(t)} />
          ))}
          {!view.monthTx.length && !loading && <p className="py-6 text-center text-sm text-muted">아직 내역이 없어요</p>}
        </div>
      </section>

      <EditSheet tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
