"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Amount } from "@/components/TransactionList";
import { CATEGORIES, TYPE_LABEL } from "@/lib/categories";
import { monthLabel, won } from "@/lib/format";
import { dedupeKey, parseCsvFiles, readFiles, suggestCategory, type ImportRow, type ParseResult } from "@/lib/notionImport";
import type { NewTransaction, TxType } from "@/lib/types";

interface Override {
  type?: TxType;
  category?: string;
}

export default function ImportPage() {
  const { store, bump } = useApp();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [skipDup, setSkipDup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length || !store) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const csvs = await readFiles([...list]);
      if (!csvs.length) throw new Error("CSV 파일을 찾지 못했어요. 노션에서 'Markdown & CSV'로 내보냈는지 확인해 주세요.");
      const parsed = parseCsvFiles(csvs);
      setResult(parsed);
      setOverrides({});
      // 이미 들어있는 내역과 겹치는지 확인
      const dates = parsed.rows.map((r) => r.date).sort();
      if (dates.length) {
        const have = await store.listTransactions(dates[0], dates[dates.length - 1]);
        setExisting(new Set(have.map(dedupeKey)));
      }
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const groupKey = (r: ImportRow) => `${r.type}|${r.source}`;

  // 노션 유형별 묶음 (여기서 가계부 카테고리로 매핑)
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; type: TxType; source: string; count: number; amount: number; sample: ImportRow }>();
    for (const r of result?.rows ?? []) {
      const key = groupKey(r);
      const g = map.get(key) ?? { key, type: r.type, source: r.source, count: 0, amount: 0, sample: r };
      g.count += 1;
      g.amount += r.amount;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [result]);

  const final = useMemo(() => {
    const seen = new Set(existing);
    let dup = 0;
    const out: (NewTransaction & { guessedDate: boolean; file: string })[] = [];
    for (const r of result?.rows ?? []) {
      const o = overrides[groupKey(r)] ?? {};
      const type = o.type ?? r.type;
      const tx = {
        date: r.date,
        type,
        category: o.category?.trim() || suggestCategory(type, r.source, r.title),
        title: r.title,
        amount: r.amount,
        account: r.account,
        memo: r.memo,
        recurring_id: null,
        guessedDate: r.guessedDate,
        file: r.file,
      };
      const k = dedupeKey(tx);
      if (skipDup && seen.has(k)) {
        dup++;
        continue;
      }
      seen.add(k);
      out.push(tx);
    }
    return { rows: out.sort((a, b) => a.date.localeCompare(b.date)), dup };
  }, [result, overrides, existing, skipDup]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { count: number; expense: number }>();
    for (const r of final.rows) {
      const k = r.date.slice(0, 7);
      const e = m.get(k) ?? { count: 0, expense: 0 };
      e.count++;
      if (r.type === "expense") e.expense += r.amount;
      m.set(k, e);
    }
    return [...m.entries()].sort();
  }, [final]);

  async function doImport() {
    if (!store || !final.rows.length) return;
    setBusy(true);
    setError(null);
    try {
      await store.addTransactions(
        final.rows.map((r) => ({ date: r.date, type: r.type, category: r.category, title: r.title, amount: r.amount, account: r.account, memo: r.memo, recurring_id: null })),
      );
      bump();
      setDone(final.rows.length);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const guessed = final.rows.filter((r) => r.guessedDate).length;

  return (
    <div className="space-y-4">
      <header>
        <Link href="/settings/" className="text-sm text-ink-2">
          ← 설정
        </Link>
        <h1 className="mt-1 text-xl font-bold">노션 가계부 가져오기</h1>
      </header>

      <ol className="card list-decimal space-y-1 p-4 pl-8 text-sm text-ink-2">
        <li>노션 가계부 페이지 오른쪽 위 <b>⋯</b> → <b>내보내기</b></li>
        <li>
          형식 <b>Markdown &amp; CSV</b>, <b>하위 페이지 포함</b> 켜고 내보내기
        </li>
        <li>받은 <b>ZIP 파일을 그대로</b> 아래에 올리기 (CSV 여러 개도 가능)</li>
      </ol>

      <label className="card flex cursor-pointer flex-col items-center gap-1 border-dashed p-6 text-center">
        <span className="text-3xl">📥</span>
        <span className="font-semibold">{busy ? "읽는 중…" : "ZIP / CSV 파일 선택"}</span>
        <span className="text-xs text-muted">파일은 이 기기에서만 읽고, 가져오기를 누를 때만 저장돼요</span>
        <input type="file" accept=".zip,.csv,text/csv,application/zip" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={busy} />
      </label>

      {error && <p className="card p-3 text-sm text-danger">{error}</p>}
      {done != null && (
        <div className="card p-4 text-center">
          <p className="text-lg font-semibold">✅ {done.toLocaleString()}건을 가져왔어요</p>
          <Link href="/" className="btn btn-primary mt-3">
            홈에서 보기
          </Link>
        </div>
      )}

      {result && (
        <>
          <section className="card p-4 text-sm">
            <p>
              CSV <b>{result.files.length}</b>개에서 <b>{result.rows.length.toLocaleString()}</b>건을 찾았어요.
            </p>
            {result.skipped.length > 0 && (
              <details className="mt-1 text-xs text-muted">
                <summary>건너뛴 항목 {result.skipped.length}건</summary>
                <ul className="mt-1 list-disc pl-4">
                  {result.skipped.slice(0, 30).map((s, i) => (
                    <li key={i}>
                      {s.file}: {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="h-4 w-4" />
              같은 날짜·내역·금액 중복 제외 {final.dup > 0 && <span className="text-muted">({final.dup}건)</span>}
            </label>
          </section>

          <section className="card p-4">
            <h2 className="font-semibold">유형 매핑</h2>
            <p className="mb-3 text-xs text-muted">노션의 &apos;유형&apos;을 가계부 카테고리로 바꿔요. 카테고리를 비우면 내역 이름을 보고 자동으로 골라요.</p>
            <datalist id="all-categories">
              {Object.values(CATEGORIES)
                .flat()
                .map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
            </datalist>
            <ul className="space-y-3">
              {groups.map((g) => {
                const o = overrides[g.key] ?? {};
                const type = o.type ?? g.type;
                return (
                  <li key={g.key} className="rounded-xl border border-line p-3">
                    <p className="text-sm">
                      <b>{g.source}</b> <span className="text-xs text-muted">· {g.count}건 · {won(g.amount)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">예: {g.sample.title}</p>
                    <div className="mt-2 grid grid-cols-[6rem_1fr] gap-2">
                      <select
                        className="field py-2 text-sm"
                        value={type}
                        onChange={(e) => setOverrides((p) => ({ ...p, [g.key]: { ...o, type: e.target.value as TxType } }))}
                      >
                        {(Object.keys(TYPE_LABEL) as TxType[]).map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      <input
                        className="field py-2 text-sm"
                        list="all-categories"
                        placeholder={`자동 (${suggestCategory(type, g.source, g.sample.title)})`}
                        value={o.category ?? ""}
                        onChange={(e) => setOverrides((p) => ({ ...p, [g.key]: { ...o, category: e.target.value } }))}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">월별 미리보기</h2>
            <table className="tabular w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left font-normal">월</th>
                  <th className="py-1 text-right font-normal">건수</th>
                  <th className="py-1 text-right font-normal">지출</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map(([m, v]) => (
                  <tr key={m} className="border-t border-line/60">
                    <td className="py-1.5">{monthLabel(m)}</td>
                    <td className="py-1.5 text-right">{v.count}</td>
                    <td className="py-1.5 text-right">{won(v.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {guessed > 0 && <p className="mt-2 text-xs text-muted">※ 날짜가 비어있는 {guessed}건은 파일 이름의 달 1일로 넣었어요.</p>}
          </section>

          <section className="card px-4 py-2">
            <h2 className="pt-2 font-semibold">가져올 내역 ({final.rows.length.toLocaleString()}건)</h2>
            <ul className="divide-y divide-line/60 text-sm">
              {final.rows.slice(0, 40).map((r, i) => (
                <li key={i} className="flex items-center gap-2 py-2">
                  <span className="w-12 shrink-0 text-xs text-muted">{r.date.slice(5).replace("-", ".")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {TYPE_LABEL[r.type]} · {r.category}
                    </span>
                  </span>
                  <Amount tx={r} />
                </li>
              ))}
            </ul>
            {final.rows.length > 40 && <p className="py-2 text-center text-xs text-muted">외 {final.rows.length - 40}건</p>}
          </section>

          <button className="btn btn-primary sticky bottom-24 w-full py-3.5 text-lg shadow-lg" disabled={busy || !final.rows.length} onClick={doImport}>
            {busy ? "가져오는 중…" : `${final.rows.length.toLocaleString()}건 가져오기`}
          </button>
        </>
      )}
    </div>
  );
}
