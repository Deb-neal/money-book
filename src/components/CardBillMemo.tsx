"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "./AppProvider";
import type { CardBill } from "@/lib/cardBills";

export function CardBillMemo({ bill, onSaved }: { bill: CardBill; onSaved(): void }) {
  const { store, bump } = useApp();
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(bill.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!store || saving) return;
    setSaving(true);
    setError(null);
    try {
      await store.updateCardBillMemo(bill.id, memo);
      setEditing(false);
      bump();
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "메모를 저장하지 못했어요."); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className="rounded-xl bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">메모</span>
        <button type="button" className="text-sm text-accent" aria-label={`${bill.issuer} 메모 ${bill.memo ? "수정" : "추가"}`}
          onClick={() => { setMemo(bill.memo ?? ""); setError(null); setEditing(true); }}>
          {bill.memo ? "수정" : "+ 추가"}
        </button>
      </div>
      {bill.memo ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-2">{bill.memo}</p>
        : <p className="mt-1 text-xs text-muted">큰 지출이나 결제 전에 확인할 내용을 적어 두세요.</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-2 rounded-xl bg-bg p-3">
      <label className="block text-sm font-medium" htmlFor={`memo-${bill.id}`}>{bill.issuer} 메모</label>
      <textarea id={`memo-${bill.id}`} autoFocus className="field min-h-28 resize-y" rows={3} maxLength={500}
        placeholder="예: 이번 달 여행 경비 포함, 25일에 결제계좌 잔액 확인" value={memo} disabled={saving}
        onChange={(e) => setMemo(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{memo.length}/500</span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost px-3 py-2 text-sm" disabled={saving} onClick={() => setEditing(false)}>취소</button>
          <button type="submit" className="btn btn-primary px-3 py-2 text-sm" disabled={saving}>{saving ? "저장 중…" : "메모 저장"}</button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
