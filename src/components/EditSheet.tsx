"use client";

import { useEffect } from "react";
import { useApp } from "./AppProvider";
import { TransactionForm } from "./TransactionForm";
import type { Transaction } from "@/lib/types";

/** 아래에서 올라오는 수정 시트 */
export function EditSheet({ tx, onClose }: { tx: Transaction | null; onClose(): void }) {
  const { store, bump } = useApp();

  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tx, onClose]);

  if (!tx || !store) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="내역 수정"
        className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">내역 수정</h2>
          <button className="text-sm text-ink-2" onClick={onClose}>
            닫기
          </button>
        </div>
        <TransactionForm
          key={tx.id}
          initial={tx}
          onSubmit={async (patch) => {
            await store.updateTransaction(tx.id, patch);
            bump();
            onClose();
          }}
          onDelete={async () => {
            await store.deleteTransaction(tx.id);
            bump();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
