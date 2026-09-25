"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import type { Recurring, Transaction } from "./types";

interface Loaded<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * 저장소에서 불러온 값. 데이터가 바뀌면(bump) 자동으로 다시 불러오고,
 * 새로 불러오는 동안에는 이전 값을 그대로 보여준다.
 */
function useLoad<T>(key: string, empty: T, load: (() => Promise<T>) | null): Loaded<T> {
  const [res, setRes] = useState<{ key: string | null; data: T; error: string | null }>({ key: null, data: empty, error: null });

  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then((data) => alive && setRes({ key, data, error: null }))
      .catch((e: Error) => alive && setRes({ key, data: empty, error: e.message }));
    return () => {
      alive = false;
    };
    // load는 key가 바뀔 때만 새로 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load === null]);

  return { data: res.data, loading: res.key !== key, error: res.error };
}

const NO_TX: Transaction[] = [];
const NO_RECURRING: Recurring[] = [];

export function useTransactions(from: string, to: string): Loaded<Transaction[]> {
  const { store, version } = useApp();
  return useLoad(`${store?.kind}|${version}|${from}|${to}`, NO_TX, store ? () => store.listTransactions(from, to) : null);
}

export function useRecurring(): Loaded<Recurring[]> {
  const { store, version } = useApp();
  return useLoad(`${store?.kind}|${version}`, NO_RECURRING, store ? () => store.listRecurring() : null);
}
