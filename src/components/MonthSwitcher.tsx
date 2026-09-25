"use client";

import { addMonths, monthLabel } from "@/lib/format";
import { Icon } from "./AppShell";

export function MonthSwitcher({ month, onChange }: { month: string; onChange(m: string): void }) {
  return (
    <div className="flex items-center gap-1">
      <button className="rounded-full p-2 text-ink-2" aria-label="이전 달" onClick={() => onChange(addMonths(month, -1))}>
        <Icon d="M15 6l-6 6 6 6" size={20} />
      </button>
      <h1 className="min-w-[7.5rem] text-center text-lg font-bold">{monthLabel(month)}</h1>
      <button className="rounded-full p-2 text-ink-2" aria-label="다음 달" onClick={() => onChange(addMonths(month, 1))}>
        <Icon d="M9 6l6 6-6 6" size={20} />
      </button>
    </div>
  );
}

