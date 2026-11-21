/**
 * Application store: owns the trading session, the playback clock and a little
 * UI state, and persists the session to localStorage. Framework-free; React
 * subscribes through useSyncExternalStore (see hooks.ts).
 */
import type { Action, Side } from "@/engine/market/execution";
import { RaceLens } from "@/engine/session/lens";
import { isValidState, newSessionState, TradingSession, type OrderRequest, type OrderResult, type SessionState, type SettlementRecord } from "@/engine/session/session";
import type { ModelFile, SeasonFile, SettlementFile } from "@/engine/types";
import { loadModel, loadRace, loadSeason, loadSeasonSettlement, loadSettlement, SEASON } from "./data";

const KEY = "apexgp.v3.session";
const ARCHIVE_KEY = "apexgp.v3.archive";
export const SPEEDS = [
  { label: "1×", ms: 1600 },
  { label: "2×", ms: 800 },
  { label: "5×", ms: 320 },
  { label: "15×", ms: 110 },
] as const;

export interface Toast {
  id: number;
  tone: "info" | "good" | "bad";
  title: string;
  body?: string;
}

export interface ArchivedSession {
  id: string;
  endedAt: string;
  startRound: number;
  lastRound: number;
  nav: number;
  fills: number;
}

export interface SettlementView {
  round: number;
  raceName: string;
  records: SettlementRecord[];
  settlement: SettlementFile;
  navBefore: number;
  navAfter: number;
  seasonSettled: boolean;
}

export interface ReviewState {
  lens: RaceLens;
  frame: number;
  settlement: SettlementFile | null;
}

export interface TicketState {
  open: boolean;
  contractId: string | null;
  side: Side;
  action: Action;
}

type Status = "boot" | "ready" | "error";

class AppStore {
  status: Status = "boot";
  error: string | null = null;
  busy: string | null = null;
  season: SeasonFile | null = null;
  model: ModelFile | null = null;
  session: TradingSession | null = null;
  playing = false;
  speed = 1;
  selected: string | null = null;
  ticket: TicketState = { open: false, contractId: null, side: "YES", action: "BUY" };
  toasts: Toast[] = [];
  settlementView: SettlementView | null = null;
  review: ReviewState | null = null;
  restored = false;
  storageOk = true;

  private version = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private booted = false;
  private toastId = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  getServerVersion = () => 0;

  private emit(persist = true) {
    this.version++;
    for (const fn of this.listeners) fn();
    if (persist) this.scheduleSave();
  }

  // ------------------------------------------------------------ boot / persistence
  async boot() {
    if (this.booted) return;
    this.booted = true;
    try {
      const [season, model] = await Promise.all([loadSeason(SEASON), loadModel()]);
      this.season = season;
      this.model = model;
      const saved = this.readSaved();
      if (saved && season.rounds.some((r) => r.round === saved.round)) {
        this.busy = "Restoring your session";
        this.emit(false);
        const lens = await this.makeLens(saved.round, saved.frame);
        this.session = new TradingSession(saved, lens, season);
        this.restored = true;
      } else {
        const first = season.rounds[0].round;
        const lens = await this.makeLens(first, 0);
        this.session = new TradingSession(newSessionState(season.season, first, this.newId()), lens, season);
      }
      this.selected = this.defaultContract();
      this.busy = null;
      this.status = "ready";
      this.emit();
    } catch (err) {
      this.status = "error";
      this.busy = null;
      this.error = err instanceof Error ? err.message : "Something went wrong while loading the data.";
      this.emit(false);
    }
  }

  retry() {
    this.booted = false;
    this.status = "boot";
    this.error = null;
    this.emit(false);
    void this.boot();
  }

  private newId() {
    return `s${Date.now().toString(36)}`;
  }

  private readSaved(): SessionState | null {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isValidState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private scheduleSave() {
    if (!this.session) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  }

  saveNow() {
    if (!this.session) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.session.state));
      this.storageOk = true;
    } catch {
      this.storageOk = false;
    }
  }

  /** Build a lens and compute its frames in small slices so the page stays responsive. */
  private async makeLens(round: number, throughFrame: number): Promise<RaceLens> {
    const race = await loadRace(this.season!.season, round);
    const lens = new RaceLens(race, this.model!, this.season!.points);
    await this.ensureChunked(lens, throughFrame);
    return lens;
  }

  private async ensureChunked(lens: RaceLens, frame: number) {
    const target = Math.min(frame, lens.totalFrames - 1);
    while (lens.computedThrough < target) {
      lens.ensure(Math.min(target, lens.computedThrough + 6));
      await new Promise((r) => setTimeout(r, 0));
    }
    lens.ensure(target);
  }

  private defaultContract(): string | null {
    const s = this.session;
    if (!s) return null;
    const wins = s.lens.contracts.filter((c) => c.kind === "WIN");
    const fair = s.lens.fairAt(s.state.frame);
    let best = wins[0];
    for (const c of wins) if (fair[s.lens.indexOf.get(c.id)!] > fair[s.lens.indexOf.get(best.id)!]) best = c;
    return best?.id ?? null;
  }

  // ------------------------------------------------------------ clock
  step() {
    const s = this.session;
    if (!s || !s.canAdvance()) return false;
    s.advance();
    if (!s.canAdvance()) this.stopTimer();
    this.emit();
    return true;
  }

  play() {
    const s = this.session;
    if (!s || !s.canAdvance() || this.busy) return;
    this.playing = true;
    this.startTimer();
    this.emit(false);
  }

  pause() {
    this.stopTimer();
    this.emit(false);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  setSpeed(i: number) {
    this.speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
    if (this.playing) this.startTimer();
    this.emit(false);
  }

  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.step()) this.stopTimer();
    }, SPEEDS[this.speed].ms);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.playing) {
      this.playing = false;
      this.emit(false);
    }
  }

  /** Run the clock forward to the chequered flag, frame by frame (resting orders are evaluated on every frame). */
  async runToFlag() {
    const s = this.session;
    if (!s || this.busy) return;
    this.stopTimer();
    this.busy = "Running to the chequered flag";
    this.emit(false);
    let n = 0;
    while (s.canAdvance()) {
      s.advance();
      if (++n % 5 === 0) {
        this.emit(false);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    this.busy = null;
    this.emit();
  }

  async settle() {
    const s = this.session;
    if (!s || s.state.phase !== "flag" || this.busy) return;
    this.busy = "Fetching the official classification";
    this.emit(false);
    try {
      const settlement = await loadSettlement(s.state.season, s.state.round);
      const isLast = s.nextRound() === null && this.season!.status === "complete";
      const seasonSettlement = isLast ? await loadSeasonSettlement(s.state.season) : null;
      const navBefore = s.nav();
      const records = s.settleRace(settlement, seasonSettlement);
      this.settlementView = { round: s.state.round, raceName: s.lens.race.name, records, settlement, navBefore, navAfter: s.nav(), seasonSettled: s.state.seasonSettled };
      this.busy = null;
      this.emit();
      this.saveNow();
    } catch (err) {
      this.busy = null;
      this.toast("bad", "Settlement data could not be loaded", err instanceof Error ? err.message : undefined);
    }
  }

  dismissSettlement() {
    this.settlementView = null;
    this.emit(false);
  }

  async nextRound() {
    const s = this.session;
    if (!s || s.state.phase !== "settled" || this.busy) return;
    const next = s.nextRound();
    if (next === null) return;
    this.busy = "Opening the next round";
    this.settlementView = null;
    this.emit(false);
    try {
      const lens = await this.makeLens(next, 0);
      s.openRound(lens);
      this.selected = this.defaultContract();
      this.ticket = { ...this.ticket, open: false, contractId: null };
      this.busy = null;
      this.emit();
      this.saveNow();
    } catch (err) {
      this.busy = null;
      this.toast("bad", "The next round could not be loaded", err instanceof Error ? err.message : undefined);
    }
  }

  // ------------------------------------------------------------ trading
  place(req: OrderRequest): OrderResult | null {
    const s = this.session;
    if (!s) return null;
    const r = s.place(req);
    if (r.ok) {
      const c = r.contract!;
      const parts: string[] = [];
      if (r.filled > 0) parts.push(`${r.filled.toLocaleString("en-US")} filled at ${r.avgPrice.toFixed(1)}¢`);
      if (r.rests) parts.push(`${r.remaining.toLocaleString("en-US")} resting`);
      this.toast("good", `${req.action === "BUY" ? "Bought" : "Sold"} ${req.side} · ${c.title}`, parts.join(" · "));
    }
    this.emit();
    return r;
  }

  cancel(orderId: string) {
    if (this.session?.cancel(orderId)) {
      this.toast("info", "Resting order cancelled");
      this.emit();
    }
  }

  select(contractId: string | null) {
    this.selected = contractId;
    this.emit(false);
  }

  openTicket(contractId: string, side: Side = "YES", action: Action = "BUY") {
    this.selected = contractId;
    this.ticket = { open: true, contractId, side, action };
    this.emit(false);
  }

  setTicket(patch: Partial<TicketState>) {
    this.ticket = { ...this.ticket, ...patch };
    this.emit(false);
  }

  closeTicket() {
    this.ticket = { ...this.ticket, open: false };
    this.emit(false);
  }

  // ------------------------------------------------------------ sessions
  archives(): ArchivedSession[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(ARCHIVE_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as ArchivedSession[]) : [];
    } catch {
      return [];
    }
  }

  async newSession(startRound: number) {
    if (!this.season || !this.model || this.busy) return;
    this.stopTimer();
    const old = this.session;
    if (old && old.state.fills.length > 0) {
      const entry: ArchivedSession = {
        id: old.state.id, endedAt: new Date().toISOString(), startRound: old.state.startRound, lastRound: old.state.round,
        nav: Math.round(old.nav()), fills: old.state.fills.length,
      };
      try {
        window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify([entry, ...this.archives()].slice(0, 8)));
      } catch {
        /* storage unavailable: the archive is a convenience only */
      }
    }
    this.busy = "Opening a new session";
    this.settlementView = null;
    this.emit(false);
    try {
      const lens = await this.makeLens(startRound, 0);
      this.session = new TradingSession(newSessionState(this.season.season, startRound, this.newId()), lens, this.season);
      this.selected = this.defaultContract();
      this.ticket = { open: false, contractId: null, side: "YES", action: "BUY" };
      this.restored = false;
      this.busy = null;
      this.emit();
      this.saveNow();
      this.toast("info", "New session opened", `$100,000.00 at round ${startRound}.`);
    } catch (err) {
      this.busy = null;
      this.toast("bad", "Could not open the session", err instanceof Error ? err.message : undefined);
    }
  }

  exportSession(): string {
    return JSON.stringify(this.session?.state ?? null, null, 2);
  }

  // ------------------------------------------------------------ review (read-only)
  async openReview(round: number) {
    if (!this.season || !this.model) return;
    this.stopTimer();
    this.busy = "Loading the race for review";
    this.emit(false);
    try {
      const lens = await this.makeLens(round, 0);
      this.review = { lens, frame: 0, settlement: null };
      this.busy = null;
      this.emit(false);
      void this.ensureChunked(lens, lens.totalFrames - 1).then(() => this.emit(false));
    } catch (err) {
      this.busy = null;
      this.toast("bad", "That race could not be loaded", err instanceof Error ? err.message : undefined);
    }
  }

  setReviewFrame(frame: number) {
    if (!this.review) return;
    const f = Math.max(0, Math.min(this.review.lens.totalFrames - 1, frame));
    this.review.lens.ensure(f);
    this.review = { ...this.review, frame: f };
    this.emit(false);
  }

  async revealReviewResult() {
    if (!this.review) return;
    const race = this.review.lens.race;
    try {
      const settlement = await loadSettlement(race.season, race.round);
      if (this.review) this.review = { ...this.review, settlement };
      this.emit(false);
    } catch (err) {
      this.toast("bad", "The classification could not be loaded", err instanceof Error ? err.message : undefined);
    }
  }

  closeReview() {
    this.review = null;
    this.emit(false);
  }

  // ------------------------------------------------------------ toasts
  toast(tone: Toast["tone"], title: string, body?: string) {
    const id = ++this.toastId;
    this.toasts = [...this.toasts.slice(-2), { id, tone, title, body }];
    this.emit(false);
    setTimeout(() => this.dismissToast(id), 5200);
  }

  dismissToast(id: number) {
    if (!this.toasts.some((t) => t.id === id)) return;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit(false);
  }
}

export const store = new AppStore();
export type { AppStore };
