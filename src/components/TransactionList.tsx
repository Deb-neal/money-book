"use client";

import { emojiFor } from "@/lib/categories";
import { groupByDate } from "@/lib/aggregate";
import { dayLabel, won } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function Amount({ tx }: { tx: Pick<Transaction, "type" | "amount"> }) {
  if (tx.type === "income") return <span className="tabular font-semibold text-plus">+{won(tx.amount)}</span>;
  if (tx.type === "saving") return <span className="tabular font-semibold text-ink-2">{won(tx.amount)}</span>;
  return <span className="tabular font-semibold">-{won(tx.amount)}</span>;
}

export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick?(): void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line/60 text-lg">{emojiFor(tx.type, tx.category)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.title}</span>
        <span className="block truncate text-xs text-muted">
          {tx.category}
          {tx.type === "saving" && " · 저축"}
          {tx.recurring_id && " · 고정"}
          {tx.account && ` · ${tx.account}`}
        </span>
      </span>
      <Amount tx={tx} />
    </button>
  );
}

export function TransactionList({ txs, onSelect }: { txs: Transaction[]; onSelect?(tx: Transaction): void }) {
  if (!txs.length) return <p className="py-10 text-center text-sm text-muted">내역이 없어요</p>;
  return (
    <div className="space-y-4">
      {groupByDate(txs).map(([date, items]) => {
        const spent = items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return (
          <section key={date}>
            <div className="flex items-baseline justify-between border-b border-line pb-1 text-xs text-muted">
              <span>{dayLabel(date)}</span>
              {spent > 0 && <span className="tabular">-{won(spent)}</span>}
            </div>
            <div className="divide-y divide-line/60">
              {items.map((t) => (
                <TransactionRow key={t.id} tx={t} onClick={() => onSelect?.(t)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
