import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewRecurring, NewTransaction, Recurring, Transaction } from "./types";
import { addMonths, currentMonth, daysInMonth } from "./format";

/** 화면은 이 인터페이스만 보고, 실제 저장소(Supabase / 데모)는 갈아끼운다. */
export interface DataStore {
  kind: "supabase" | "demo";
  listTransactions(from: string, to: string): Promise<Transaction[]>;
  addTransactions(rows: NewTransaction[]): Promise<void>;
  updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  listRecurring(): Promise<Recurring[]>;
  saveRecurring(row: NewRecurring & { id?: string }): Promise<void>;
  deleteRecurring(id: string): Promise<void>;
}

const TX_COLUMNS = "id,date,type,category,title,amount,account,memo,recurring_id";

export function supabaseStore(sb: SupabaseClient): DataStore {
  const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    kind: "supabase",
    async listTransactions(from, to) {
      // Supabase 기본 응답은 1000행 제한이라 페이지를 돌며 모두 받는다.
      const out: Transaction[] = [];
      for (let offset = 0; ; offset += 1000) {
        const rows = check(
          await sb
            .from("transactions")
            .select(TX_COLUMNS)
            .gte("date", from)
            .lte("date", to)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + 999),
        ) as Transaction[];
        out.push(...rows.map((r) => ({ ...r, amount: Number(r.amount) })));
        if (rows.length < 1000) return out;
      }
    },
    async addTransactions(rows) {
      for (let i = 0; i < rows.length; i += 500) {
        check(await sb.from("transactions").insert(rows.slice(i, i + 500)));
      }
    },
    async updateTransaction(id, patch) {
      check(await sb.from("transactions").update(patch).eq("id", id));
    },
    async deleteTransaction(id) {
      check(await sb.from("transactions").delete().eq("id", id));
    },
    async listRecurring() {
      const rows = check(
        await sb
          .from("recurring")
          .select("id,title,type,category,amount,day_of_month,account,memo,active")
          .order("day_of_month"),
      ) as Recurring[];
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    },
    async saveRecurring({ id, ...row }) {
      if (id) check(await sb.from("recurring").update(row).eq("id", id));
      else check(await sb.from("recurring").insert(row));
    },
    async deleteRecurring(id) {
      check(await sb.from("recurring").delete().eq("id", id));
    },
  };
}

// ---------------------------------------------------------------------------
// 데모 저장소: 포트폴리오 방문자용. 가짜 데이터를 브라우저(localStorage)에만 둔다.

const DEMO_KEY = "money-book:demo";

interface DemoData {
  transactions: Transaction[];
  recurring: Recurring[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function seedDemo(): DemoData {
  const recurring: Recurring[] = [
    { id: uid(), title: "월세", type: "expense", category: "주거/통신", amount: 480000, day_of_month: 24, account: "OO은행 000-000-000000", memo: null, active: true },
    { id: uid(), title: "관리비", type: "expense", category: "주거/통신", amount: 120000, day_of_month: 24, account: "OO은행 000-000-000000", memo: null, active: true },
    { id: uid(), title: "인터넷+핸드폰", type: "expense", category: "주거/통신", amount: 55000, day_of_month: 24, account: "카드결제", memo: null, active: true },
    { id: uid(), title: "주택청약", type: "saving", category: "청약", amount: 100000, day_of_month: 25, account: "OO은행 자동이체", memo: null, active: true },
    { id: uid(), title: "정기적금", type: "saving", category: "적금", amount: 700000, day_of_month: 25, account: "OO은행 자동이체", memo: null, active: true },
    { id: uid(), title: "월급", type: "income", category: "월급", amount: 3200000, day_of_month: 25, account: null, memo: null, active: true },
  ];

  // 시드 고정 난수로 매번 같은 데모 데이터를 만든다.
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const variable: [string, string, number, number][] = [
    ["식비", "점심", 9000, 14000],
    ["식비", "저녁 배달", 18000, 32000],
    ["식비", "장보기", 25000, 70000],
    ["카페/간식", "커피", 4500, 7000],
    ["교통", "교통카드 충전", 20000, 50000],
    ["생활/마트", "생활용품", 8000, 40000],
    ["쇼핑", "옷", 30000, 120000],
    ["문화/여가", "영화", 14000, 30000],
    ["의료/건강", "병원", 8000, 40000],
  ];

  const transactions: Transaction[] = [];
  const thisMonth = currentMonth();
  const todayDay = new Date().getDate();
  for (let back = 8; back >= 0; back--) {
    const month = addMonths(thisMonth, -back);
    const last = back === 0 ? todayDay : daysInMonth(month);
    for (const r of recurring) {
      if (r.day_of_month > last) continue;
      transactions.push({ id: uid(), date: `${month}-${String(r.day_of_month).padStart(2, "0")}`, type: r.type, category: r.category, title: r.title, amount: r.amount, account: r.account, memo: null, recurring_id: r.id });
    }
    const count = Math.round(last * 1.1);
    for (let i = 0; i < count; i++) {
      const [category, title, lo, hi] = pick(variable);
      const day = 1 + Math.floor(rand() * last);
      const amount = Math.round((lo + rand() * (hi - lo)) / 100) * 100;
      transactions.push({ id: uid(), date: `${month}-${String(day).padStart(2, "0")}`, type: "expense", category, title, amount, account: null, memo: null, recurring_id: null });
    }
  }
  return { transactions, recurring };
}

function loadDemo(): DemoData {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoData;
  } catch {}
  const data = seedDemo();
  saveDemo(data);
  return data;
}

function saveDemo(data: DemoData) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  } catch {}
}

export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {}
}

export function demoStore(): DataStore {
  const mutate = (fn: (d: DemoData) => void) => {
    const d = loadDemo();
    fn(d);
    saveDemo(d);
  };
  return {
    kind: "demo",
    async listTransactions(from, to) {
      return loadDemo()
        .transactions.filter((t) => t.date >= from && t.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async addTransactions(rows) {
      mutate((d) => d.transactions.push(...rows.map((r) => ({ ...r, id: uid() }))));
    },
    async updateTransaction(id, patch) {
      mutate((d) => {
        d.transactions = d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
    },
    async deleteTransaction(id) {
      mutate((d) => {
        d.transactions = d.transactions.filter((t) => t.id !== id);
      });
    },
    async listRecurring() {
      return [...loadDemo().recurring].sort((a, b) => a.day_of_month - b.day_of_month);
    },
    async saveRecurring({ id, ...row }) {
      mutate((d) => {
        if (id) d.recurring = d.recurring.map((r) => (r.id === id ? { ...r, ...row } : r));
        else d.recurring.push({ ...row, id: uid() });
      });
    },
    async deleteRecurring(id) {
      mutate((d) => {
        d.recurring = d.recurring.filter((r) => r.id !== id);
        d.transactions = d.transactions.map((t) => (t.recurring_id === id ? { ...t, recurring_id: null } : t));
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 고정지출 반영

/** 해당 월에 아직 기록되지 않은 활성 고정항목 */
export function pendingRecurring(recurring: Recurring[], monthTx: Transaction[]): Recurring[] {
  const done = new Set(monthTx.map((t) => t.recurring_id).filter(Boolean));
  return recurring.filter((r) => r.active && !done.has(r.id));
}

export function recurringToTransaction(month: string, r: Recurring): NewTransaction {
  const day = Math.min(r.day_of_month, daysInMonth(month));
  return {
    date: `${month}-${String(day).padStart(2, "0")}`,
    type: r.type,
    category: r.category,
    title: r.title,
    amount: r.amount,
    account: r.account,
    memo: r.memo,
    recurring_id: r.id,
  };
}
