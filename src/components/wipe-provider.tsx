"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const WIPE_SECONDS = 3 * 60;

type WipeContextValue = {
  secondsLeft: number | null;
  active: boolean;
  startWipeTimer: () => void;
  clearWipeTimer: () => void;
  markDownloaded: () => void;
};

const WipeContext = createContext<WipeContextValue | null>(null);

export function WipeProvider({ children }: { children: ReactNode }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [active, setActive] = useState(false);

  const clearWipeTimer = useCallback(() => {
    setActive(false);
    setSecondsLeft(null);
  }, []);

  const startWipeTimer = useCallback(() => {
    setActive(true);
    setSecondsLeft(WIPE_SECONDS);
  }, []);

  const markDownloaded = useCallback(() => {
    clearWipeTimer();
  }, [clearWipeTimer]);

  useEffect(() => {
    if (!active || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      clearWipeTimer();
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [active, secondsLeft, clearWipeTimer]);

  const value = useMemo(
    () => ({
      secondsLeft,
      active,
      startWipeTimer,
      clearWipeTimer,
      markDownloaded,
    }),
    [secondsLeft, active, startWipeTimer, clearWipeTimer, markDownloaded]
  );

  return (
    <WipeContext.Provider value={value}>{children}</WipeContext.Provider>
  );
}

export function useWipeTimer() {
  const ctx = useContext(WipeContext);
  if (!ctx) {
    throw new Error("useWipeTimer must be used within WipeProvider");
  }
  return ctx;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
