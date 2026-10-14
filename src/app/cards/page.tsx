"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CardBillEditor } from "@/components/CardBillEditor";
import { CardBillMemo } from "@/components/CardBillMemo";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { useCardBills } from "@/lib/hooks";
import { useMonth } from "@/lib/useMonth";
import { dayLabel, won } from "@/lib/format";
import type { CardBill } from "@/lib/cardBills";

export default function CardsPage() {
  const { store, bump } = useApp();
  const [month, setMonth] = useMonth();
  const { data, loading, error } = useCardBills(month);
  const [editor, setEditor] = useState<{ initial: CardBill | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(bill: CardBill) {
    if (!store || !confirm(`${bill.issuer} ${bill.billing_month} 카드값을 삭제할까요?`)) return;
    setDeleting(bill.id);
    setActionError(null);
    setNotice(null);
    try { await store.deleteCardBill(bill.id); bump(); setNotice("카드값을 삭제했어요."); }
    catch { setActionError("삭제하지 못했어요. 다시 시도해 주세요."); }
    finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">카드값 모아보기</h1>
        <Link href="/" className="text-sm text-accent">홈으로</Link>
      </header>
      <p className="text-sm text-ink-2">이번 달 낼 카드값을 카드사별로 모아 보세요.</p>
      {!editor && <MonthSwitcher month={month} onChange={(m) => { setMonth(m); setNotice(null); }} />}
      {notice && <p role="status" className="text-sm text-plus">{notice}</p>}
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
      {editor ? <CardBillEditor month={month} initial={editor.initial} onClose={() => setEditor(null)} onSaved={(m) => {
        setMonth(m); setEditor(null); setNotice("카드값을 저장했어요.");
      }} /> : <>
        <section className="card p-5">
          <p className="text-sm text-ink-2">{Number(month.slice(5))}월 결제 예정 합계</p>
          <p className="tabular mt-2 text-3xl font-bold">{loading ? "불러오는 중…" : error ? "—" : data.length ? won(data.reduce((sum, b) => sum + b.total_amount, 0)) : "아직 등록 전"}</p>
          <p className="mt-2 text-xs text-muted">{!loading && !error ? `등록한 ${data.length}개 카드사 기준 · ` : ""}가계부 지출과 별도로 관리해요.</p>
        </section>
        <button className="btn btn-primary w-full" onClick={() => { setNotice(null); setActionError(null); setEditor({ initial: null }); }}>+ 캡처로 가져오기 / 직접 입력</button>
        {error && <div role="alert" className="card space-y-2 p-4 text-sm">
          <p className="text-danger">카드값을 불러오지 못했어요: {error}</p>
          <button className="text-accent" onClick={bump}>다시 불러오기</button>
        </div>}
        {!loading && !error && !data.length && <p className="py-8 text-center text-sm text-muted">결제 예정금액 화면을 등록하면<br />카드사별 금액과 결제일을 여기에 모아 드려요.</p>}
        {!loading && !error && data.map((bill) => <article key={bill.id} className="card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold">{bill.issuer}</h2><p className="mt-1 text-sm text-ink-2">{bill.due_date ? `${dayLabel(bill.due_date)} 결제` : "결제일 미입력"}</p></div>
            <p className="tabular text-xl font-bold">{won(bill.total_amount)}</p>
          </div>
          {(bill.lump_sum !== null || bill.installment !== null) && <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            {bill.lump_sum !== null && <span>일시불 {won(bill.lump_sum)}</span>}
            {bill.installment !== null && <span>할부 {won(bill.installment)}</span>}
          </div>}
          <CardBillMemo bill={bill} onSaved={() => setNotice(`${bill.issuer} 메모를 저장했어요.`)} />
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-muted">{bill.as_of_date ? `${bill.as_of_date} 기준` : "금액 기준일 미입력"}</span>
            <div className="flex gap-3 text-sm">
              <button className="text-accent" disabled={!!deleting} onClick={() => { setNotice(null); setEditor({ initial: bill }); }}>수정</button>
              <button className="text-muted" disabled={!!deleting} onClick={() => remove(bill)}>{deleting === bill.id ? "삭제 중…" : "삭제"}</button>
            </div>
          </div>
        </article>)}
      </>}
    </div>
  );
}
