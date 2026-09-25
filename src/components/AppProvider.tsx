"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { demoStore, supabaseStore, type DataStore } from "@/lib/store";

const DEMO_FLAG = "money-book:demo-mode";

function readDemoFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

interface AppState {
  ready: boolean;
  store: DataStore | null;
  email: string | null;
  /** 데이터가 바뀌면 증가 → 화면들이 다시 불러온다 */
  version: number;
  bump(): void;
  enterDemo(): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

/** 로그인(또는 데모) 상태의 저장소. 없으면 null */
export function useStore(): DataStore | null {
  return useApp().store;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const initial = supabase ? supabase.auth.getSession().then(({ data }) => data.session) : Promise.resolve(null);
    initial.then((s) => {
      setSession(s);
      setDemo(readDemoFlag());
      setReady(true);
    });
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const store = useMemo<DataStore | null>(() => {
    if (session && supabase) return supabaseStore(supabase);
    if (demo) return demoStore();
    return null;
  }, [session, demo]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const enterDemo = useCallback(() => {
    try {
      localStorage.setItem(DEMO_FLAG, "1");
    } catch {}
    setDemo(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_FLAG);
    } catch {}
    setDemo(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ ready, store, email: session?.user.email ?? null, version, bump, enterDemo, signOut }),
    [ready, store, session, version, bump, enterDemo, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
