"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Amount } from "@/components/TransactionList";
import { categoriesFor, emojiFor, TYPE_LABEL } from "@/lib/categories";
import { parseAmount, won } from "@/lib/format";
import { useRecurring } from "@/lib/hooks";
import type { NewRecurring, TxType } from "@/lib/types";

const EMPTY: NewRecurring = { title: "", type: "expense", category: "주거/통신", amount: 0, day_of_month: 1, account: null, memo: null, active: true };

export default function RecurringPage() {
  const { data: items, loading, error } = useRecurring();
  const [editing, setEditing] = useState<(NewRecurring & { id?: string }) | null>(null);

  const active = items.filter((r) => r.active);
  const sum = (t: TxType) => active.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">고정 항목</h1>
        <button className="btn btn-primary px-3 py-2 text-sm" onClick={() => setEditing({ ...EMPTY })}>
          + 추가
        </button>
      </header>
      <p className="text-sm text-ink-2">월세, 적금, 통신비처럼 매달 나가는 돈이에요. 홈 화면에서 한 번에 이번 달 내역으로 반영할 수 있어요.</p>

      <div className="card grid grid-cols-3 gap-2 p-3 text-sm">
        {(["expense", "saving", "income"] as const).map((t) => (
          <div key={t}>
            <p className="text-xs text-muted">월 고정 {TYPE_LABEL[t]}</p>
            <p className={`tabular font-semibold ${t === "income" ? "text-plus" : ""}`}>{won(sum(t))}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
      ) : !items.length ? (
        <p className="py-10 text-center text-sm text-muted">아직 고정 항목이 없어요</p>
      ) : (
        <ul className="card divide-y divide-line/60 px-4">
          {items.map((r) => (
            <li key={r.id}>
              <button className={`flex w-full items-center gap-3 py-3 text-left ${r.active ? "" : "opacity-45"}`} onClick={() => setEditing(r)}>
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full bg-line/60 leading-none">
                  <span className="text-[10px] text-muted">매달</span>
                  <span className="text-sm font-bold">{r.day_of_month}일</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {emojiFor(r.type, r.category)} {r.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {r.category}
                    {r.account ? ` · ${r.account}` : ""}
                    {!r.active && " · 중지됨"}
                  </span>
                </span>
                <Amount tx={r} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <RecurringSheet value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurringSheet({ value, onClose }: { value: NewRecurring & { id?: string }; onClose(): void }) {
  const { store, bump } = useApp();
  const [v, setV] = useState(value);
  const [amountText, setAmountText] = useState(value.amount ? value.amount.toLocaleString("ko-KR") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NewRecurring>(k: K, val: NewRecurring[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(amountText);
    if (!v.title.trim() || amount <= 0) {
      setError("이름과 금액을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await store!.saveRecurring({ ...v, title: v.title.trim(), amount, account: v.account?.trim() || null, memo: v.memo?.trim() || null });
      bump();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!v.id || !confirm("이 고정 항목을 삭제할까요? 이미 기록된 내역은 남아요.")) return;
    setBusy(true);
    await store!.deleteRecurring(v.id);
    bump();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-bg p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{v.id ? "고정 항목 수정" : "고정 항목 추가"}</h2>
          <button type="button" className="text-sm text-ink-2" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-line/60 p-1">
          {(Object.keys(TYPE_LABEL) as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setV((p) => ({ ...p, type: t, category: categoriesFor(t)[0].name }))}
              className={`rounded-lg py-2 text-sm font-semibold ${v.type === t ? "bg-card shadow-sm" : "text-ink-2"}`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <label className="block text-sm text-ink-2">
          이름
          <input className="field mt-1" placeholder="예: 월세, 국민은행 적금" value={v.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <label className="block text-sm text-ink-2">
            금액
            <input
              className="field tabular mt-1"
              inputMode="numeric"
              placeholder="0"
              value={amountText}
              onChange={(e) => {
                const n = parseAmount(e.target.value);
                setAmountText(n ? n.toLocaleString("ko-KR") : "");
              }}
            />
          </label>
          <label className="block text-sm text-ink-2">
            매달
            <select className="field mt-1" value={v.day_of_month} onChange={(e) => set("day_of_month", Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d === 31 ? "말일" : `${d}일`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm text-ink-2">
          카테고리
          <select className="field mt-1" value={v.category} onChange={(e) => set("category", e.target.value)}>
            {categoriesFor(v.type, [v.category]).map((c) => (
              <option key={c.name} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink-2">
          관련 계좌
          <input className="field mt-1" placeholder="예: OO은행 000-000-000000 (예금주)" value={v.account ?? ""} onChange={(e) => set("account", e.target.value)} />
        </label>
        <label className="block text-sm text-ink-2">
          메모
          <input className="field mt-1" placeholder="예: 관리비는 매달 금액 확인" value={v.memo ?? ""} onChange={(e) => set("memo", e.target.value)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-3 text-sm">
          사용 중
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={v.active} onChange={(e) => set("active", e.target.checked)} />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          {v.id && (
            <button type="button" className="btn btn-ghost text-danger" disabled={busy} onClick={remove}>
              삭제
            </button>
          )}
          <button className="btn btn-primary flex-1 py-3" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
