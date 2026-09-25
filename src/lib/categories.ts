import type { TxType } from "./types";

export interface Category {
  name: string;
  emoji: string;
}

export const TYPE_LABEL: Record<TxType, string> = {
  expense: "지출",
  income: "수입",
  saving: "저축",
};

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    { name: "식비", emoji: "🍚" },
    { name: "카페/간식", emoji: "☕" },
    { name: "주거/통신", emoji: "🏠" },
    { name: "교통", emoji: "🚌" },
    { name: "생활/마트", emoji: "🛒" },
    { name: "쇼핑", emoji: "🛍️" },
    { name: "의료/건강", emoji: "💊" },
    { name: "문화/여가", emoji: "🎬" },
    { name: "경조사/선물", emoji: "🎁" },
    { name: "이자/금융", emoji: "💳" },
    { name: "기타", emoji: "📦" },
  ],
  income: [
    { name: "월급", emoji: "💰" },
    { name: "부수입", emoji: "💵" },
    { name: "이자수입", emoji: "🏦" },
    { name: "기타수입", emoji: "➕" },
  ],
  saving: [
    { name: "적금", emoji: "🐷" },
    { name: "투자", emoji: "📈" },
    { name: "청약", emoji: "🏡" },
    { name: "기타저축", emoji: "🪙" },
  ],
};

export function emojiFor(type: TxType, category: string): string {
  return CATEGORIES[type].find((c) => c.name === category)?.emoji ?? "🏷️";
}

/** 기본 카테고리 + 이미 쓰고 있는 카테고리(노션에서 가져온 것 등)를 합친 목록 */
export function categoriesFor(type: TxType, used: string[] = []): Category[] {
  const base = CATEGORIES[type];
  const extra = used
    .filter((name) => !base.some((c) => c.name === name))
    .map((name) => ({ name, emoji: "🏷️" }));
  return [...base, ...extra];
}
