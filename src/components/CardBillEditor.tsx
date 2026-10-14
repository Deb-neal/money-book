"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "./AppProvider";
import { useCardBills } from "@/lib/hooks";
import { won } from "@/lib/format";
import { CARD_ISSUERS, normalizeIssuer, validateBill, type BillAnalysis, type CardBill } from "@/lib/cardBills";
import { analyzeCardBill, prepareBillImage } from "@/lib/analyzeCardBill";

const moneyText = (n: number | null | undefined) => n == null ? "" : String(n);
function money(text: string): number | null {
  if (!text.trim()) return null;
  if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(text.trim())) return NaN;
  return Number(text.replace(/,/g, ""));
}

export function CardBillEditor({ month, initial, onClose, onSaved }: {
  month: string; initial: CardBill | null; onClose(): void; onSaved(month: string): void;
}) {
  const { store, bump } = useApp();
  const [draft, setDraft] = useState({
    issuer: initial?.issuer ?? "", billing_month: initial?.billing_month ?? month,
    total_amount: moneyText(initial?.total_amount), due_date: initial?.due_date ?? "", as_of_date: initial?.as_of_date ?? "",
    lump_sum: moneyText(initial?.lump_sum), installment: moneyText(initial?.installment), memo: initial?.memo ?? "",
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BillAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: bills, loading, error: loadError } = useCardBills(draft.billing_month);
  const existing = !loading && !loadError ? bills.find((b) => b.issuer === normalizeIssuer(draft.issuer)) : undefined;
  const older = existing?.as_of_date && draft.as_of_date && draft.as_of_date < existing.as_of_date;
  const busy = analyzing || saving;
  const update = (key: keyof typeof draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setPreview(null);
    setDraft((d) => ({ ...d, issuer: "", total_amount: "", due_date: "", as_of_date: "", lump_sum: "", installment: "" }));
    try {
      const image = await prepareBillImage(file);
      setPreview(image);
    } catch (e) { setError(e instanceof Error ? e.message : "이미지를 읽지 못했어요."); }
    finally { setAnalyzing(false); }
  }

  async function analyze() {
    if (!preview) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCardBill(preview, draft.billing_month);
      setAnalysis(result);
      setDraft((d) => ({
        ...d, issuer: initial?.issuer ?? result.issuer ?? "",
        billing_month: initial?.billing_month ?? result.due_date?.slice(0, 7) ?? d.billing_month,
        total_amount: moneyText(result.total_amount), due_date: result.due_date ?? "", as_of_date: result.as_of_date ?? "",
        lump_sum: moneyText(result.lump_sum), installment: moneyText(result.installment),
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "분석하지 못했어요."); }
    finally { setAnalyzing(false); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!store || busy) return;
    setSaving(true);
    setError(null);
    try {
      const row = validateBill({
        ...draft, total_amount: money(draft.total_amount) ?? NaN,
        due_date: draft.due_date || null, as_of_date: draft.as_of_date || null,
        lump_sum: money(draft.lump_sum), installment: money(draft.installment),
        memo: !initial && !draft.memo.trim() ? existing?.memo ?? null : draft.memo || null,
      });
      await store.saveCardBill(row);
      bump();
      onSaved(row.billing_month);
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setSaving(false); }
  }

  return (
    <section className="card space-y-4 p-4" aria-label="카드값 등록">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{initial ? "카드값 수정" : "카드값 등록"}</h2>
        <button type="button" className="text-sm text-ink-2" disabled={busy} onClick={onClose}>취소</button>
      </div>
      {!initial && <div className="space-y-3 rounded-xl border border-dashed border-line p-3">
        <label className="block text-sm font-medium" htmlFor="bill-image">카드 앱의 결제 예정금액 캡처</label>
        <input id="bill-image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || store?.kind === "demo"}
          className="block w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-bg file:px-3 file:py-2 file:text-ink"
          onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="text-xs leading-relaxed text-muted">{store?.kind === "demo" ? "데모에서는 직접 입력과 합계를 체험할 수 있어요. 캡처 분석은 로그인 후 사용할 수 있어요." : "JPG · PNG · WebP, 최대 10MB. ‘캡처 분석’ 버튼을 누르면 이미지가 AI 분석 서비스(OpenAI)로 전송돼요. 머니북에는 확인한 금액과 날짜만 저장해요."}</p>
        {preview && <>
          {/* 로컬 메모리에만 있는 캡처. 서버 저장소에는 업로드하지 않는다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="등록할 카드 청구 화면" className="mx-auto max-h-80 rounded-lg object-contain" />
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={analyze}>{analyzing ? "캡처 읽는 중…" : analysis ? "다시 분석" : "캡처 분석"}</button>
        </>}
      </div>}
      {analyzing && <p role="status" className="text-sm text-accent">이미지를 읽고 있어요. 잠시 기다려 주세요.</p>}
      {analysis && <div className="space-y-2 rounded-xl bg-bg p-3 text-sm">
        <p className="font-semibold">인식 결과를 원본과 비교해 주세요</p>
        {!analysis.issuer && <p>카드사를 확인해 주세요.</p>}
        {!analysis.due_date && <p>결제일을 읽지 못했어요. 결제 월과 날짜를 직접 확인해 주세요.</p>}
        {analysis.total_amount === null && <p>결제 예정금액을 직접 입력하거나 아래 청구 금액 후보를 선택해 주세요.</p>}
        {analysis.warnings.map((w, i) => <p key={i} className="text-ink-2">{w}</p>)}
        {analysis.candidates.length > 0 && <ul className="space-y-2 pt-1">
          {analysis.candidates.map((c, i) => <li key={i}>
            <button type="button" disabled={busy || c.kind !== "payable"} className="w-full rounded-lg border border-line p-2 text-left disabled:opacity-50"
              onClick={() => update("total_amount", String(c.amount))}>
              {c.label} · {won(c.amount)} <span className="text-xs text-muted">{c.kind === "payable" ? "선택" : "청구 총액 아님"}</span>
            </button>
          </li>)}
        </ul>}
      </div>}
      <form className="space-y-3" onSubmit={save}>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block text-sm">카드사
            <input aria-label="카드사" className="field mt-1" list="card-issuers" value={draft.issuer} maxLength={40} required disabled={!!initial}
              placeholder="예: 롯데카드" onChange={(e) => update("issuer", e.target.value)} />
          </label>
          <datalist id="card-issuers">{CARD_ISSUERS.map((issuer) => <option key={issuer} value={issuer} />)}</datalist>
          <label className="block text-sm">결제 월
            <input aria-label="결제 월" className="field mt-1" type="month" min="1900-01" max="2199-12" required disabled={!!initial} value={draft.billing_month} onChange={(e) => update("billing_month", e.target.value)} />
          </label>
          <label className="block text-sm">결제 예정금액 (원)
            <input aria-label="결제 예정금액" className="field tabular mt-1 text-lg font-semibold" inputMode="numeric" required placeholder="0" value={draft.total_amount} onChange={(e) => update("total_amount", e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm">실제 결제일
              <input aria-label="실제 결제일" type="date" className="field mt-1" value={draft.due_date} onChange={(e) => {
                const due = e.target.value;
                setDraft((d) => ({ ...d, due_date: due, billing_month: !initial && due ? due.slice(0, 7) : d.billing_month }));
              }} />
            </label>
            <label className="min-w-0 text-sm">금액 기준일
              <input aria-label="금액 기준일" type="date" className="field mt-1" value={draft.as_of_date} onChange={(e) => update("as_of_date", e.target.value)} />
            </label>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-ink-2">일시불 · 할부 (선택)</summary>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">일시불 (원)<input aria-label="일시불" className="field mt-1" inputMode="numeric" value={draft.lump_sum} onChange={(e) => update("lump_sum", e.target.value)} /></label>
              <label className="block text-sm">이번 청구 할부금 (원)<input aria-label="이번 청구 할부금" className="field mt-1" inputMode="numeric" value={draft.installment} onChange={(e) => update("installment", e.target.value)} /></label>
            </div>
          </details>
          <label className="block text-sm">메모 (선택)
            <textarea aria-label="메모" className="field mt-1" rows={3} maxLength={500} value={draft.memo}
              placeholder={!initial && existing?.memo ? "비워 두면 기존 메모를 유지해요" : "예: 여행 경비 포함, 결제 전 잔액 확인"}
              onChange={(e) => update("memo", e.target.value)} />
          </label>
        </fieldset>
        {existing && !initial && <p className="rounded-xl bg-bg p-3 text-sm">{draft.billing_month} {existing.issuer}에 저장된 <b>{won(existing.total_amount)}</b>을 새 금액으로 갱신해요. 합계에 중복으로 더하지 않아요.</p>}
        {older && <p className="text-sm text-danger">저장된 기준일({existing.as_of_date})보다 오래된 캡처예요. 최신 금액을 덮어쓰는지 확인해 주세요.</p>}
        {loadError && <p className="text-sm text-danger">기존 카드값을 확인하지 못했어요. 취소 후 다시 열어 주세요.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">카드사별 월 청구 총액을 저장해요. 개별 카드나 일부 금액만 나온 화면이면 카드사 전체 총액을 확인해 주세요.</p>
        <button className="btn btn-primary w-full" disabled={busy || loading || !!loadError} type="submit">{saving ? "저장 중…" : existing ? "확인하고 갱신" : "확인하고 저장"}</button>
      </form>
    </section>
  );
}
