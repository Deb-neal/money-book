"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { ready, store, enterDemo } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && store) router.replace("/");
  }, [ready, store, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("이메일 또는 비밀번호가 맞지 않아요.");
  }

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl font-bold text-accent-ink">₩</div>
        <h1 className="text-2xl font-bold">머니북</h1>
        <p className="mt-1 text-sm text-ink-2">빠르게 입력하고 한눈에 보는 가계부</p>
      </div>

      {supabase ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="field" type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="field" type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>
      ) : (
        <p className="card p-4 text-sm text-ink-2">
          로그인 서버가 연결되지 않은 빌드예요. 아래 데모로 둘러볼 수 있어요.
        </p>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        처음 오셨나요?
        <span className="h-px flex-1 bg-line" />
      </div>
      <button className="btn btn-ghost w-full" onClick={enterDemo}>
        데모 데이터로 둘러보기
      </button>
    </div>
  );
}
