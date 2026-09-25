"use client";

import { useState } from "react";
import { currentMonth } from "./format";

const KEY = "money-book:month";

/** 홈/내역 탭이 같은 달을 보도록 선택한 월을 sessionStorage에 기억한다. */
export function useMonth(): [string, (m: string) => void] {
  // 페이지들은 AppShell이 로그인 확인 후에만(=브라우저에서만) 그리므로 바로 읽어도 된다.
  const [month, setMonthState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    } catch {}
    return currentMonth();
  });

  const setMonth = (m: string) => {
    setMonthState(m);
    try {
      sessionStorage.setItem(KEY, m);
    } catch {}
  };

  return [month, setMonth];
}
