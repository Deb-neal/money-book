"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { resetDemo } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { today } from "@/lib/format";

export default function SettingsPage() {
  const { store, email, signOut, bump } = useApp();
  const router = useRouter();

  async function exportCsv() {
    if (!store) return;
    const rows = await store.listTransactions("1900-01-01", "2999-12-31");
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "날짜,구분,카테고리,내역,금액,계좌,메모",
      ...rows.map((r) => [r.date, r.type, r.category, r.title, r.amount, r.account, r.memo].map(esc).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `money-book-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="card divide-y divide-line/60">
        <div className="p-4 text-sm">
          <p className="text-xs text-muted">계정</p>
          <p className="font-medium">{store?.kind === "demo" ? "데모 모드" : email}</p>
        </div>
        <Link href="/import/" className="flex items-center justify-between p-4">
          <span>📥 노션 가계부 가져오기</span>
          <span className="text-muted">›</span>
        </Link>
        <button className="flex w-full items-center justify-between p-4 text-left" onClick={exportCsv}>
          <span>📤 전체 내역 CSV로 내보내기</span>
          <span className="text-muted">›</span>
        </button>
        {store?.kind === "demo" && (
          <button
            className="flex w-full items-center justify-between p-4 text-left"
            onClick={() => {
              if (!confirm("데모 데이터를 처음 상태로 되돌릴까요?")) return;
              resetDemo();
              bump();
            }}
          >
            <span>🔄 데모 데이터 초기화</span>
            <span className="text-muted">›</span>
          </button>
        )}
      </section>

      <section className="card p-4 text-sm text-ink-2">
        <p className="font-semibold text-ink">📱 홈 화면에 추가</p>
        <p className="mt-1">
          <b>아이폰</b>: Safari 공유 버튼 → &apos;홈 화면에 추가&apos;
          <br />
          <b>안드로이드</b>: Chrome 메뉴 → &apos;앱 설치&apos; 또는 &apos;홈 화면에 추가&apos;
        </p>
      </section>

      <button
        className="btn btn-ghost w-full text-danger"
        onClick={async () => {
          await signOut();
          router.replace("/login/");
        }}
      >
        {store?.kind === "demo" ? "데모 나가기" : "로그아웃"}
      </button>
      {!supabase && <p className="text-center text-xs text-muted">Supabase 미연결 · 데모 전용으로 실행 중</p>}
    </div>
  );
}
