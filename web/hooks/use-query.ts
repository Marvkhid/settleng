"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call after any change so every visible page re-reads the server's numbers. */
export function refreshAll() { listeners.forEach((l) => l()); }

export interface QueryState<T> {
  data: T | undefined; error: ApiError | undefined; loading: boolean; refetch: () => void;
}

interface Result<T> { key: string; data?: T; error?: ApiError }

/**
 * Fetch-on-mount hook: loading, error with retry, and silent refresh after mutations.
 * `loading` is derived (no data for the current inputs yet), so stale data never shows for new filters.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const key = JSON.stringify(deps);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: "" });
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((data) => { if (!cancelled) setResult({ key, data }); })
      .catch((e: unknown) => {
        if (!cancelled) setResult((r) => ({ key, data: r.key === key ? r.data : undefined, error: e instanceof ApiError ? e : new ApiError(0, "Something went wrong. Please try again.") }));
      });
    return () => { cancelled = true; };
  }, [key, tick]);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const refetch = useCallback(() => { setResult((r) => ({ ...r, error: undefined })); setTick((t) => t + 1); }, []);
  const current = result.key === key ? result : undefined;
  return {
    data: current?.data, error: current?.error,
    loading: !current || (current.data === undefined && !current.error), refetch,
  };
}
