"use client";

import { useSyncExternalStore } from "react";

/** Compare list (up to 3 phone codes), kept in this browser only. */
const KEY = "sm_compare";
const EVENT = "sm-compare-change";
export const COMPARE_MAX = 3;
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string" && /^[A-Z]{2}-\d{3,6}$/.test(c)).slice(0, COMPARE_MAX)
      : EMPTY;
    return cachedValue;
  } catch {
    return EMPTY;
  }
}

function write(codes: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(codes.slice(0, COMPARE_MAX)));
  } catch {
    // Storage can be blocked (private mode); the tray just won't remember.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCompare() {
  const codes = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    codes,
    has: (code: string) => codes.includes(code),
    /** Returns false when the list is already full. */
    toggle: (code: string) => {
      const current = read();
      if (current.includes(code)) {
        write(current.filter((c) => c !== code));
        return true;
      }
      if (current.length >= COMPARE_MAX) return false;
      write([...current, code]);
      return true;
    },
    remove: (code: string) => write(read().filter((c) => c !== code)),
    set: (list: string[]) => write(list),
    clear: () => write([]),
  };
}
