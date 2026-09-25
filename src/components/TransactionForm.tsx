"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, categoriesFor, TYPE_LABEL } from "@/lib/categories";
import { parseAmount, today } from "@/lib/format";
import type { NewTransaction, Transaction, TxType } from "@/lib/types";

const QUICK = [1000, 5000, 10000, 50000];
const LAST_KEY = "money-book:last-category";

function lastCategory(type: TxType): string {
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "{}")[type];
    if (typeof last === "string" && last) return last;
  } catch {}
  return CATEGORIES[type][0].name;
}

interface Props {
  initial?: Transaction;
  /** 기존 내역에서 쓰인 카테고리 (노션에서 가져온 카테고리 등) */
  usedCategories?: { type: TxType; category: string }[];
  onSubmit(tx: NewTransaction): Promise<void>;
  onDelete?(): Promise<void>;
  submitLabel?: string;
}

/** 금액 → 카테고리 → 저장, 3번 터치로 끝나는 입력 폼 */
export function TransactionForm({ initial, usedCategories = [], onSubmit, onDelete, submitLabel = "저장" }: Props) {
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [amountText, setAmountText] = useState(initial ? initial.amount.toLocaleString("ko-KR") : "");
  const [category, setCategory] = useState(() => initial?.category ?? lastCategory("expense"));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [account, setAccount] = useState(initial?.account ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [more, setMore] = useState(Boolean(initial?.account || initial?.memo));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText);
  const cats = useMemo(
    () => categoriesFor(type, [...new Set([...usedCategories.filter((u) => u.type === type).map((u) => u.category), category])]),
    [type, usedCategories, category],
  );

  // 유형을 바꾸면 그 유형에서 마지막으로 쓴 카테고리를 기본 선택
  function changeType(t: TxType) {
    setType(t);
    setCategory(lastCategory(t));
  }

  useEffect(() => {
    if (!initial) amountRef.current?.focus();
  }, [initial]);

  function setAmount(n: number) {
    setAmountText(n > 0 ? n.toLocaleString("ko-KR") : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      setError("금액을 입력해 주세요.");
      amountRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        type,
        amount,
        category,
        title: title.trim() || category,
        date,
        account: account.trim() || null,
        memo: memo.trim() || null,
        recurring_id: initial?.recurring_id ?? null,
      });
      try {
        const saved = JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
        localStorage.setItem(LAST_KEY, JSON.stringify({ ...saved, [type]: category }));
      } catch {}
      if (!initial) {
        setAmountText("");
        setTitle("");
        setMemo("");
        amountRef.current?.focus();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-line/60 p-1">
        {(Object.keys(TYPE_LABEL) as TxType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            className={`rounded-lg py-2 text-sm font-semibold ${type === t ? "bg-card shadow-sm" : "text-ink-2"}`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="amount" className="text-sm text-ink-2">
          금액
        </label>
        <div className="mt-1 flex items-baseline gap-1 border-b-2 border-line focus-within:border-accent">
          <input
            id="amount"
            ref={amountRef}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmount(parseAmount(e.target.value))}
            className="tabular w-full bg-transparent py-2 text-4xl font-bold outline-none placeholder:text-line"
          />
          <span className="text-2xl font-semibold text-ink-2">원</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => setAmount(amount + q)}>
              +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
            </button>
          ))}
          <button type="button" className="chip text-muted" onClick={() => setAmount(0)}>
            지우기
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm text-ink-2">카테고리</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {cats.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-pressed={category === c.name}
              onClick={() => setCategory(c.name)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-line py-2 text-xs aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:font-semibold"
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="w-full truncate px-1 text-center">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input className="field" placeholder="내역 (선택)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field w-[9.5rem]" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      {more ? (
        <div className="space-y-2">
          <input className="field" placeholder="계좌 / 결제수단 (예: 신한카드, 국민 123-45)" value={account} onChange={(e) => setAccount(e.target.value)} />
          <textarea className="field" rows={2} placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="text-sm text-accent" onClick={() => setMore(true)}>
          + 계좌·메모 추가
        </button>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            className="btn btn-ghost text-danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm("이 내역을 삭제할까요?")) return;
              setBusy(true);
              await onDelete();
            }}
          >
            삭제
          </button>
        )}
        <button className="btn btn-primary flex-1 py-3.5 text-lg" disabled={busy}>
          {busy ? "저장 중…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
