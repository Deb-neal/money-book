export const CARD_ISSUERS = ["롯데카드", "삼성카드", "신한카드", "현대카드", "KB국민카드", "우리카드", "하나카드", "NH농협카드", "BC카드", "IBK기업은행"];

export interface CardBillInput {
  issuer: string;
  billing_month: string;
  total_amount: number;
  due_date: string | null;
  as_of_date: string | null;
  lump_sum: number | null;
  installment: number | null;
  memo: string | null;
}

export interface CardBill extends CardBillInput {
  id: string;
  updated_at: string;
}

export interface BillAnalysis {
  issuer: string | null;
  total_amount: number | null;
  due_date: string | null;
  as_of_date: string | null;
  lump_sum: number | null;
  installment: number | null;
  candidates: { label: string; amount: number; kind: "payable" | "usage" | "other" }[];
  warnings: string[];
}

export function normalizeIssuer(value: string): string {
  const key = value.trim().replace(/\s+/g, "").toUpperCase();
  const aliases: Record<string, string> = {
    LOCA: "롯데카드", 롯데: "롯데카드", 삼성: "삼성카드", 신한: "신한카드", 현대: "현대카드",
    국민: "KB국민카드", 국민카드: "KB국민카드", KB: "KB국민카드", KB국민: "KB국민카드",
    우리: "우리카드", 하나: "하나카드", 농협: "NH농협카드", 농협카드: "NH농협카드",
    NH농협: "NH농협카드", 비씨: "BC카드", 비씨카드: "BC카드", BC: "BC카드",
    기업은행: "IBK기업은행", IBK: "IBK기업은행",
  };
  return aliases[key] ?? key;
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isMonth(value.slice(0, 7))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999_999_999_999;
}

export function validateBill(input: CardBillInput): CardBillInput {
  const issuer = normalizeIssuer(input.issuer);
  if (!issuer || issuer.length > 40) throw new Error("카드사를 입력해 주세요 (40자 이내).");
  if (!isMonth(input.billing_month)) throw new Error("결제 월을 확인해 주세요.");
  if (!isMoney(input.total_amount)) throw new Error("결제 예정금액을 0 이상의 정수로 입력해 주세요.");
  for (const date of [input.due_date, input.as_of_date]) {
    if (date !== null && !isDate(date)) throw new Error("날짜를 확인해 주세요.");
  }
  if (input.due_date && !input.due_date.startsWith(input.billing_month)) throw new Error("결제일과 결제 월이 다릅니다. 결제일이 속한 달을 선택해 주세요.");
  for (const amount of [input.lump_sum, input.installment]) {
    if (amount !== null && !isMoney(amount)) throw new Error("일시불·할부 금액을 확인해 주세요.");
  }
  if (input.memo !== null && input.memo.length > 500) throw new Error("메모는 500자 이내로 입력해 주세요.");
  return { ...input, issuer, memo: input.memo?.trim() || null };
}

/** 모델 응답도 신뢰하지 않고 서버와 브라우저 양쪽에서 검사한다. */
export function parseAnalysis(value: unknown): BillAnalysis {
  if (!value || typeof value !== "object") throw new Error("분석 결과를 읽지 못했어요. 다시 시도해 주세요.");
  const v = value as Record<string, unknown>;
  const money = (key: string) => {
    if (v[key] === null) return null;
    if (!isMoney(v[key])) throw new Error("인식된 금액이 올바르지 않아요. 직접 입력해 주세요.");
    return v[key] as number;
  };
  const warnings = Array.isArray(v.warnings) ? v.warnings.filter((w): w is string => typeof w === "string").slice(0, 8).map((w) => w.slice(0, 300)) : [];
  const date = (key: string) => {
    if (v[key] === null) return null;
    if (isDate(v[key])) return v[key];
    warnings.push("일부 날짜를 읽지 못했어요. 원본과 비교해 주세요.");
    return null;
  };
  const candidates: BillAnalysis["candidates"] = [];
  if (Array.isArray(v.candidates)) {
    for (const c of v.candidates.slice(0, 8)) {
      if (c && typeof c.label === "string" && isMoney(c.amount) && ["payable", "usage", "other"].includes(c.kind)) {
        candidates.push({ label: c.label.slice(0, 100), amount: c.amount, kind: c.kind });
      }
    }
  }
  let total = money("total_amount");
  const payable = new Set(candidates.filter((c) => c.kind === "payable").map((c) => c.amount));
  // 서로 다른 청구액이 있거나 선택한 금액의 근거가 없으면 자동 선택하지 않는다.
  if (total !== null && (payable.size !== 1 || !payable.has(total))) {
    total = null;
    warnings.push("결제 예정금액을 하나로 확정하지 못했어요. 원본을 확인해 금액을 선택하거나 입력해 주세요.");
  }
  const result: BillAnalysis = {
    issuer: typeof v.issuer === "string" ? normalizeIssuer(v.issuer).slice(0, 40) || null : null,
    total_amount: total, due_date: date("due_date"), as_of_date: date("as_of_date"),
    lump_sum: money("lump_sum"), installment: money("installment"), candidates, warnings,
  };
  if (result.total_amount !== null && result.lump_sum !== null && result.installment !== null && result.lump_sum + result.installment !== result.total_amount) {
    warnings.push("일시불과 할부의 합계가 총액과 달라요. 수수료·할인 등 다른 항목이 있는지 확인해 주세요.");
  }
  return result;
}

const nullableMoney = { type: ["integer", "null"], minimum: 0, maximum: 999_999_999_999 };
const nullableText = { type: ["string", "null"] };
export const BILL_ANALYSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    issuer: nullableText, total_amount: nullableMoney, due_date: nullableText, as_of_date: nullableText,
    lump_sum: nullableMoney, installment: nullableMoney,
    candidates: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: { label: { type: "string" }, amount: { type: "integer", minimum: 0, maximum: 999_999_999_999 }, kind: { type: "string", enum: ["payable", "usage", "other"] } },
      required: ["label", "amount", "kind"],
    } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["issuer", "total_amount", "due_date", "as_of_date", "lump_sum", "installment", "candidates", "warnings"],
};
