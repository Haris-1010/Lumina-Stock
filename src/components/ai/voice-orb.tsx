"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Volume2, VolumeX, X, Sparkles, RefreshCw, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
  };
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

function getSpeechRecognitionAPI() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ── Animated waveform bars ────────────────────────────────────────────────────

function WaveBars() {
  const heights = [14, 22, 28, 22, 14];
  return (
    <div className="flex items-center gap-[3px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[5px] rounded-full bg-white animate-bounce"
          style={{ height: h, animationDelay: `${i * 0.09}s`, animationDuration: "0.55s" }}
        />
      ))}
    </div>
  );
}

// ── Format message for display ────────────────────────────────────────────────

function FormatResponse({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-1 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("▸") || line.startsWith("•") || line.startsWith("-")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-emerald-500 font-bold shrink-0 mt-0.5">▸</span>
              <span>{line.replace(/^[▸•\-]\s*/, "")}</span>
            </div>
          );
        }
        if (line.endsWith(":") && line.length < 60) {
          return <p key={i} className="font-semibold text-zinc-800 dark:text-zinc-200 mt-2">{line}</p>;
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VoiceOrb({ organizationName }: { organizationName: string }) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);

  // Refs to avoid stale closures
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const ttsResumeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!getSpeechRecognitionAPI()) setSupported(false);
  }, []);

  const stopTTS = useCallback(() => {
    if (ttsResumeRef.current) { clearInterval(ttsResumeRef.current); ttsResumeRef.current = null; }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopListening();
    stopTTS();
    setState("idle");
    setTranscript("");
    setInterimTranscript("");
    setResponse("");
    transcriptRef.current = "";
    interimRef.current = "";
    setIsOpen(false);
  }, [stopListening, stopTTS]);

  const speak = useCallback((text: string) => {
    if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) {
      setState("idle");
      return;
    }
    setState("speaking");
    stopTTS();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const loadVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang.startsWith("en") && /Google|Neural|Natural/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en")) ??
        voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setState("idle");
        if (ttsResumeRef.current) { clearInterval(ttsResumeRef.current); ttsResumeRef.current = null; }
      };
      utterance.onerror = () => setState("idle");

      // Chrome throttle fix
      ttsResumeRef.current = setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 8000);

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        loadVoiceAndSpeak();
      };
    }
  }, [stopTTS]);

  const sendToAI = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setState("thinking");
    setInterimTranscript("");
    interimRef.current = "";

    try {
      const res = await fetch("/api/ai/inventory-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language, mode: "inventory", history: [] }),
      });
      const payload = (await res.json()) as { answer?: string; error?: string };
      const answer =
        payload.answer || payload.error || "Sorry, I couldn't get an answer right now.";

      setResponse(answer);

      const cleanForTTS = answer
        .replace(/\*\*/g, "")
        .replace(/#{1,6}\s*/g, "")
        .replace(/[▸•\-]\s*/g, "")
        .replace(/\n+/g, ". ")
        .trim();

      speak(cleanForTTS);
    } catch {
      setResponse("Network error. Please try again.");
      setState("error");
    }
  }, [language, speak]);

  // Keep a ref to the latest sendToAI so recognition.onend never gets a stale copy
  const sendToAIRef = useRef(sendToAI);
  useEffect(() => { sendToAIRef.current = sendToAI; }, [sendToAI]);

  const startListening = useCallback(() => {
    const API = getSpeechRecognitionAPI();
    if (!API) return;

    stopListening();
    stopTTS();
    setState("listening");
    setTranscript("");
    setInterimTranscript("");
    setResponse("");
    transcriptRef.current = "";
    interimRef.current = "";

    const recognition = new API();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "ur" ? "ur-PK" : "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) { transcriptRef.current = final; setTranscript(final); }
      if (interim) { interimRef.current = interim; setInterimTranscript(interim); }
    };

    recognition.onend = () => {
      const finalText = (transcriptRef.current || interimRef.current).trim();
      recognitionRef.current = null;
      if (finalText) {
        setTranscript(finalText);
        setInterimTranscript("");
        void sendToAIRef.current(finalText);
      } else {
        setState("idle");
      }
    };

    recognition.onerror = (e) => {
      recognitionRef.current = null;
      setState(e.error === "no-speech" ? "idle" : "error");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, stopListening, stopTTS]);

  if (!supported) return null;

  // ── State-driven config ────────────────────────────────────────────────────

  const STATE_CONFIG: Record<VoiceState, {
    orbGradient: string;
    ringColor: string;
    label: string;
    actionLabel?: string;
    onOrbClick?: () => void;
  }> = {
    idle: {
      orbGradient: "from-emerald-500 via-teal-500 to-cyan-500",
      ringColor: "border-emerald-400/40",
      label: "Tap the orb to speak",
      onOrbClick: startListening,
    },
    listening: {
      orbGradient: "from-emerald-400 via-teal-400 to-cyan-400",
      ringColor: "border-emerald-300/50",
      label: "Listening… speak now",
    },
    thinking: {
      orbGradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      ringColor: "border-violet-400/40",
      label: "Thinking…",
    },
    speaking: {
      orbGradient: "from-blue-500 via-indigo-500 to-violet-500",
      ringColor: "border-blue-400/40",
      label: "Speaking… tap to stop",
      onOrbClick: () => { stopTTS(); setState("idle"); },
    },
    error: {
      orbGradient: "from-red-500 via-rose-500 to-pink-500",
      ringColor: "border-red-400/40",
      label: "Something went wrong",
      actionLabel: "Tap to retry",
      onOrbClick: startListening,
    },
  };

  const cfg = STATE_CONFIG[state];

  return (
    <>
      {/* ── Trigger FAB ───────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all duration-300 bg-gradient-to-br from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:scale-105 active:scale-95"
        aria-label="Lumina Voice Assistant"
        title="Lumina Voice Assistant"
      >
        <span className="absolute inset-0 rounded-full bg-violet-400/25 animate-ping" />
        <Mic className="h-5 w-5 text-white relative z-10" />
        {/* Voice badge */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-violet-600">
          <Sparkles className="h-2.5 w-2.5 text-violet-600" />
        </span>
      </button>

      {/* ── Overlay ───────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={state === "idle" || state === "error" ? handleClose : undefined}
          />

          {/* Panel */}
          <div className="relative w-full max-w-[380px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-white dark:bg-zinc-950">
            {/* Top gradient strip */}
            <div className={cn("h-1 w-full bg-gradient-to-r", cfg.orbGradient)} />

            <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-5">

              {/* Header row */}
              <div className="w-full flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    Lumina Voice
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{organizationName} · AI Assistant</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Orb ────────────────────────────────────────────────────── */}
              <div
                className="relative flex items-center justify-center select-none"
                style={{ width: 220, height: 220 }}
              >
                {/* Expanding ping rings */}
                {(state === "listening" || state === "speaking") && (
                  <>
                    <div className={cn("absolute rounded-full border-2 animate-ping", cfg.ringColor)} style={{ width: 130, height: 130 }} />
                    <div className={cn("absolute rounded-full border animate-ping", cfg.ringColor)} style={{ width: 165, height: 165, animationDelay: "0.25s" }} />
                    <div className={cn("absolute rounded-full border animate-ping", cfg.ringColor)} style={{ width: 200, height: 200, animationDelay: "0.5s" }} />
                  </>
                )}
                {state === "idle" && (
                  <>
                    <div className="absolute rounded-full bg-emerald-400/10 animate-pulse" style={{ width: 150, height: 150 }} />
                    <div className="absolute rounded-full bg-teal-400/5 animate-pulse" style={{ width: 190, height: 190, animationDelay: "1s" }} />
                  </>
                )}
                {state === "thinking" && (
                  <div className="absolute rounded-full border-2 border-violet-400/30 border-t-violet-500 animate-spin" style={{ width: 130, height: 130 }} />
                )}

                {/* Main orb */}
                <button
                  type="button"
                  onClick={cfg.onOrbClick}
                  disabled={state === "listening" || state === "thinking"}
                  className={cn(
                    "relative flex items-center justify-center rounded-full shadow-2xl",
                    "transition-all duration-700 cursor-pointer",
                    `bg-gradient-to-br ${cfg.orbGradient}`,
                    state === "listening" && "scale-110 cursor-default",
                    state === "thinking" && "scale-105 cursor-default",
                    state === "idle" && "hover:scale-105 active:scale-95 animate-pulse",
                    state === "speaking" && "animate-pulse hover:scale-105",
                    state === "error" && "hover:scale-105 active:scale-95",
                  )}
                  style={{ width: 110, height: 110 }}
                  aria-label={cfg.label}
                >
                  {/* Highlight shimmer */}
                  <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 blur-md pointer-events-none" />
                  <div className="absolute inset-0 rounded-full bg-white/10 pointer-events-none" />

                  {state === "listening" && <WaveBars />}
                  {state === "thinking" && (
                    <Sparkles
                      className="h-10 w-10 text-white"
                      style={{ animation: "spin 2.5s linear infinite" }}
                    />
                  )}
                  {state === "speaking" && <Volume2 className="h-10 w-10 text-white" />}
                  {state === "idle" && <Mic className="h-10 w-10 text-white" />}
                  {state === "error" && <MicOff className="h-10 w-10 text-white opacity-80" />}
                </button>
              </div>

              {/* Status label */}
              <p className={cn(
                "text-sm font-medium transition-all",
                state === "listening" && "text-emerald-600 dark:text-emerald-400",
                state === "thinking" && "text-violet-600 dark:text-violet-400",
                state === "speaking" && "text-blue-600 dark:text-blue-400",
                state === "idle" && "text-zinc-500 dark:text-zinc-400",
                state === "error" && "text-red-500 dark:text-red-400",
              )}>
                {cfg.label}
              </p>

              {/* Transcript bubble */}
              {(transcript || interimTranscript) && (
                <div className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3">
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">You said</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {transcript && <span className="font-medium">{transcript}</span>}
                    {interimTranscript && (
                      <span className="text-zinc-400 italic"> {interimTranscript}</span>
                    )}
                  </p>
                </div>
              )}

              {/* AI response bubble */}
              {response && (
                <div className="w-full rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3 max-h-52 overflow-y-auto">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[9px] font-bold">AI</div>
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Lumina AI</p>
                  </div>
                  <div className="text-zinc-700 dark:text-zinc-300">
                    <FormatResponse text={response} />
                  </div>
                </div>
              )}

              {/* Controls row */}
              <div className="flex gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium border transition-all",
                    muted
                      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  )}
                >
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {muted ? "Voice Off" : "Voice On"}
                </button>

                {response && (state === "idle" || state === "error") && (
                  <button
                    type="button"
                    onClick={startListening}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Ask Again
                  </button>
                )}
              </div>

              <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                Powered by Groq LLaMA · Browser Speech API
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
