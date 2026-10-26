"use client";
// RateProvider: comparte con toda la app la tasa BCV vigente que devuelve la API
// (la carga el layout en el servidor). VesAmount muestra "≈ Bs. X" con esa tasa.

import { createContext, useContext, type ReactNode } from "react";
import { formatVes } from "@/lib/utils/format";

const RateContext = createContext<number | null>(null);

export function RateProvider({ rate, children }: { rate: number | null; children: ReactNode }) {
  return <RateContext.Provider value={rate}>{children}</RateContext.Provider>;
}

/** Tasa vigente en Bs. por USD, o null si la API no respondió. */
export function useBcvRate(): number | null {
  return useContext(RateContext);
}

/** Equivalente en bolívares de un monto en USD. No muestra nada si no hay tasa. */
export function VesAmount({ usd, className }: { usd: number; className?: string }) {
  const rate = useBcvRate();
  if (rate === null) return null;
  return <p className={className}>≈ {formatVes(usd, rate)}</p>;
}
