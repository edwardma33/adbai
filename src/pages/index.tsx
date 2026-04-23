import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type SaveResponse = {
  content: string;
  updatedAt: number;
};

type SocketMessage =
  | {
      type: "textarea:init";
      content: string;
      updatedAt: number;
    }
  | {
      type: "textarea:update";
      content: string;
      updatedAt: number;
    };

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(timestamp);
}

export default function Home() {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting">(
    "connecting",
  );
  const [lastSavedAt, setLastSavedAt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const hasEditedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef("");

  const isDirty = useMemo(() => content !== savedContent, [content, savedContent]);

  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          return;
        }

        setConnectionState("connected");

        if (hasEditedRef.current && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "textarea:update",
              content: latestContentRef.current,
            }),
          );
        }
      };

      socket.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        let payload: SocketMessage;

        try {
          payload = JSON.parse(event.data as string) as SocketMessage;
        } catch {
          return;
        }

        if (payload.type === "textarea:init" && hasEditedRef.current) {
          return;
        }

        setContent(payload.content);
        if (payload.type === "textarea:init") {
          setSavedContent(payload.content);
          setLastSavedAt(payload.updatedAt);
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }

        setConnectionState("reconnecting");

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = setTimeout(connect, 1200);
      };

      socket.onerror = () => {
        setError("Websocket connection error");
      };
    };

    connect();

    return () => {
      cancelled = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      socketRef.current?.close();
    };
  }, []);

  const sendUpdate = (nextContent: string) => {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "textarea:update",
          content: nextContent,
        }),
      );
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = event.target.value;
    hasEditedRef.current = true;
    setContent(nextContent);
    sendUpdate(nextContent);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/textarea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      const data = (await response.json()) as SaveResponse;
      setSavedContent(data.content);
      setLastSavedAt(data.updatedAt);
      hasEditedRef.current = false;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSaved = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/textarea");

      if (!response.ok) {
        throw new Error(`Load failed with status ${response.status}`);
      }

      const data = (await response.json()) as SaveResponse;
      setContent(data.content);
      setSavedContent(data.content);
      setLastSavedAt(data.updatedAt);
      hasEditedRef.current = false;

      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "textarea:update",
            content: data.content,
          }),
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load saved data");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshSavedPreview = async () => {
    setError(null);

    try {
      const response = await fetch("/api/textarea/raw");

      if (!response.ok) {
        throw new Error(`Preview refresh failed with status ${response.status}`);
      }

      const rawContent = await response.text();
      setSavedContent(rawContent);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh saved preview",
      );
    }
  };

  const statusLabel =
    connectionState === "connected"
      ? isDirty
        ? "Live, unsaved changes"
        : "Live, in sync"
      : connectionState === "connecting"
        ? "Connecting"
        : "Reconnecting";

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_30%),linear-gradient(135deg,_#111827_0%,_#0b1220_50%,_#050816_100%)] px-6 py-10 text-slate-100`}
    >
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="mb-4 text-xs uppercase tracking-[0.28em] text-cyan-200/80">
              websocket textarea
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              A single textarea that stays in sync across every open client.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Typing updates the shared value over websockets in real time. The
              save button writes the current text into SQLite through Drizzle.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Connection
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {statusLabel}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Saved
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {formatTimestamp(lastSavedAt)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Mode
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {isDirty ? "Draft" : "Persisted"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-white">
                  Shared editor
                </div>
                <div className="text-xs text-slate-400">
                  Websocket-connected textarea
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleLoadSaved}
                disabled={isSaving}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Load saved
              </button>
            </div>

            <textarea
              value={content}
              onChange={handleChange}
              placeholder="Start typing. Open a second tab to see the text mirror live."
              spellCheck={false}
              className="min-h-[28rem] w-full resize-none rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-4 font-mono text-sm leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-black/40"
            />

            <div className="flex flex-col gap-2 px-4 py-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <span>{content.length} characters</span>
              <span>{isDirty ? "Unsaved changes" : "Saved to SQLite"}</span>
            </div>

            {error ? (
              <div className="mx-4 mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </section>
        </div>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
                saved preview
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Persisted textarea content
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Read-only view of the latest value stored in SQLite.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshSavedPreview}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Refresh preview
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
            <textarea
              readOnly
              value={savedContent}
              spellCheck={false}
              className="min-h-52 w-full resize-none rounded-[1.5rem] border border-white/10 bg-black/30 px-5 py-4 font-mono text-sm leading-6 text-slate-100 outline-none ring-0"
            />
            <div className="grid gap-4 lg:w-64">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Raw endpoint
                </div>
                <a
                  href="/api/textarea/raw"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm font-medium text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 transition hover:text-cyan-100"
                >
                  /api/textarea/raw
                </a>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Saved length
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {savedContent.length} characters
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
