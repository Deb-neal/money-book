"use client";

import { useMemo, useState } from "react";
import { EditSheet } from "@/components/EditSheet";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { TransactionList } from "@/components/TransactionList";
import { totals } from "@/lib/aggregate";
import { TYPE_LABEL } from "@/lib/categories";
import { monthRange, won } from "@/lib/format";
import { useTransactions } from "@/lib/hooks";
import type { Transaction, TxType } from "@/lib/types";
import { useMonth } from "@/lib/useMonth";

export default function HistoryPage() {
  const [month, setMonth] = useMonth();
  const [from, to] = monthRange(month);
  const { data: txs, loading, error } = useTransactions(from, to);
  const [type, setType] = useState<TxType | "all">("all");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const categories = useMemo(
    () => [...new Set(txs.filter((t) => type === "all" || t.type === type).map((t) => t.category))],
    [txs, type],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs.filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!category || t.category === category) &&
        (!q || `${t.title} ${t.memo ?? ""} ${t.account ?? ""}`.toLowerCase().includes(q)),
    );
  }, [txs, type, category, query]);

  const sum = totals(filtered);

  return (
    <div className="space-y-4">
      <MonthSwitcher month={month} onChange={setMonth} />

      <input className="field" type="search" placeholder="내역·메모·계좌 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(["all", "expense", "income", "saving"] as const).map((t) => (
          <button
            key={t}
            className="chip"
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setCategory(null);
            }}
          >
            {t === "all" ? "전체" : TYPE_LABEL[t]}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {categories.map((c) => (
          <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="card grid grid-cols-3 gap-2 p-3 text-sm">
        <div>
          <p className="text-xs text-muted">지출</p>
          <p className="tabular font-semibold">{won(sum.expense)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">수입</p>
          <p className="tabular font-semibold text-plus">{won(sum.income)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">저축</p>
          <p className="tabular font-semibold">{won(sum.saving)}</p>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {loading && !txs.length ? <p className="py-10 text-center text-sm text-muted">불러오는 중…</p> : <TransactionList txs={filtered} onSelect={setEditing} />}

      <EditSheet tx={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
