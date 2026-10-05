"use client";
import { useState } from "react";

/** Page number that returns to 1 whenever the filters change, without setting state in an effect. */
export function usePage(filterKey: string): [number, (p: number) => void] {
  const [state, setState] = useState({ key: filterKey, page: 1 });
  const page = state.key === filterKey ? state.page : 1;
  return [page, (p) => setState({ key: filterKey, page: p })];
}
