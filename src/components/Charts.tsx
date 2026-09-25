"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { emojiFor, TYPE_LABEL } from "@/lib/categories";
import { shortWon, won } from "@/lib/format";
import type { TxType } from "@/lib/types";

const AXIS = { fontSize: 11, fill: "var(--muted)" };

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
          <span className="text-ink-2">{r.label}</span>
          <span className="tabular ml-auto pl-3 font-medium">{won(r.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) 연간 월별 현황: 수입 / 지출 / 저축 묶음 막대

export interface MonthSummary {
  month: string; // YYYY-MM
  expense: number;
  income: number;
  saving: number;
}

const SERIES: { key: TxType; color: string }[] = [
  { key: "expense", color: "var(--s-expense)" },
  { key: "income", color: "var(--s-income)" },
  { key: "saving", color: "var(--s-saving)" },
];

export function YearChart({
  data,
  selected,
  onSelect,
}: {
  data: MonthSummary[];
  selected: string;
  onSelect(month: string): void;
}) {
  const rows = data.map((d) => ({ ...d, label: `${Number(d.month.slice(5))}월` }));
  return (
    <div>
      <Legend items={SERIES.map((s) => ({ label: TYPE_LABEL[s.key], color: s.color }))} />
      <div className="mt-2 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
            barCategoryGap="18%"
            barGap={2}
            onClick={(state) => {
              const i = state?.activeTooltipIndex;
              if (i != null && rows[Number(i)]) onSelect(rows[Number(i)].month);
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              interval={0}
              tick={(props) => {
                const { x, y, payload, index } = props as { x: number; y: number; payload: { value: string }; index: number };
                const isSel = rows[index]?.month === selected;
                return (
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={isSel ? 700 : 400} fill={isSel ? "var(--ink)" : "var(--muted)"}>
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis tickFormatter={shortWon} tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "var(--line)", opacity: 0.5 }}
              content={(p) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={String(p.label)}
                    rows={SERIES.map((s) => ({
                      label: TYPE_LABEL[s.key],
                      value: Number(p.payload?.[0]?.payload?.[s.key] ?? 0),
                      color: s.color,
                    }))}
                  />
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={10} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) 이번 달 지출 흐름: 일별 누적 지출, 지난달과 비교

export function DailyCumulativeChart({
  current,
  previous,
  days,
  todayIndex,
}: {
  /** 1일부터의 일별 지출 금액 */
  current: number[];
  previous: number[];
  days: number;
  /** 이번 달이면 오늘 날짜(그 뒤로는 선을 그리지 않음), 지난 달이면 null */
  todayIndex: number | null;
}) {
  const acc = (xs: number[]) => {
    let s = 0;
    return xs.map((v) => (s += v));
  };
  const cur = acc(current);
  const prev = acc(previous);
  const rows = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    current: todayIndex == null || i < todayIndex ? cur[i] : null,
    previous: prev[i] ?? prev[prev.length - 1] ?? 0,
  }));

  return (
    <div>
      <Legend
        items={[
          { label: "이번 달", color: "var(--s-expense)" },
          { label: "지난 달", color: "var(--s-compare)", dashed: true },
        ]}
      />
      <div className="mt-2 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--axis)" }} ticks={[1, 10, 20, days]} tickFormatter={(d) => `${d}일`} />
            <YAxis tickFormatter={shortWon} tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={(p) => {
                if (!p.active || !p.payload?.length) return null;
                const row = p.payload[0].payload as (typeof rows)[number];
                return (
                  <TooltipBox
                    title={`${row.day}일까지 누적`}
                    rows={[
                      ...(row.current != null ? [{ label: "이번 달", value: row.current, color: "var(--s-expense)" }] : []),
                      { label: "지난 달", value: row.previous, color: "var(--s-compare)" },
                    ]}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="previous" stroke="var(--s-compare)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="current" stroke="var(--s-expense)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3) 카테고리별 지출: 가로 막대 목록 (한 가지 색, 크기가 곧 정보)

export function CategoryBars({
  items,
  type = "expense",
  onPick,
}: {
  items: { category: string; amount: number; count: number }[];
  type?: TxType;
  onPick?(category: string): void;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const max = Math.max(1, ...items.map((i) => i.amount));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">내역이 없어요</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.category}>
          <button type="button" className="w-full text-left" onClick={() => onPick?.(it.category)} title={`${it.category} ${won(it.amount)} (${it.count}건)`}>
            <div className="flex items-baseline gap-2 text-sm">
              <span>{emojiFor(type, it.category)}</span>
              <span className="font-medium">{it.category}</span>
              <span className="text-xs text-muted">{Math.round((it.amount / total) * 100)}%</span>
              <span className="tabular ml-auto font-semibold">{won(it.amount)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-line/60">
              <div className="h-2 rounded-full" style={{ width: `${(it.amount / max) * 100}%`, background: "var(--s-expense)" }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
