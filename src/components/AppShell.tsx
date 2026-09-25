"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "./AppProvider";
import { BASE_PATH } from "@/lib/supabase";

const NAV = [
  { href: "/", label: "홈", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/history/", label: "내역", icon: "M5 6h14M5 12h14M5 18h9" },
  { href: "/add/", label: "추가", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/recurring/", label: "고정", icon: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" },
  { href: "/settings/", label: "설정", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

const PUBLIC_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, store } = useApp();
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (ready && !store && !isPublic) router.replace("/login/");
  }, [ready, store, isPublic, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {});
    }
  }, []);

  if (isPublic) return <>{children}</>;
  if (!ready || !store) {
    return <div className="flex min-h-dvh items-center justify-center text-muted">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {store.kind === "demo" && (
        <div className="pt-safe bg-accent text-center text-xs font-medium text-accent-ink">
          <div className="py-1.5">데모 모드 · 가짜 데이터가 이 브라우저에만 저장돼요</div>
        </div>
      )}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((item) => {
            const active = (item.href.replace(/\/$/, "") || "/") === pathname;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent" : "text-muted"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.primary ? (
                    <span className="-mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <Icon d={item.icon} />
                    </span>
                  ) : (
                    <Icon d={item.icon} />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
