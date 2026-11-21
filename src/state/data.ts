/** Static data loaders. Every file is fetched at most once per page load. */
import type { CircuitFile, ModelFile, RaceFile, SeasonFile, SeasonSettlementFile, SettlementFile } from "@/engine/types";

const cache = new Map<string, Promise<unknown>>();

export class DataError extends Error {
  constructor(public path: string, public status: number | null) {
    super(status ? `Could not load ${path} (HTTP ${status}).` : `Could not load ${path}. Check your connection and try again.`);
  }
}

export function getJSON<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = fetch(`/data/${path}`)
    .then((res) => {
      if (!res.ok) throw new DataError(path, res.status);
      return res.json() as Promise<T>;
    })
    .catch((err) => {
      cache.delete(path);
      throw err instanceof DataError ? err : new DataError(path, null);
    });
  cache.set(path, p);
  return p;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const loadSeason = (season: number) => getJSON<SeasonFile>(`${season}/season.json`);
export const loadSeasonSettlement = (season: number) => getJSON<SeasonSettlementFile>(`${season}/season.settlement.json`);
export const loadRace = (season: number, round: number) => getJSON<RaceFile>(`${season}/r${pad(round)}.json`);
export const loadSettlement = (season: number, round: number) => getJSON<SettlementFile>(`${season}/r${pad(round)}.settlement.json`);
export const loadModel = () => getJSON<ModelFile>("model.json");
export const loadCircuit = (id: string) => getJSON<CircuitFile>(`circuits/${id}.json`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadDiagnostics = () => getJSON<any>("diagnostics.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadProvenance = () => getJSON<any>("provenance.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadMarketReference = () => getJSON<any>("market_reference.json");

export const SEASON = 2025;
