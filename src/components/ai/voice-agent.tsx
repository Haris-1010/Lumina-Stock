"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import type { ISpeechRecognition } from "@/lib/speech-api";
import "@/lib/speech-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "session_listen" | "thinking" | "speaking" | "error";
type MicStatus = "unknown" | "granted" | "denied";
type HistoryItem = { role: "user" | "assistant"; content: string };

function getSpeechAPI() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ── Navigation map ─────────────────────────────────────────────────────────────

const NAV_MAP: Array<{ patterns: string[]; href: string; label: string }> = [
  { patterns: ["dashboard", "home", "overview", "main"], href: "/dashboard", label: "Dashboard" },
  { patterns: ["inventory", "stock", "products"], href: "/inventory", label: "Inventory" },
  { patterns: ["sales", "orders"], href: "/sales", label: "Sales" },
  { patterns: ["cashier", "pos", "point of sale", "checkout"], href: "/cashier", label: "Cashier" },
  { patterns: ["customers", "clients", "buyers"], href: "/customers", label: "Customers" },
  { patterns: ["analytics", "reports", "statistics", "charts"], href: "/analytics", label: "Analytics" },
  { patterns: ["forecasts", "forecast", "predictions"], href: "/forecasts", label: "Forecasts" },
  { patterns: ["invoices", "invoice", "billing"], href: "/invoices", label: "Invoices" },
  { patterns: ["purchase orders", "purchase order", "reorder"], href: "/purchase-orders", label: "Purchase Orders" },
  { patterns: ["suppliers", "supplier", "vendors"], href: "/suppliers", label: "Suppliers" },
  { patterns: ["adjustments", "adjust stock"], href: "/adjustments", label: "Adjustments" },
  { patterns: ["returns", "return"], href: "/returns", label: "Returns" },
  { patterns: ["wholesale orders"], href: "/wholesale-orders", label: "Wholesale Orders" },
  { patterns: ["wholesale dashboard", "wholesale"], href: "/wholesale", label: "Wholesale" },
  { patterns: ["marketing"], href: "/marketing", label: "Marketing" },
  { patterns: ["settings", "configuration", "config"], href: "/settings", label: "Settings" },
  { patterns: ["ai assistant", "ai", "assistant"], href: "/ai-assistant", label: "AI Assistant" },
  { patterns: ["recycle bin", "trash", "deleted items"], href: "/recycle-bin", label: "Recycle Bin" },
];

function detectNavIntent(text: string): { href: string; label: string } | null {
  const lower = text.toLowerCase();
  for (const entry of NAV_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) return { href: entry.href, label: entry.label };
  }
  return null;
}

function stripWakePhrase(text: string): string {
  return text
    .replace(/hey[,\s]+lumina[,.]?\s*/i, "")
    .replace(/^lumina[,.]?\s*/i, "")
    .trim();
}

const FAREWELL_RE = /\b(bye|goodbye|stop listening|exit|close|cancel|that's all|thanks bye)\b/i;

// ── Sub-components ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  );
}

function MiniWave() {
  const h = [3, 5, 7, 5, 3];
  return (
    <span className="flex items-end gap-[2px]">
      {h.map((height, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-amber-400 animate-bounce"
          style={{ height, animationDelay: `${i * 0.07}s`, animationDuration: "0.5s" }}
        />
      ))}
    </span>
  );
}

function GenieSVG({ state, micStatus }: { state: SessionState; micStatus: MicStatus }) {
  const active = state !== "idle";
  const topColor =
    micStatus === "denied" ? "#ef4444"
    : active || micStatus === "granted" ? "#10b981"
    : "#71717a";
  const botColor =
    micStatus === "denied" ? "#dc2626"
    : active || micStatus === "granted" ? "#0d9488"
    : "#52525b";

  return (
    <svg
      width="52"
      height="70"
      viewBox="0 0 52 70"
      fill="none"
      className={cn(
        "drop-shadow-lg transition-all group-hover:scale-110",
        state === "thinking" && "animate-pulse",
        state === "speaking" && "scale-105"
      )}
    >
      <defs>
        <linearGradient id="genie-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={topColor} />
          <stop offset="100%" stopColor={botColor} />
        </linearGradient>
      </defs>
      <path d="M11 36 Q7 50 10 60 Q15 70 26 68 Q37 70 42 60 Q45 50 41 36 Z" fill="url(#genie-grad)" opacity="0.72" />
      <circle cx="26" cy="20" r="18" fill="url(#genie-grad)" />
      <ellipse cx="18" cy="13" rx="6" ry="4" fill="white" opacity="0.18" transform="rotate(-20 18 13)" />
      <circle cx="20" cy="18" r="3" fill="white" opacity="0.92" />
      <circle cx="32" cy="18" r="3" fill="white" opacity="0.92" />
      <circle cx="21" cy="19" r="1.4" fill={topColor} />
      <circle cx="33" cy="19" r="1.4" fill={topColor} />
      {active
        ? <path d="M17 25 Q26 31 35 25" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9" />
        : <path d="M19 25 Q26 29 33 25" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9" />
      }
      <circle cx="26" cy="54" r="2" fill="white" opacity="0.28" />
    </svg>
  );
}

interface BubbleProps {
  state: SessionState;
  transcript: string;
  result: string;
}

function SpeechBubble({ state, transcript, result }: BubbleProps) {
  const barColor =
    state === "session_listen" ? "bg-gradient-to-r from-amber-400 to-yellow-300"
    : state === "thinking"     ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
    : state === "speaking"     ? "bg-gradient-to-r from-emerald-500 to-teal-400"
    :                            "bg-gradient-to-r from-red-500 to-rose-500";

  return (
    <div className="relative">
      <div className="rounded-2xl bg-zinc-950/95 border border-zinc-700/60 shadow-2xl backdrop-blur-md overflow-hidden w-72 max-w-[calc(100vw-48px)]">
        <div className={cn("h-0.5 w-full", barColor)} />

        <div className="px-4 py-3 flex flex-col gap-2">
          {/* Status row */}
          <div className="flex items-center gap-2">
            {state === "session_listen" && (
              <>
                <MiniWave />
                <span className="text-[11px] font-semibold text-amber-300">Listening…</span>
              </>
            )}
            {state === "thinking" && (
              <>
                <ThinkingDots />
                <span className="text-[11px] font-semibold text-violet-300 ml-1">Thinking…</span>
              </>
            )}
            {state === "speaking" && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] font-semibold text-emerald-300">Lumina</span>
              </>
            )}
            {state === "error" && (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-[11px] font-semibold text-red-300">Retrying…</span>
              </>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/50 px-3 py-2">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">You said</p>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{transcript}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <p className="text-[11px] text-zinc-200 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
              {result}
            </p>
          )}

          {/* Empty state hint */}
          {state === "session_listen" && !transcript && (
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Try: &quot;Show low stock&quot; · &quot;Open inventory&quot; · &quot;Sales this month&quot;
              <br />Say &quot;bye&quot; to end session
            </p>
          )}
        </div>
      </div>

      {/* Down-pointing arrow */}
      <div className="absolute -bottom-[5px] right-8 w-3 h-3 bg-zinc-950/95 border-b border-r border-zinc-700/60 rotate-45" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VoiceAgent({ organizationName: _organizationName }: { organizationName: string }) {
  const router = useRouter();
  const { language } = useI18n();

  const [enabled, setEnabled]           = useState(false);
  const [hasSpeech, setHasSpeech]       = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [micStatus, setMicStatus]       = useState<MicStatus>("unknown");
  const [transcript, setTranscript]     = useState("");
  const [result, setResult]             = useState("");

  // Refs — avoid stale closures
  const sessionActiveRef    = useRef(false);
  const enabledRef          = useRef(false);
  const languageRef         = useRef(language);
  const transcriptRef       = useRef("");
  const sessionHistoryRef   = useRef<HistoryItem[]>([]);
  const wakeRecRef          = useRef<ISpeechRecognition | null>(null);
  const cmdRecRef           = useRef<ISpeechRecognition | null>(null);
  const wakeLoopActiveRef   = useRef(false);

  // Stable function refs (avoid circular dep issues)
  const startSessionListeningRef = useRef<() => void>(() => {});
  const startWakeWordLoopRef     = useRef<() => void>(() => {});
  const startSessionRef          = useRef<() => void>(() => {});

  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { setHasSpeech(!!getSpeechAPI()); }, []);

  const setState = useCallback((s: SessionState) => {
    setSessionState(s);
  }, []);

  // ── localStorage sync ────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("lumina-agent") === "1";
    setEnabled(saved);
    enabledRef.current = saved;

    const handler = () => {
      const next = localStorage.getItem("lumina-agent") === "1";
      setEnabled(next);
      enabledRef.current = next;
    };
    window.addEventListener("lumina-agent-toggle", handler);
    return () => window.removeEventListener("lumina-agent-toggle", handler);
  }, []);

  // ── Check existing mic permission on mount ───────────────────────────────────

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((s) => {
        if (s.state === "granted") setMicStatus("granted");
        else if (s.state === "denied") setMicStatus("denied");
        s.onchange = () => {
          if (s.state === "granted") setMicStatus("granted");
          else if (s.state === "denied") setMicStatus("denied");
        };
      })
      .catch(() => {});
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────────

  const speakText = useCallback((text: string, onEnd: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    // Strip markdown-ish symbols and limit length
    const clean = text.replace(/[▸*#]/g, "").slice(0, 400);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = languageRef.current === "ur" ? "ur-PK" : "en-US";
    utt.rate = 1.05;
    utt.onend = () => onEnd();
    utt.onerror = () => onEnd();
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Stop helpers ─────────────────────────────────────────────────────────────

  const stopWakeRec = useCallback(() => {
    wakeLoopActiveRef.current = false;
    try { wakeRecRef.current?.abort(); } catch { /* ignore */ }
    wakeRecRef.current = null;
  }, []);

  const stopCmdRec = useCallback(() => {
    try { cmdRecRef.current?.abort(); } catch { /* ignore */ }
    cmdRecRef.current = null;
  }, []);

  // ── Close session ────────────────────────────────────────────────────────────

  const closeSession = useCallback(() => {
    sessionActiveRef.current = false;
    stopCmdRec();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
    setTranscript("");
    setResult("");
    transcriptRef.current = "";
    sessionHistoryRef.current = [];
    setTimeout(() => startWakeWordLoopRef.current(), 300);
  }, [stopCmdRec, setState]);

  // ── Process command ──────────────────────────────────────────────────────────

  const processCommand = useCallback(async (command: string) => {
    const clean = stripWakePhrase(command);

    if (!clean) {
      startSessionListeningRef.current();
      return;
    }

    // Farewell
    if (FAREWELL_RE.test(clean)) {
      const farewell = languageRef.current === "ur" ? "خدا حافظ!" : "Goodbye!";
      setResult(farewell);
      setState("speaking");
      speakText(farewell, () => closeSession());
      return;
    }

    // Navigation
    const nav = detectNavIntent(clean);
    if (nav) {
      const answer = `Navigating to ${nav.label}`;
      setResult(answer);
      setState("speaking");
      router.push(nav.href);
      sessionHistoryRef.current.push({ role: "user", content: clean }, { role: "assistant", content: answer });
      speakText(answer, () => {
        if (sessionActiveRef.current) startSessionListeningRef.current();
      });
      return;
    }

    // AI agent
    setState("thinking");
    setResult("");

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: clean,
          language: languageRef.current,
          history: sessionHistoryRef.current.slice(-10),
        }),
      });
      const payload = (await res.json()) as { answer?: string; error?: string };
      const answer =
        payload.answer ||
        payload.error ||
        (languageRef.current === "ur" ? "معذرت، کچھ غلط ہوا۔" : "Sorry, something went wrong.");

      sessionHistoryRef.current.push({ role: "user", content: clean }, { role: "assistant", content: answer });
      if (sessionHistoryRef.current.length > 12) {
        sessionHistoryRef.current = sessionHistoryRef.current.slice(-12);
      }

      setResult(answer);
      setState("speaking");
      speakText(answer, () => {
        if (sessionActiveRef.current) startSessionListeningRef.current();
      });
    } catch {
      const errMsg =
        languageRef.current === "ur" ? "نیٹ ورک خرابی۔ دوبارہ کوشش کریں۔" : "Network error. Retrying…";
      setResult(errMsg);
      setState("error");
      setTimeout(() => {
        if (sessionActiveRef.current) startSessionListeningRef.current();
      }, 3000);
    }
  }, [router, speakText, closeSession, setState]);

  // ── Session listening ────────────────────────────────────────────────────────

  const startSessionListening = useCallback(() => {
    const API = getSpeechAPI();
    if (!API || !sessionActiveRef.current) return;

    stopCmdRec();
    setState("session_listen");
    setTranscript("");
    transcriptRef.current = "";

    const rec = new API();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = languageRef.current === "ur" ? "ur-PK" : "en-US";

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      transcriptRef.current = text;
      setTranscript(text);
    };

    rec.onend = () => {
      cmdRecRef.current = null;
      if (!sessionActiveRef.current) return;
      const cmd = transcriptRef.current.trim();
      if (cmd) {
        void processCommand(cmd);
      } else {
        setTimeout(() => {
          if (sessionActiveRef.current) startSessionListeningRef.current();
        }, 400);
      }
    };

    rec.onerror = (e) => {
      cmdRecRef.current = null;
      if (e.error === "not-allowed") {
        setMicStatus("denied");
        closeSession();
        return;
      }
      if (!sessionActiveRef.current) return;
      // no-speech or network — just restart
      setTimeout(() => {
        if (sessionActiveRef.current) startSessionListeningRef.current();
      }, e.error === "no-speech" ? 300 : 1000);
    };

    cmdRecRef.current = rec;
    try {
      rec.start();
    } catch {
      closeSession();
    }
  }, [stopCmdRec, setState, processCommand, closeSession]);

  useEffect(() => { startSessionListeningRef.current = startSessionListening; }, [startSessionListening]);

  // ── Start session (call synchronously from click handler for mic permission) ──

  const startSession = useCallback(() => {
    stopWakeRec();
    sessionActiveRef.current = true;
    sessionHistoryRef.current = [];
    setResult("");
    setTranscript("");
    transcriptRef.current = "";
    startSessionListeningRef.current();
  }, [stopWakeRec]);

  useEffect(() => { startSessionRef.current = startSession; }, [startSession]);

  // ── Wake word loop ───────────────────────────────────────────────────────────

  const startWakeWordLoop = useCallback(() => {
    const API = getSpeechAPI();
    if (!API || !enabledRef.current || sessionActiveRef.current) return;
    if (wakeLoopActiveRef.current) return;

    wakeLoopActiveRef.current = true;
    try { wakeRecRef.current?.abort(); } catch { /* ignore */ }
    wakeRecRef.current = null;

    const rec = new API();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = languageRef.current === "ur" ? "ur-PK" : "en-US";

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      if (/hey[,\s]+lumina/i.test(text)) {
        startSessionRef.current();
      }
    };

    rec.onend = () => {
      wakeRecRef.current = null;
      wakeLoopActiveRef.current = false;
      if (enabledRef.current && !sessionActiveRef.current) {
        setTimeout(() => {
          if (enabledRef.current && !sessionActiveRef.current) startWakeWordLoopRef.current();
        }, 500);
      }
    };

    rec.onerror = (e) => {
      wakeRecRef.current = null;
      wakeLoopActiveRef.current = false;
      if (e.error === "not-allowed") { setMicStatus("denied"); return; }
      if (e.error === "aborted") return;
      if (enabledRef.current && !sessionActiveRef.current) {
        setTimeout(() => {
          if (enabledRef.current && !sessionActiveRef.current) startWakeWordLoopRef.current();
        }, 1500);
      }
    };

    wakeRecRef.current = rec;
    try {
      rec.start();
      setMicStatus("granted");
    } catch {
      wakeLoopActiveRef.current = false;
      wakeRecRef.current = null;
    }
  }, []);

  useEffect(() => { startWakeWordLoopRef.current = startWakeWordLoop; }, [startWakeWordLoop]);

  // Start wake word when mic is already granted + enabled
  useEffect(() => {
    if (enabled && hasSpeech && micStatus === "granted") {
      startWakeWordLoopRef.current();
    }
  }, [enabled, hasSpeech, micStatus]);

  // Stop everything when disabled
  useEffect(() => {
    if (!enabled) {
      stopWakeRec();
      stopCmdRec();
      sessionActiveRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setState("idle");
      setTranscript("");
      setResult("");
    }
  }, [enabled, stopWakeRec, stopCmdRec, setState]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopWakeRec();
    stopCmdRec();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopWakeRec, stopCmdRec]);

  if (!enabled || !hasSpeech) return null;

  // ── Click handler ────────────────────────────────────────────────────────────

  const handleGenieClick = () => {
    if (sessionActiveRef.current) {
      closeSession();
      return;
    }
    // Called directly from click — Chrome will prompt for mic if needed
    startSession();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const isActive = sessionState !== "idle";

  return (
    <>
      <style>{`
        @keyframes genie-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes genie-ring {
          0%   { transform: scale(1);   opacity: 0.45; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes bubble-in {
          0%   { transform: translateY(10px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        .genie-float { animation: genie-float 3s ease-in-out infinite; }
        .genie-ring  { animation: genie-ring 1.8s ease-out infinite; }
        .genie-ring2 { animation: genie-ring 1.8s ease-out infinite 0.75s; }
        .bubble-in   { animation: bubble-in 0.2s ease-out both; }
      `}</style>

      {/* Container — sits above the floating chat button; lifted on mobile to clear the bottom tab bar */}
      <div className="fixed bottom-36 right-5 z-50 select-none md:bottom-24 md:right-6" style={{ width: 52 }}>

        {/* Speech bubble — shown during any active session state */}
        {isActive && (
          <div className="absolute bottom-full right-0 mb-4 bubble-in">
            <SpeechBubble state={sessionState} transcript={transcript} result={result} />
          </div>
        )}

        {/* Pulse rings — only when idle + wake-word listening */}
        {!isActive && micStatus === "granted" && (
          <>
            <div className="genie-ring absolute inset-0 rounded-full border-2 border-emerald-400/40 pointer-events-none" />
            <div className="genie-ring2 absolute inset-0 rounded-full border border-emerald-300/25 pointer-events-none" />
          </>
        )}

        {/* Genie button */}
        <button
          type="button"
          onClick={handleGenieClick}
          className="group relative focus:outline-none"
          title={
            isActive           ? "Tap to end session"
            : micStatus === "denied" ? "Mic blocked — check browser settings"
            : micStatus === "granted" ? 'Say "Hey Lumina" or tap'
            : "Tap to start voice session"
          }
        >
          <div className={cn(!isActive && "genie-float")}>
            <GenieSVG state={sessionState} micStatus={micStatus} />
          </div>

          {/* Hover tooltip — only when idle */}
          {!isActive && (
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="rounded-xl bg-zinc-900/95 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 whitespace-nowrap shadow-lg border border-zinc-700/60">
                {micStatus === "denied"
                  ? "Mic blocked — allow in browser"
                  : micStatus === "granted"
                  ? 'Say "Hey Lumina" or tap'
                  : "Tap to start"}
              </div>
            </div>
          )}
        </button>

        {/* Denied badge */}
        {micStatus === "denied" && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white shadow whitespace-nowrap pointer-events-none">
            <MicOff className="h-2.5 w-2.5" />
            Blocked
          </div>
        )}

        {/* × button: close session when active, disable genie when idle */}
        <button
          type="button"
          onClick={
            isActive
              ? () => closeSession()
              : () => {
                  localStorage.setItem("lumina-agent", "0");
                  setEnabled(false);
                  window.dispatchEvent(new CustomEvent("lumina-agent-toggle"));
                }
          }
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white transition-colors shadow"
          title={isActive ? "End session" : "Disable voice agent"}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </>
  );
}
