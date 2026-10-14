import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIssuer, parseAnalysis, validateBill, isDate } from "../supabase/functions/_shared/card-bill.ts";
import { createHandler } from "../supabase/functions/analyze-card-bill/handler.ts";
import { demoStore } from "../src/lib/store.ts";

const bill = { issuer: "롯데카드", billing_month: "2026-10", total_amount: 3376089, due_date: "2026-10-26", as_of_date: "2026-10-14", lump_sum: 2670489, installment: 705600, memo: null };
const extracted = { issuer: "LOCA", total_amount: 3376089, due_date: "2026-10-26", as_of_date: "2026-10-14", lump_sum: 2670489, installment: 705600, candidates: [{ label: "총 결제금액", amount: 3376089, kind: "payable" }], warnings: [] };

test("기준일과 결제일을 유지하고 카드사를 정규화한다", () => {
  const result = parseAnalysis(extracted);
  assert.equal(result.issuer, "롯데카드");
  assert.equal(result.due_date, "2026-10-26");
  assert.equal(result.as_of_date, "2026-10-14");
  assert.equal(result.total_amount, 3376089);
  assert.deepEqual(result.warnings, []);
  assert.equal(normalizeIssuer(" KB 국민 카드 "), "KB국민카드");
  assert.equal(normalizeIssuer("국민카드"), "KB국민카드");
});

test("중복된 총액 표기는 허용하고 서로 다른 청구액은 선택을 요구한다", () => {
  assert.equal(parseAnalysis({ ...extracted, candidates: [...extracted.candidates, ...extracted.candidates] }).total_amount, 3376089);
  const ambiguous = parseAnalysis({ ...extracted, candidates: [...extracted.candidates, { label: "결제할 금액", amount: 3500000, kind: "payable" }] });
  assert.equal(ambiguous.total_amount, null);
  assert.ok(ambiguous.warnings.length);
});

test("사용액만 나온 화면을 청구 총액으로 저장하도록 자동 선택하지 않는다", () => {
  assert.equal(parseAnalysis({ ...extracted, candidates: [{ label: "이번 달 이용금액", amount: 3376089, kind: "usage" }] }).total_amount, null);
  assert.equal(parseAnalysis({ ...extracted, total_amount: null, candidates: [] }).total_amount, null);
  assert.equal(parseAnalysis({ ...extracted, total_amount: 0, candidates: [{ label: "결제금액", amount: 0, kind: "payable" }], lump_sum: 0, installment: 0 }).total_amount, 0);
});

test("깨진 날짜/잘못된 금액/결제 월 불일치를 걸러낸다", () => {
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2024-02-29"), true);
  assert.equal(parseAnalysis({ ...extracted, due_date: "2026-02-30" }).due_date, null);
  assert.throws(() => validateBill({ ...bill, billing_month: "2026-11" }));
  assert.throws(() => validateBill({ ...bill, total_amount: -1 }));
  assert.throws(() => validateBill({ ...bill, total_amount: NaN }));
  assert.throws(() => validateBill({ ...bill, total_amount: 1.5 }));
  assert.throws(() => validateBill({ ...bill, issuer: " " }));
  assert.throws(() => parseAnalysis({ ...extracted, total_amount: "3,376,089" }));
});

test("일시불+할부 불일치는 수수료/할인 확인을 안내한다", () => {
  assert.ok(parseAnalysis({ ...extracted, installment: 1 }).warnings.some((w) => w.includes("합계")));
});

test("데모는 같은 카드사·월을 갱신하고 다른 달/카드사와 개별 지출은 유지한다", async () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  // 기존 이용자의 저장 형식에는 cardBills 키가 없다.
  memory.set("money-book:demo", JSON.stringify({ transactions: [{ id: "tx", date: "2026-10-01", amount: 1000 }], recurring: [], notes: [{ id: "note", title: "보존" }] }));
  const store = demoStore();
  assert.deepEqual(await store.listCardBills("2026-10"), []);
  await store.saveCardBill(bill);
  const id = (await store.listCardBills("2026-10"))[0].id;
  await store.saveCardBill({ ...bill, issuer: "LOCA", total_amount: 4000000 });
  await store.saveCardBill({ ...bill, issuer: "삼성", total_amount: 500000 });
  await store.saveCardBill({ ...bill, billing_month: "2026-11", due_date: "2026-11-26" });
  const rows = await demoStore().listCardBills("2026-10");
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, b) => sum + b.total_amount, 0), 4500000);
  assert.equal(rows.find((b) => b.issuer === "롯데카드")?.id, id);
  assert.equal((await store.listTransactions("2026-10-01", "2026-10-31"))[0].amount, 1000);
  assert.equal((await store.listNotes())[0].title, "보존");
  await store.deleteCardBill(id);
  assert.equal((await store.listCardBills("2026-10")).length, 1);
  assert.equal((await store.listCardBills("2026-11")).length, 1);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  await assert.rejects(store.saveCardBill(bill), /QuotaExceededError/);
});

const config = { supabaseUrl: "https://project.example", supabaseKey: "public-test-key", openaiKey: "server-test-key" };
// Only the signature is needed for the mocked transport test; no actual image or API request.
const body = { image: "data:image/jpeg;base64,/9j/AA==", month: "2026-10" };
const request = (data: unknown = body, auth = true) => new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer user-token" } : {}) }, body: JSON.stringify(data) });
const completed = (value = extracted) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });

test("서버는 인증 후 이미지 분석을 호출하고 비저장/스키마 옵션을 사용한다", async () => {
  const calls: string[] = [];
  const handler = createHandler(config, async (url, options) => {
    calls.push(String(url));
    if (calls.length === 1) return Response.json({ id: "user-1" });
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer server-test-key");
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.input[0].content[1].image_url, body.image);
    return completed();
  });
  const result = await handler(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).due_date, "2026-10-26");
  assert.equal(calls.length, 2);
});

test("로그인 없이/익명 계정/만료 토큰으로 유료 분석을 호출하지 못한다", async () => {
  let calls = 0;
  const handler = createHandler(config, async () => { calls++; return Response.json({}, { status: 401 }); });
  assert.equal((await handler(request(body, false))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handler(request())).status, 401);
  assert.equal(calls, 1);
  const anonymous = createHandler(config, async () => Response.json({ id: "anon", is_anonymous: true }));
  assert.equal((await anonymous(request())).status, 403);
});

test("API 미설정/잘못된 이미지/과대 업로드는 분석 전에 실패한다", async () => {
  const authOnly: typeof fetch = async () => Response.json({ id: "user-1" });
  assert.equal((await createHandler({ ...config, openaiKey: undefined }, authOnly)(request())).status, 503);
  const handler = createHandler(config, authOnly);
  assert.equal((await handler(request({ ...body, image: "https://external.example/image.jpg" }))).status, 400);
  assert.equal((await handler(request({ ...body, image: "data:image/jpeg;base64,YWJj" }))).status, 400);
  assert.equal((await handler(request({ ...body, month: "2026-99" }))).status, 400);
  assert.equal((await handler(request({ ...body, image: "x".repeat(3_000_001) }))).status, 400);
  assert.equal((await handler(new Request("https://example.test", { method: "OPTIONS" }))).status, 204);
});

test("모델 거절/미완료/잘못된 구조와 시간초과는 저장 가능한 결과로 반환하지 않는다", async () => {
  for (const output of [{ status: "incomplete" }, { status: "completed", output: [{ content: [{ type: "refusal", refusal: "no" }] }] }, { status: "completed", output: [{ content: [{ type: "output_text", text: "{}" }] }] }]) {
    const handler = createHandler(config, async (url) => String(url).includes("/auth/") ? Response.json({ id: "u" }) : Response.json(output));
    assert.equal((await handler(request())).status, 422);
  }
  const timeout = createHandler(config, async () => { throw new DOMException("timeout", "TimeoutError"); });
  assert.equal((await timeout(request())).status, 504);
});
