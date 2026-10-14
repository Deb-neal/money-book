"use client";

import Link from "next/link";
import { useCardBills } from "@/lib/hooks";
import { won } from "@/lib/format";

export function CardBillSummary({ month }: { month: string }) {
  const { data, loading, error } = useCardBills(month);
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{Number(month.slice(5))}월 카드값</h2>
        <Link href="/cards/" className="text-sm text-accent">캡처 등록 · 관리 →</Link>
      </div>
      {loading ? <p className="mt-3 text-sm text-muted">불러오는 중…</p>
        : error ? <p className="mt-3 text-sm text-danger">카드값을 불러오지 못했어요. 관리 화면에서 다시 확인해 주세요.</p>
          : data.length ? <>
            <p className="tabular mt-2 text-2xl font-bold">{won(data.reduce((sum, b) => sum + b.total_amount, 0))}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {data.map((b) => <li key={b.id} className="flex justify-between gap-3">
                <span>{b.issuer} <span className="text-xs text-muted">{b.due_date ? `${Number(b.due_date.slice(8))}일 결제` : "결제일 미입력"}</span></span>
                <span className="tabular font-medium">{won(b.total_amount)}</span>
              </li>)}
            </ul>
            <p className="mt-3 text-xs text-muted">등록한 {data.length}개 카드사 기준 · 지출 합계와 별도로 표시해요.</p>
          </> : <p className="mt-3 text-sm text-muted">카드 앱의 청구 화면을 올려 이번 달 낼 카드값을 모아 보세요.</p>}
    </section>
  );
}
