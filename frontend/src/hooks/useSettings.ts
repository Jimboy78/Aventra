"use client";

import { useCallback, useEffect, useState } from "react";

export interface Settings {
  model: string;
  images: boolean;
  voice: boolean;
}

const STORAGE_KEY = "aventra.settings";
export const DEFAULT_SETTINGS: Settings = { model: "gpt-4.1-mini", images: true, voice: false };

function read(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(read()), []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage blocked: keep the setting for this page only
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
