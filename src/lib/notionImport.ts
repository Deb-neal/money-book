import Papa from "papaparse";
import { unzipSync, strFromU8 } from "fflate";
import type { NewTransaction, TxType } from "./types";
import { parseAmount } from "./format";

/**
 * 노션 데이터베이스 내보내기(CSV 또는 ZIP)를 가계부 거래로 바꾼다.
 * 노션: 페이지 ⋯ → 내보내기 → "Markdown & CSV" (하위 페이지 포함) → 받은 ZIP을 그대로 올리면 된다.
 */

export interface ImportRow extends NewTransaction {
  /** 노션의 원래 유형(카테고리) 값 */
  source: string;
  file: string;
  /** 날짜 칸이 비어 파일 이름에서 추정한 경우 */
  guessedDate: boolean;
}

export interface ParseResult {
  rows: ImportRow[];
  files: string[];
  skipped: { file: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// 파일 읽기

/** UTF-8 플래그 없이 압축된 ZIP은 한글 파일명이 latin1로 읽히므로 UTF-8로 다시 해석 */
function fixZipName(name: string): string {
  if (!/[\x80-\xff]/.test(name) || /[^\x00-\xff]/.test(name)) return name;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(name, (c) => c.charCodeAt(0)));
  } catch {
    return name;
  }
}

async function collectCsv(name: string, bytes: Uint8Array, out: { name: string; text: string }[]) {
  if (/\.zip$/i.test(name)) {
    const entries = unzipSync(bytes);
    for (const [rawPath, data] of Object.entries(entries)) {
      const path = fixZipName(rawPath);
      if (path.startsWith("__MACOSX/")) continue;
      await collectCsv(path, data, out); // 노션 ZIP 안에 ZIP이 또 들어있는 경우가 있다
    }
  } else if (/\.csv$/i.test(name)) {
    out.push({ name, text: strFromU8(bytes).replace(/^﻿/, "") });
  }
}

export async function readFiles(files: File[]): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  for (const f of files) await collectCsv(f.name, new Uint8Array(await f.arrayBuffer()), out);
  // 노션은 같은 DB를 "_all.csv"로 한 번 더 넣어주기도 한다 → 전체본이 있으면 그것만 사용
  const alls = new Set(out.filter((f) => /_all\.csv$/i.test(f.name)).map((f) => f.name.replace(/_all\.csv$/i, ".csv")));
  return out.filter((f) => !alls.has(f.name));
}

// ---------------------------------------------------------------------------
// 열 이름 찾기

const COLUMN_ALIASES = {
  title: ["내역", "이름", "항목", "제목", "name", "title"],
  amount: ["금액", "가격", "amount", "price", "cost"],
  category: ["유형", "카테고리", "분류", "category", "type", "tags"],
  date: ["날짜", "일자", "date"],
  account: ["계좌번호", "계좌", "결제수단", "account", "payment"],
  memo: ["기타", "메모", "비고", "memo", "note", "notes"],
} as const;

type Field = keyof typeof COLUMN_ALIASES;

export function detectColumns(headers: string[]): Partial<Record<Field, string>> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const found: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(COLUMN_ALIASES) as Field[]) {
    const aliases = COLUMN_ALIASES[field];
    const h =
      headers.find((x) => (aliases as readonly string[]).includes(norm(x))) ??
      headers.find((x) => aliases.some((a) => norm(x).includes(a)));
    if (h && !Object.values(found).includes(h)) found[field] = h;
  }
  // 노션 DB의 첫 열은 항상 제목 속성
  if (!found.title && headers[0] && !Object.values(found).includes(headers[0])) found.title = headers[0];
  return found;
}

// ---------------------------------------------------------------------------
// 값 해석

const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(text: string): string | null {
  const s = text.trim().split("→")[0]; // 기간이면 시작일
  let m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mi = EN_MONTHS.findIndex((name) => name.startsWith(m![1].toLowerCase().slice(0, 3)));
    if (mi >= 0) return `${m[3]}-${pad(mi + 1)}-${pad(+m[2])}`;
  }
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // MM/DD/YYYY
  if (m) return `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`;
  return null;
}

/** 파일/폴더 이름의 "26년 02월" 같은 표기로 달을 추정 */
export function monthFromName(name: string): string | null {
  const m = name.match(/(\d{2}|\d{4})\s*년\s*(\d{1,2})\s*월/);
  if (!m) return null;
  const y = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
  return `${y}-${pad(+m[2])}`;
}

const INCOME_WORDS = ["월급", "급여", "수입", "상여", "보너스", "부수입", "용돈", "환급", "income", "salary"];
const SAVING_WORDS = ["적금", "저축", "청약", "투자", "펀드", "주식", "연금", "saving"];

export function guessType(title: string, category: string): TxType {
  const text = `${title} ${category}`.toLowerCase();
  if (SAVING_WORDS.some((w) => text.includes(w))) return "saving";
  if (INCOME_WORDS.some((w) => text.includes(w))) return "income";
  return "expense";
}

/** 노션 셀 안의 링크 표기 "이름 (https://...)" 제거 */
const clean = (s: string | undefined) => (s ?? "").replace(/\s*\(https?:\/\/[^)]*\)/g, "").trim();

// ---------------------------------------------------------------------------

export function parseCsvFiles(files: { name: string; text: string }[]): ParseResult {
  const rows: ImportRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (const file of files) {
    const parsed = Papa.parse<Record<string, string>>(file.text, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];
    const col = detectColumns(headers);
    const short = file.name.split("/").pop()!;
    if (!col.amount) {
      skipped.push({ file: short, reason: "금액 열을 찾지 못함" });
      continue;
    }
    const fallbackMonth = monthFromName(file.name);

    for (const r of parsed.data) {
      const amount = Math.abs(parseAmount(r[col.amount] ?? ""));
      if (!amount) continue;
      let date = col.date ? parseDate(r[col.date] ?? "") : null;
      const guessedDate = !date;
      if (!date && fallbackMonth) date = `${fallbackMonth}-01`;
      if (!date) {
        skipped.push({ file: short, reason: `날짜 없음: ${clean(r[col.title!]) || "(이름 없음)"}` });
        continue;
      }
      const title = clean(r[col.title!]);
      const source = clean(col.category ? r[col.category] : "").split(",")[0].trim() || "기타";
      rows.push({
        date,
        title: title || source,
        amount,
        type: guessType(title, source),
        category: source,
        account: clean(col.account ? r[col.account] : "") || null,
        memo: clean(col.memo ? r[col.memo] : "") || null,
        recurring_id: null,
        source,
        file: short,
        guessedDate,
      });
    }
  }
  return { rows, files: files.map((f) => f.name.split("/").pop()!), skipped };
}

export const dedupeKey = (t: Pick<NewTransaction, "date" | "title" | "amount" | "type">) => `${t.date}|${t.type}|${t.title}|${t.amount}`;

// ---------------------------------------------------------------------------
// 노션 유형 → 가계부 카테고리 추천

const EXPENSE_ALIASES: [RegExp, string][] = [
  [/식비|식사|음식|배달|외식/, "식비"],
  [/카페|커피|간식/, "카페/간식"],
  [/주거|통신|월세|관리비|공과금|핸드폰|인터넷/, "주거/통신"],
  [/교통|택시|주유|차량/, "교통"],
  [/생활|마트|장보기/, "생활/마트"],
  [/쇼핑|의류|옷/, "쇼핑"],
  [/의료|병원|약|건강/, "의료/건강"],
  [/문화|여가|취미|여행|구독/, "문화/여가"],
  [/경조사|선물|축의|부의/, "경조사/선물"],
  [/이자|대출|금융|수수료|보험/, "이자/금융"],
];

export function suggestCategory(type: TxType, source: string, title: string): string {
  const text = `${source} ${title}`;
  if (type === "saving") {
    if (/적금/.test(text)) return "적금";
    if (/청약/.test(text)) return "청약";
    if (/투자|주식|펀드|코인|ETF/i.test(text)) return "투자";
    return "기타저축";
  }
  if (type === "income") {
    if (/월급|급여/.test(text)) return "월급";
    if (/이자/.test(text)) return "이자수입";
    if (/부수입|알바|외주/.test(text)) return "부수입";
    return source === "기타" ? "기타수입" : source;
  }
  if (source === "기타") return "기타";
  return EXPENSE_ALIASES.find(([re]) => re.test(source))?.[1] ?? EXPENSE_ALIASES.find(([re]) => re.test(title))?.[1] ?? source;
}
