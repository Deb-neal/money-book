"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactions } from "@/lib/hooks";
import { emojiFor } from "@/lib/categories";
import { addMonths, currentMonth, monthRange, won } from "@/lib/format";

export default function AddPage() {
  const { store, bump } = useApp();
  const [toast, setToast] = useState<string | null>(null);
  // 최근 몇 달 동안 쓴 카테고리도 선택지에 보여준다
  const [from] = monthRange(addMonths(currentMonth(), -3));
  const [, to] = monthRange(currentMonth());
  const { data: recent } = useTransactions(from, to);
  const used = useMemo(() => recent.map(({ type, category }) => ({ type, category })), [recent]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">빠른 입력</h1>
      <TransactionForm
        usedCategories={used}
        onSubmit={async (tx) => {
          await store!.addTransactions([tx]);
          bump();
          setToast(`${emojiFor(tx.type, tx.category)} ${tx.title} ${won(tx.amount)} 저장됨`);
          setTimeout(() => setToast(null), 2200);
        }}
      />
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
