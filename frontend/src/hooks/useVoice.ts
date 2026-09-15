"use client";

import { useCallback, useEffect } from "react";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Narrator voice with the browser's own speech synthesis (free, offline, no API calls). */
export function useVoice(enabled: boolean) {
  useEffect(() => {
    if (!supported()) return;
    if (!enabled) window.speechSynthesis.cancel();
    return () => window.speechSynthesis.cancel();
  }, [enabled]);

  return useCallback(
    (markdown: string) => {
      if (!enabled || !supported()) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(markdown.replace(/[*_#>`]/g, ""));
      utterance.lang = "es-ES";
      const voices = synth.getVoices();
      const voice = voices.find((v) => v.lang.startsWith("es") && /natural|google|online/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("es"));
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.pitch = 0.95;
      synth.speak(utterance);
    },
    [enabled],
  );
}
