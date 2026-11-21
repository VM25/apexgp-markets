/**
 * Data contracts between the offline pipeline (pipeline/build.py) and the app.
 * Observation files never contain settlement labels; settlement files are
 * fetched separately, and only when a race is being settled or reviewed.
 */

export type TrackStatus = "GREEN" | "YELLOW" | "VSC" | "SC" | "RED";
export type TyreCode = "S" | "M" | "H" | "I" | "W";

export interface DriverEntry {
  id: string;
  code: string;
  number: number;
  name: string;
  team: string;
  teamName: string;
  color: string | null;
}

export interface TeamEntry {
  id: string;
  name: string;
  color: string | null;
}

export interface StandingDriver {
  id: string;
  code: string;
  name: string;
  team: string;
  points: number;
  wins: number;
}

export interface StandingTeam {
  id: string;
  name: string;
  color: string | null;
  points: number;
  wins: number;
}

export interface Standings {
  drivers: StandingDriver[];
  constructors: StandingTeam[];
}

export interface RaceEventItem {
  type:
    | "SC" | "VSC" | "SC_END" | "VSC_END" | "RED" | "FLAG" | "PENALTY" | "INCIDENT" | "WEATHER"
    | "LEAD" | "PIT" | "OUT" | "BACK" | "FASTEST";
  text: string;
  d?: number;
}

export interface WeatherSample {
  air: number | null;
  track: number | null;
  rain: boolean;
  humidity: number | null;
  wind: number | null;
}

export interface Frames {
  n: number;
  /** Information cutoff of each frame, seconds on the race clock. */
  t: number[];
  status: TrackStatus[];
  laps: number[][];
  pos: number[][];
  gap: number[][];
  pits: number[][];
  down: number[][];
  stopped: number[][];
  tyre: (TyreCode | null)[][];
  tyreAge: (number | null)[][];
  lastLap: (number | null)[][];
  weather: (WeatherSample | null)[];
  events: RaceEventItem[][];
}

export interface CircuitInfo {
  id: string;
  name: string;
  locality: string;
  country: string;
}

export interface RaceFile {
  schema: 3;
  id: string;
  season: number;
  round: number;
  name: string;
  circuit: CircuitInfo;
  date: string;
  timeUtc: string | null;
  startUtc: number | null;
  sprintWeekend: boolean;
  /** Race distance in laps. Frames run 0..laps. */
  laps: number;
  /** Entrants in (grid slot, id) order — array position carries no outcome information. */
  drivers: DriverEntry[];
  grid: number[];
  startRank: number[];
  teams: TeamEntry[];
  ratings: { dform: number[]; tform: number[]; dnc: number[]; tnc: number[]; fieldNc: number };
  /** Championship standings entering this grand prix (includes this weekend's sprint, if any). */
  standings: Standings;
  calendar: { roundsTotal: number; gpsLeft: number; sprintsLeft: number };
  frames: Frames;
  quality: Record<string, unknown>;
  sources: Record<string, string | null>;
}

export interface ClassificationRow {
  id: string;
  /** Official results order, 1 = winner. Ranks every entrant, classified or not. */
  order: number;
  position: number | null;
  text: string;
  classified: boolean;
  status: string;
  points: number;
  laps: number;
  grid: number;
  time: string | null;
}

export interface SettlementFile {
  schema: 3;
  id: string;
  season: number;
  round: number;
  classification: ClassificationRow[];
  sprint: { id: string; team: string; position: number | null; text: string; points: number }[] | null;
  standingsAfter: Standings;
  fastestLap: { driver: string; number: number; lap: number; time: string } | null;
  notes: string[];
  source: string;
}

export interface SeasonRound {
  id: string;
  season: number;
  round: number;
  name: string;
  circuit: CircuitInfo;
  date: string;
  timeUtc: string | null;
  sprintWeekend: boolean;
  laps: number;
  entrants: number;
}

export interface SeasonFile {
  schema: 3;
  season: number;
  status: "complete" | "in_progress";
  roundsTotal: number;
  rounds: SeasonRound[];
  calendar: { round: number; name: string; date: string; sprintWeekend: boolean; hasData: boolean }[];
  points: { race: number[]; sprint: number[]; fastestLapPoint: boolean };
  builtUtc: string;
}

export interface SeasonSettlementFile {
  schema: 3;
  season: number;
  finalStandings: Standings;
  champion: { driver: StandingDriver; constructor: StandingTeam };
  source: string;
}

export interface ModelFile {
  schema: 3;
  builtUtc: string;
  training: { first_season: number; last_season: number; races: number; snapshots: number; driver_snapshots: number };
  features: {
    order: string[];
    hazard: string[];
    inRaceOnly: string[];
    knots: number[];
    seasonOrder: string[];
    seasonHazard: string[];
  };
  constants: { gapCap: number; rateCap: number; leadCap: number; pitLossS: number };
  stageGroup: number[];
  stages: number;
  /** beta[group][feature][basis] */
  order: { beta: number[][][] };
  hazard: { w: number[]; stoppedNc: { early: number; late: number } };
  /** beta[group][feature] for the ratings-only model used for races not yet qualified. */
  season: { beta: number[][]; hazardW: number[] };
}

export interface CircuitFile {
  id: string;
  /** Polyline in a unit box, sampled at a constant time step around one reference lap. */
  points: [number, number][];
  lapSeconds: number;
  source: string;
  note: string;
}
