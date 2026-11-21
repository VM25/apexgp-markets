import fs from "node:fs";
import path from "node:path";
import { RaceLens } from "../session/lens";
import { newSessionState, TradingSession } from "../session/session";
import type { ModelFile, RaceFile, SeasonFile, SeasonSettlementFile, SettlementFile } from "../types";

const DATA = path.resolve(__dirname, "../../../public/data");
const read = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf8")) as T;

export const model = read<ModelFile>("model.json");
export const season = read<SeasonFile>("2025/season.json");
export const seasonSettlement = read<SeasonSettlementFile>("2025/season.settlement.json");
const pad = (n: number) => String(n).padStart(2, "0");
export const loadRace = (round: number) => read<RaceFile>(`2025/r${pad(round)}.json`);
export const loadSettlement = (round: number) => read<SettlementFile>(`2025/r${pad(round)}.settlement.json`);
export const diagnostics = read<Record<string, any>>("diagnostics.json"); // eslint-disable-line @typescript-eslint/no-explicit-any

export const lensFor = (round: number) => new RaceLens(loadRace(round), model, season.points);

export function sessionAt(round = 1): TradingSession {
  return new TradingSession(newSessionState(2025, round, "test"), lensFor(round), season);
}

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
