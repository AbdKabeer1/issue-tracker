"use client";

import { useSyncExternalStore, useState, useMemo, useCallback, useRef } from "react";
import {
  deserializeDraft,
  saveDraftToStorage,
  removeDraftFromStorage,
} from "@/lib/form-drafts";

export interface UseFormDraftOptions {
  debounceMs?: number;
  enabled?: boolean;
}

const emptySubscribe = () => () => {};

export function useFormDraft<T extends Record<string, unknown>>(
  key: string | null,
  initialValues: T,
  options?: UseFormDraftOptions,
) {
  const debounceMs = options?.debounceMs ?? 500;
  const enabled = options?.enabled ?? true;

  const [overrides, setOverrides] = useState<Partial<T>>({});
  const [isDiscarded, setIsDiscarded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overridesRef = useRef<Partial<T>>({});

  // useSyncExternalStore safely reads localStorage on the client without SSR hydration mismatches
  const rawDraft = useSyncExternalStore(
    emptySubscribe,
    () => {
      if (typeof window === "undefined" || !key || !enabled) return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const restoredDraft = useMemo(() => {
    if (isDiscarded || !rawDraft) return null;
    return deserializeDraft<T>(rawDraft);
  }, [isDiscarded, rawDraft]);

  const isRestored = Boolean(restoredDraft);

  const values = useMemo<T>(() => {
    return {
      ...initialValues,
      ...(isDiscarded ? {} : restoredDraft),
      ...overrides,
    };
  }, [initialValues, isDiscarded, restoredDraft, overrides]);

  const setValue = useCallback(
    <K extends keyof T>(field: K, val: T[K]) => {
      const nextOverrides = { ...overridesRef.current, [field]: val };
      overridesRef.current = nextOverrides;
      setOverrides(nextOverrides);

      if (key && enabled) {
        if (timerRef.current) clearTimeout(timerRef.current);
        const merged: T = {
          ...initialValues,
          ...(isDiscarded ? {} : restoredDraft),
          ...nextOverrides,
        };
        timerRef.current = setTimeout(() => {
          saveDraftToStorage(key, merged);
        }, debounceMs);
      }
    },
    [debounceMs, enabled, initialValues, isDiscarded, key, restoredDraft],
  );

  const setValues = useCallback(
    (newValues: Partial<T> | ((prev: T) => T)) => {
      const currentMerged: T = {
        ...initialValues,
        ...(isDiscarded ? {} : restoredDraft),
        ...overridesRef.current,
      };
      const nextPartial =
        typeof newValues === "function" ? newValues(currentMerged) : newValues;
      const nextOverrides = { ...overridesRef.current, ...nextPartial };
      overridesRef.current = nextOverrides;
      setOverrides(nextOverrides);

      if (key && enabled) {
        if (timerRef.current) clearTimeout(timerRef.current);
        const merged: T = { ...currentMerged, ...nextPartial };
        timerRef.current = setTimeout(() => {
          saveDraftToStorage(key, merged);
        }, debounceMs);
      }
    },
    [debounceMs, enabled, initialValues, isDiscarded, key, restoredDraft],
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (key) {
      removeDraftFromStorage(key);
    }
    setIsDiscarded(true);
    overridesRef.current = {};
    setOverrides({});
  }, [key]);

  const discardDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (key) {
      removeDraftFromStorage(key);
    }
    setIsDiscarded(true);
    overridesRef.current = {};
    setOverrides({});
  }, [key]);

  return {
    values,
    setValue,
    setValues,
    isRestored,
    clearDraft,
    discardDraft,
  };
}
