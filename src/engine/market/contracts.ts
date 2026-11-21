/**
 * Contract catalogue, fair values and settlement rules.
 *
 * Every contract is a binary claim: one YES contract pays $1.00 if the stated
 * event is true in the official classification and $0.00 otherwise. A NO
 * contract is the exact complement (YES + NO = $1.00 at settlement).
 */
import { h2hOutcome, headToHead, type RaceForecast, type RaceRandoms } from "../model/forecast";
import type { TitleContext, TitleForecast } from "../model/title";
import type { RaceFile, SeasonSettlementFile, SettlementFile } from "../types";

export type ContractKind = "WIN" | "POD" | "PTS" | "DNF" | "H2H" | "WDC" | "WCC";

export interface Contract {
  id: string;
  kind: ContractKind;
  scope: "race" | "season";
  season: number;
  raceId: string | null;
  /** Driver id (or constructor id for WCC). */
  subject: string;
  /** Second driver for H2H. */
  versus: string | null;
  /** Index into race.drivers for race contracts (and WDC entrants); -1 otherwise. */
  index: number;
  versusIndex: number;
  code: string;
  title: string;
  question: string;
}

export const KIND_META: Record<ContractKind, { label: string; plural: string; group: string; rule: string }> = {
  WIN: {
    label: "Race winner",
    plural: "Winner",
    group: "exclusive",
    rule: "Pays $1.00 if the driver is classified first in the official race classification. A driver disqualified after the race is not the winner.",
  },
  POD: {
    label: "Podium finish",
    plural: "Podium",
    group: "top3",
    rule: "Pays $1.00 if the driver is classified first, second or third in the official race classification.",
  },
  PTS: {
    label: "Points finish",
    plural: "Points",
    group: "top10",
    rule: "Pays $1.00 if the driver is classified in the top ten of the official race classification.",
  },
  DNF: {
    label: "Not classified",
    plural: "Not classified",
    group: "independent",
    rule: "Pays $1.00 if the driver has no numeric finishing position in the official classification: retired, disqualified or did not start.",
  },
  H2H: {
    label: "Team-mate head-to-head",
    plural: "Head-to-head",
    group: "pair",
    rule: "Pays $1.00 if the first-named driver is listed ahead of the team-mate in the official results order, which ranks unclassified cars by distance covered and disqualified cars last.",
  },
  WDC: {
    label: "Drivers' champion",
    plural: "Drivers' title",
    group: "exclusive",
    rule: "Pays $1.00 if the driver leads the final official drivers' standings of the season. Settles after the last round.",
  },
  WCC: {
    label: "Constructors' champion",
    plural: "Constructors' title",
    group: "exclusive",
    rule: "Pays $1.00 if the constructor leads the final official constructors' standings of the season. Settles after the last round.",
  },
};

export const RACE_KINDS: ContractKind[] = ["WIN", "POD", "PTS", "DNF", "H2H"];
export const SEASON_KINDS: ContractKind[] = ["WDC", "WCC"];

export function raceContracts(race: RaceFile): Contract[] {
  const out: Contract[] = [];
  const base = { scope: "race" as const, season: race.season, raceId: race.id, versus: null, versusIndex: -1 };
  race.drivers.forEach((d, i) => {
    out.push({ ...base, id: `${race.id}:WIN:${d.id}`, kind: "WIN", subject: d.id, index: i, code: d.code, title: `${d.name} to win`, question: `Will ${d.name} win the ${race.name}?` });
    out.push({ ...base, id: `${race.id}:POD:${d.id}`, kind: "POD", subject: d.id, index: i, code: d.code, title: `${d.name} on the podium`, question: `Will ${d.name} finish in the top three of the ${race.name}?` });
    out.push({ ...base, id: `${race.id}:PTS:${d.id}`, kind: "PTS", subject: d.id, index: i, code: d.code, title: `${d.name} in the points`, question: `Will ${d.name} finish in the top ten of the ${race.name}?` });
    out.push({ ...base, id: `${race.id}:DNF:${d.id}`, kind: "DNF", subject: d.id, index: i, code: d.code, title: `${d.name} not classified`, question: `Will ${d.name} fail to be classified in the ${race.name}?` });
  });
  // Team-mate pairs: teams with exactly two entrants; the car with the better grid slot is named first.
  const byTeam = new Map<string, number[]>();
  race.drivers.forEach((d, i) => byTeam.set(d.team, [...(byTeam.get(d.team) ?? []), i]));
  for (const members of byTeam.values()) {
    if (members.length !== 2) continue;
    const [a, b] = members[0] < members[1] ? members : [members[1], members[0]];
    const da = race.drivers[a];
    const db = race.drivers[b];
    out.push({
      ...base,
      id: `${race.id}:H2H:${da.id}:${db.id}`,
      kind: "H2H",
      subject: da.id,
      versus: db.id,
      index: a,
      versusIndex: b,
      code: `${da.code}>${db.code}`,
      title: `${da.name} ahead of ${db.name}`,
      question: `Will ${da.name} be classified ahead of team-mate ${db.name} in the ${race.name}?`,
    });
  }
  return out;
}

export function seasonContracts(race: RaceFile, ctx: TitleContext): Contract[] {
  const out: Contract[] = [];
  const meta = new Map(race.standings.drivers.map((d) => [d.id, d]));
  const entrant = new Map(race.drivers.map((d, i) => [d.id, { d, i }]));
  ctx.driverIds.forEach((id) => {
    const e = entrant.get(id);
    const name = e?.d.name ?? meta.get(id)?.name ?? id;
    const code = e?.d.code ?? meta.get(id)?.code ?? id.slice(0, 3).toUpperCase();
    out.push({
      id: `${race.season}:WDC:${id}`, kind: "WDC", scope: "season", season: race.season, raceId: null, subject: id, versus: null,
      index: e?.i ?? -1, versusIndex: -1, code, title: `${name} — drivers' title`, question: `Will ${name} be the ${race.season} World Drivers' Champion?`,
    });
  });
  const teamName = new Map<string, string>([...race.standings.constructors.map((t) => [t.id, t.name] as const), ...race.teams.map((t) => [t.id, t.name] as const)]);
  ctx.teamIds.forEach((id) => {
    const name = teamName.get(id) ?? id;
    out.push({
      id: `${race.season}:WCC:${id}`, kind: "WCC", scope: "season", season: race.season, raceId: null, subject: id, versus: null,
      index: -1, versusIndex: -1, code: name.slice(0, 3).toUpperCase(), title: `${name} — constructors' title`,
      question: `Will ${name} be the ${race.season} World Constructors' Champion?`,
    });
  });
  return out;
}

/** Model-estimated probability that the contract resolves YES. */
export function fairValue(c: Contract, fc: RaceForecast, rnd: RaceRandoms, ctx: TitleContext | null, title: TitleForecast | null): number {
  switch (c.kind) {
    case "WIN":
      return fc.win[c.index];
    case "POD":
      return fc.podium[c.index];
    case "PTS":
      return fc.points[c.index];
    case "DNF":
      return fc.nc[c.index];
    case "H2H":
      return headToHead(fc, rnd, c.index, c.versusIndex);
    case "WDC":
      return ctx && title ? title.driver[ctx.driverIds.indexOf(c.subject)] ?? 0 : 0;
    case "WCC":
      return ctx && title ? title.team[ctx.teamIds.indexOf(c.subject)] ?? 0 : 0;
  }
}

/** Payoff of a YES contract in simulated scenario m (used for joint portfolio risk). */
export function scenarioPayoff(c: Contract, m: number, fc: RaceForecast, rnd: RaceRandoms, ctx: TitleContext | null, title: TitleForecast | null): 0 | 1 {
  const p = c.index >= 0 ? fc.placed[m * fc.D + c.index] : 0;
  switch (c.kind) {
    case "WIN":
      return p === 1 ? 1 : 0;
    case "POD":
      return p >= 1 && p <= 3 ? 1 : 0;
    case "PTS":
      return p >= 1 && p <= 10 ? 1 : 0;
    case "DNF":
      return p === 0 ? 1 : 0;
    case "H2H":
      return h2hOutcome(fc, rnd, m, c.index, c.versusIndex);
    case "WDC":
      return ctx && title && m < ctx.sims && ctx.driverIds[title.champDriver[m]] === c.subject ? 1 : 0;
    case "WCC":
      return ctx && title && m < ctx.sims && ctx.teamIds[title.champTeam[m]] === c.subject ? 1 : 0;
  }
}

/** Official settlement of a race contract. Returns null when the subject is not in the classification. */
export function settleRaceContract(c: Contract, s: SettlementFile): 0 | 1 | null {
  const row = s.classification.find((r) => r.id === c.subject);
  if (!row) return null;
  switch (c.kind) {
    case "WIN":
      return row.classified && row.position === 1 ? 1 : 0;
    case "POD":
      return row.classified && row.position !== null && row.position <= 3 ? 1 : 0;
    case "PTS":
      return row.classified && row.position !== null && row.position <= 10 ? 1 : 0;
    case "DNF":
      return row.classified ? 0 : 1;
    case "H2H": {
      const other = s.classification.find((r) => r.id === c.versus);
      if (!other) return null;
      return row.order < other.order ? 1 : 0;
    }
    default:
      return null;
  }
}

export function settleSeasonContract(c: Contract, s: SeasonSettlementFile): 0 | 1 | null {
  if (c.kind === "WDC") return s.champion.driver.id === c.subject ? 1 : 0;
  if (c.kind === "WCC") return s.champion.constructor.id === c.subject ? 1 : 0;
  return null;
}
