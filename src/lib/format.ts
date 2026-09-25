export function won(n: number): string {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

/** 차트 축용 짧은 표기: 1,250,000 → 125만 */
export function shortWon(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  return n.toLocaleString("ko-KR");
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

/** YYYY-MM */
export function currentMonth(): string {
  return today().slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${month}-${pad(daysInMonth(month))}`];
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function dayLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  const w = "일월화수목금토"[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
}

/** "1,234" 같은 입력을 숫자로 */
export function parseAmount(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
