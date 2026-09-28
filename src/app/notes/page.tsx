"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/AppShell";
import { useNotes } from "@/lib/hooks";
import { today } from "@/lib/format";
import type { Note } from "@/lib/types";

const PIN_ICON = "M12 17v5M9 3h6l-1 7 4 3v2H6v-2l4-3z";
const TRASH_ICON = "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3";

function noteHeading(n: Pick<Note, "title" | "body">): string {
  return n.title.trim() || n.body.trim().split("\n")[0] || "새 메모";
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (date === today()) return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  if (date.slice(0, 4) === today().slice(0, 4)) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return date.replace(/-/g, ".");
}

export default function NotesPage() {
  const { data: notes, loading, error } = useNotes();
  const [query, setQuery] = useState("");
  // undefined: 목록, null: 새 메모, Note: 기존 메모 편집
  const [editing, setEditing] = useState<Note | null | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">메모</h1>
        <button className="btn btn-primary px-3 py-2 text-sm" onClick={() => setEditing(null)}>
          + 새 메모
        </button>
      </header>

      <input className="field" type="search" placeholder="메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

      {error && <p className="card p-3 text-sm text-danger">불러오지 못했어요: {error}</p>}

      {loading && !notes.length ? (
        <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
      ) : !filtered.length ? (
        <p className="py-10 text-center text-sm text-muted">{query ? "검색 결과가 없어요" : "아직 메모가 없어요"}</p>
      ) : (
        <>
          {pinned.length > 0 && <NoteGroup label="고정됨" notes={pinned} onOpen={setEditing} />}
          <NoteGroup label={pinned.length ? "메모" : null} notes={others} onOpen={setEditing} />
        </>
      )}

      {editing !== undefined && <NoteEditor key={editing?.id ?? "new"} initial={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function NoteGroup({ label, notes, onOpen }: { label: string | null; notes: Note[]; onOpen(n: Note): void }) {
  if (!notes.length) return null;
  return (
    <section>
      {label && <h2 className="mb-2 text-xs font-medium text-muted">{label}</h2>}
      <ul className="card divide-y divide-line/60">
        {notes.map((n) => {
          const heading = noteHeading(n);
          const preview = (n.title.trim() ? n.body : n.body.split("\n").slice(1).join("\n")).trim();
          return (
            <li key={n.id}>
              <button className="w-full px-4 py-3 text-left" onClick={() => onOpen(n)}>
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{heading}</span>
                  <span className="shrink-0 text-xs text-muted">{whenLabel(n.updated_at)}</span>
                </span>
                {preview && <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-ink-2">{preview}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** 전체 화면 편집기. 입력을 멈추면 자동 저장하고, 닫을 때 남은 변경을 저장한다. */
function NoteEditor({ initial, onClose }: { initial: Note | null; onClose(): void }) {
  const { store, bump } = useApp();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const idRef = useRef(initial?.id);
  const latest = useRef({ title, body, pinned });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function save(): Promise<void> {
    clearTimeout(timer.current);
    if (!dirty.current || !store) return chain.current;
    dirty.current = false;
    const snapshot = latest.current;
    // 아무것도 안 쓴 새 메모는 만들지 않는다
    if (!idRef.current && !snapshot.title.trim() && !snapshot.body.trim()) return chain.current;
    setStatus("saving");
    // 저장 요청이 겹치지 않게 순서대로 이어 붙인다 (새 메모가 두 번 생기는 것 방지)
    chain.current = chain.current.then(async () => {
      try {
        const saved = await store.saveNote({ id: idRef.current, ...snapshot });
        idRef.current = saved.id;
        setStatus(dirty.current ? "idle" : "saved");
      } catch {
        dirty.current = true;
        setStatus("error");
      }
    });
    return chain.current;
  }

  function change(patch: Partial<typeof latest.current>, immediate = false) {
    latest.current = { ...latest.current, ...patch };
    dirty.current = true;
    setStatus("idle");
    clearTimeout(timer.current);
    if (immediate) save();
    else timer.current = setTimeout(save, 700);
  }

  async function close() {
    await save();
    const { title: t, body: b } = latest.current;
    if (idRef.current && !t.trim() && !b.trim() && store) await store.deleteNote(idRef.current);
    bump();
    onClose();
  }

  async function remove() {
    if (!confirm("이 메모를 삭제할까요?")) return;
    clearTimeout(timer.current);
    dirty.current = false;
    await chain.current;
    if (idRef.current && store) await store.deleteNote(idRef.current);
    bump();
    onClose();
  }

  // 앱을 내리거나 다른 앱으로 전환할 때도 저장
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      clearTimeout(timer.current);
    };
    // save는 ref만 사용하므로 한 번만 등록하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initial) bodyRef.current?.focus();
  }, [initial]);

  const statusText = { idle: "", saving: "저장 중…", saved: "저장됨", error: "저장 실패 · 다시 시도해요" }[status];

  return (
    <div role="dialog" aria-label="메모 편집" className="pt-safe pb-safe fixed inset-0 z-40 flex justify-center bg-bg">
      <div className="flex w-full max-w-md flex-col px-4">
        <div className="flex items-center gap-1 py-3">
          <button className="-ml-2 flex items-center gap-0.5 rounded-full p-2 text-accent" onClick={close}>
            <Icon d="M15 6l-6 6 6 6" size={20} />
            목록
          </button>
          <span className={`ml-auto text-xs ${status === "error" ? "text-danger" : "text-muted"}`} role="status">
            {statusText}
          </span>
          <button
            className={`rounded-full p-2 ${pinned ? "text-accent" : "text-ink-2"}`}
            aria-label={pinned ? "고정 해제" : "위에 고정"}
            aria-pressed={pinned}
            onClick={() => {
              setPinned(!pinned);
              change({ pinned: !pinned }, true);
            }}
          >
            <Icon d={PIN_ICON} size={20} />
          </button>
          {initial && (
            <button className="rounded-full p-2 text-ink-2" aria-label="삭제" onClick={remove}>
              <Icon d={TRASH_ICON} size={20} />
            </button>
          )}
        </div>
        <input
          className="w-full bg-transparent py-2 text-xl font-bold outline-none placeholder:text-muted"
          placeholder="제목"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            change({ title: e.target.value });
          }}
        />
        <textarea
          ref={bodyRef}
          className="w-full flex-1 resize-none bg-transparent pb-8 pt-2 leading-relaxed outline-none placeholder:text-muted"
          placeholder="메모를 입력하세요"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            change({ body: e.target.value });
          }}
        />
      </div>
    </div>
  );
}
