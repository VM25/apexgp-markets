import { useState, useEffect, useRef, useCallback } from "react";

export interface Driver {
  code: string;
  name: string;
  team: string;
  number: number;
}

export interface PositionState {
  driver_code: string;
  driver_name: string;
  team: string;
  position: number;
  gap_to_leader: number;
  interval_to_car_ahead: number;
  tires: string;
  tire_age: number;
  pit_stops: number;
  dnf: boolean;
  dnf_reason: string | null;
}

export interface PitStop {
  driver_code: string;
  lap: number;
  duration: number;
  tyre_from: string;
  tyre_to: string;
}

export interface RaceEvent {
  type: string;
  description: string;
  lap: number;
  driver_code?: string;
}

export interface LapState {
  lap_number: number;
  weather: {
    air_temp: number;
    track_temp: number;
    humidity: number;
    rain_probability: number;
  };
  safety_car: string | null;
  positions: PositionState[];
  pit_stops: PitStop[];
  events: RaceEvent[];
  race_control_messages: string[];
}

export interface RaceData {
  race_id: string;
  race_name: string;
  round_number: number;
  circuit: string;
  country: string;
  date: string;
  laps_total: number;
  starting_grid: { driver_code: string; position: number }[];
  final_result: {
    driver_code: string;
    driver_name: string;
    position: number | null;
    dnf: boolean;
    dnf_reason: string | null;
    points: number;
  }[];
  laps: LapState[];
}

export interface Contract {
  id: string;
  type: "WINNER" | "PODIUM" | "FASTEST_LAP" | "SAFETY_CAR" | "DNF" | "H2H" | "FUTURE_DRIVERS" | "FUTURE_CONSTRUCTORS";
  title: string;
  symbol: string;
  target: string;
  mid: number;
  bid: number;
  ask: number;
  prevMid: number;
  change: number;
  explanation: string;
  settled: boolean;
  settlementValue: number | null;
  
  // Quantitative Option Greeks
  delta: number;   // Price sensitivity to state change
  theta: number;   // Time decay of uncertainty per lap completed
  iv: number;      // Implied Volatility index (weather & SC risk)
}

export interface CommentaryHeadline {
  timestamp: string;
  lap: number;
  headline: string;
  impactType: "info" | "gain" | "loss" | "halt" | "settlement";
  impactDetails: string;
}

const DRIVER_TO_TEAM: { [code: string]: string } = {
  VER: "RBR", NOR: "MCL", LEC: "FER", PIA: "MCL", HAM: "FER", RUS: "MER",
  HAD: "VCARB", TSU: "VCARB", ALB: "WIL", ALO: "AST", BOR: "KICK", BEA: "HAAS",
  LAW: "RBR", GAS: "ALP", ANT: "MER", HUL: "KICK", STR: "AST", DOO: "ALP",
  OCO: "HAAS", SAI: "WIL"
};

const RACE_TO_ROUND: { [id: string]: string } = {
  australia: "01", china: "02", japan: "03", bahrain: "04", saudi_arabia: "05",
  miami: "06", imola: "07", monaco: "08", spain: "09", canada: "10",
  austria: "11", great_britain: "12", belgium: "13", hungary: "14", netherlands: "15",
  italy: "16", azerbaijan: "17", singapore: "18", united_states: "19", mexico_city: "20",
  sao_paulo: "21", las_vegas: "22", qatar: "23", abu_dhabi: "24"
};

export function useSimulation(
  driverPoints?: { [code: string]: number },
  constructorPoints?: { [code: string]: number },
  completedRaces?: string[]
) {
  const [selectedRaceId, setSelectedRaceId] = useState<string>("australia");
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [currentLapIdx, setCurrentLapIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(2); // 0.5x, 1x, 2x, 4x, 10x
  const [isHalted, setIsHalted] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<CommentaryHeadline[]>([]);
  const [contracts, setContracts] = useState<{ [id: string]: Contract }>({});
  const [activeTab, setActiveTab] = useState<string>("market");
  const [allRaces, setAllRaces] = useState<any[]>([]);

  // Load season metadata (all 24 races) on mount
  useEffect(() => {
    async function loadSeason() {
      try {
        const res = await fetch("/data/official/season_2025.json");
        if (res.ok) {
          const data = await res.json();
          setAllRaces(data.races || []);
        }
      } catch (err) {
        console.error("Failed to load season metadata:", err);
      }
    }
    loadSeason();
  }, []);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isHaltedTimeoutRef = useRef<boolean>(false);

  // Load selected race data from static JSON
  useEffect(() => {
    async function loadRace() {
      setIsPlaying(false);
      setCurrentLapIdx(0);
      setCommentary([]);
      setIsHalted(false);
      isHaltedTimeoutRef.current = false;
      
      try {
        const roundStr = RACE_TO_ROUND[selectedRaceId] || "01";
        const res = await fetch(`/data/official/round_${roundStr}_${selectedRaceId}.json`);
        if (!res.ok) throw new Error("Race not found");
        const data: RaceData = await res.json();
        setRaceData(data);
        initializeContracts(data, 0);
      } catch (err) {
        console.error("Failed to load race:", err);
      }
    }
    loadRace();
  }, [selectedRaceId]);

  const roundToThree = (num: number) => Math.round(num * 1000) / 1000;

  const normalizeContracts = (contractList: { [id: string]: Contract }, type: string, targetSum: number) => {
    const list = Object.values(contractList).filter(c => c.type === type);
    const currentSum = list.reduce((sum, c) => sum + c.mid, 0);
    if (currentSum === 0) return;
    list.forEach(c => {
      c.mid = roundToThree((c.mid / currentSum) * targetSum);
    });
  };

  // Calculate options greeks
  const calculateGreeks = (mid: number, type: string, lap: number, totalLaps: number, rainProb: number, hasSC: boolean, isLeader: boolean) => {
    const lapsRemaining = totalLaps - lap;
    
    // 1. Delta: options price sensitivity. Peaks around 50% probability
    let delta = roundToThree(mid * (1 - mid) * (type === "WINNER" ? 1.6 : 0.9));
    if (type === "SAFETY_CAR") delta = roundToThree(mid * (1 - mid) * 1.8);
    
    // 2. Theta: time decay of uncertainty.
    // As laps tick down, leading probabilities increase (positive theta), trailing probabilities decay (negative theta)
    let theta = 0;
    if (lapsRemaining > 0) {
      const timeFactor = 1.0 / (lapsRemaining + 1);
      theta = roundToThree((isLeader ? 1 : -1) * mid * (1 - mid) * timeFactor);
    }

    // 3. Implied Volatility (IV): Spikes in high weather uncertainty or safety cars
    let iv = roundToThree(0.18 + (rainProb / 200) + (hasSC ? 0.30 : 0) + (1.0 - lap / (totalLaps || 1)) * 0.25);
    if (type.startsWith("FUTURE")) {
      // Futures have much lower short-term volatility
      iv = roundToThree(0.08 + (1.0 - lap / (totalLaps || 1)) * 0.05);
      delta = roundToThree(mid * (1 - mid) * 0.5);
      theta = roundToThree(-mid * (1 - mid) * 0.005);
    }

    return { delta, theta, iv };
  };

  // Initial pricing (Prior probabilities)
  const initializeContracts = useCallback((data: RaceData, lapIdx: number) => {
    const freshContracts: { [id: string]: Contract } = {};
    const totalLaps = data.laps_total;
    const rain = data.laps[0]?.weather.rain_probability || 0;

    const getRaceAbbrev = (id: string) => {
      switch (id) {
        case "monaco": return "MON";
        case "great_britain": return "SIL";
        case "singapore": return "SIN";
        case "abu_dhabi": return "ABU";
        default: return "GP";
      }
    };
    const rCode = getRaceAbbrev(selectedRaceId);
    
    // 1. Race Winner & Podium
    const gridCount = data.starting_grid.length;
    data.starting_grid.forEach((gridItem) => {
      const driverCode = gridItem.driver_code;
      const pos = gridItem.position;
      const driverInfo = data.laps[0].positions.find(p => p.driver_code === driverCode);
      const name = driverInfo?.driver_name || driverCode;

      // Base WINNER probability based on grid position
      const priorWinner = Math.max(0.01, 1.0 / (pos + 1.2));
      const greeksW = calculateGreeks(priorWinner, "WINNER", 0, totalLaps, rain, false, pos === 1);
      freshContracts[`WINNER_${driverCode}`] = {
        id: `WINNER_${driverCode}`,
        type: "WINNER",
        title: `Winner - ${driverCode}`,
        symbol: `${rCode}-${driverCode}-WIN`,
        target: driverCode,
        mid: priorWinner,
        bid: priorWinner,
        ask: priorWinner,
        prevMid: priorWinner,
        change: 0,
        explanation: `Qualifying grid position prior (P${pos}).`,
        settled: false,
        settlementValue: null,
        ...greeksW
      };

      // Base PODIUM probability
      const priorPodium = Math.min(0.99, Math.max(0.02, 3.0 / (pos + 1.5)));
      const greeksP = calculateGreeks(priorPodium, "PODIUM", 0, totalLaps, rain, false, pos <= 3);
      freshContracts[`PODIUM_${driverCode}`] = {
        id: `PODIUM_${driverCode}`,
        type: "PODIUM",
        title: `Podium - ${driverCode}`,
        symbol: `${rCode}-${driverCode}-POD`,
        target: driverCode,
        mid: priorPodium,
        bid: priorPodium,
        ask: priorPodium,
        prevMid: priorPodium,
        change: 0,
        explanation: `P${pos} grid position podium expectation prior.`,
        settled: false,
        settlementValue: null,
        ...greeksP
      };

      // Base DNF probability
      const priorDnf = 0.08;
      const greeksD = calculateGreeks(priorDnf, "DNF", 0, totalLaps, rain, false, false);
      freshContracts[`DNF_${driverCode}`] = {
        id: `DNF_${driverCode}`,
        type: "DNF",
        title: `Retirement - ${driverCode}`,
        symbol: `${rCode}-${driverCode}-DNF`,
        target: driverCode,
        mid: priorDnf,
        bid: priorDnf,
        ask: priorDnf,
        prevMid: priorDnf,
        change: 0,
        explanation: `Historical baseline driver DNF risk prior.`,
        settled: false,
        settlementValue: null,
        ...greeksD
      };
    });

    // Normalize WINNER probabilities to sum to ~0.95 (market margin)
    normalizeContracts(freshContracts, "WINNER", 0.95);
    normalizeContracts(freshContracts, "PODIUM", 2.85);

    // 2. Safety Car
    const scPrior = selectedRaceId === "monaco" ? 0.65 : (selectedRaceId === "singapore" ? 0.80 : 0.35);
    const greeksSC = calculateGreeks(scPrior, "SAFETY_CAR", 0, totalLaps, rain, false, false);
    freshContracts["SAFETY_CAR_YES"] = {
      id: "SAFETY_CAR_YES",
      type: "SAFETY_CAR",
      title: "Safety Car - YES",
      symbol: `${rCode}-SC-YES`,
      target: "YES",
      mid: scPrior,
      bid: scPrior - 0.02,
      ask: scPrior + 0.02,
      prevMid: scPrior,
      change: 0,
      explanation: `Circuit profile indicates a ${Math.round(scPrior * 100)}% historical occurrence index.`,
      settled: false,
      settlementValue: null,
      ...greeksSC
    };

    // 3. Fastest Lap Contracts (Top 5 grid drivers get prior, others low)
    data.starting_grid.forEach((gridItem) => {
      const driverCode = gridItem.driver_code;
      const pos = gridItem.position;
      const driverInfo = data.laps[0].positions.find(p => p.driver_code === driverCode);
      const name = driverInfo?.driver_name || driverCode;

      const priorFL = pos <= 5 ? (0.25 - pos * 0.03) : 0.02;
      const greeksFL = calculateGreeks(priorFL, "FASTEST_LAP", 0, totalLaps, rain, false, false);
      freshContracts[`FL_${driverCode}`] = {
        id: `FL_${driverCode}`,
        type: "FASTEST_LAP",
        title: `Fastest Lap - ${driverCode}`,
        symbol: `${rCode}-${driverCode}-FL`,
        target: driverCode,
        mid: priorFL,
        bid: priorFL,
        ask: priorFL,
        prevMid: priorFL,
        change: 0,
        explanation: `Car pacing capability baseline calculations.`,
        settled: false,
        settlementValue: null,
        ...greeksFL
      };
    });
    normalizeContracts(freshContracts, "FASTEST_LAP", 0.90);

    // 4. Head-to-Head Matches
    const h2hPairs = [
      { d1: "NOR", d2: "VER", label: "Norris vs Verstappen" },
      { d1: "LEC", d2: "PIA", label: "Leclerc vs Piastri" },
      { d1: "HAM", d2: "RUS", label: "Hamilton vs Russell" }
    ];
    h2hPairs.forEach((pair) => {
      const d1Ex = data.starting_grid.find(g => g.driver_code === pair.d1);
      const d2Ex = data.starting_grid.find(g => g.driver_code === pair.d2);
      if (d1Ex && d2Ex) {
        const diff = d2Ex.position - d1Ex.position;
        const probD1 = Math.min(0.85, Math.max(0.15, 0.5 + diff * 0.05));
        const greeksH = calculateGreeks(probD1, "H2H", 0, totalLaps, rain, false, diff > 0);
        freshContracts[`H2H_${pair.d1}_${pair.d2}`] = {
          id: `H2H_${pair.d1}_${pair.d2}`,
          type: "H2H",
          title: `${pair.d1} beats ${pair.d2}`,
          symbol: `${rCode}-${pair.d1}-${pair.d2}-H2H`,
          target: pair.d1,
          mid: probD1,
          bid: probD1 - 0.02,
          ask: probD1 + 0.02,
          prevMid: probD1,
          change: 0,
          explanation: `Starting grid gap of ${Math.abs(diff)} positions.`,
          settled: false,
          settlementValue: null,
          ...greeksH
        };
      }
    });

    // 5. Championship Futures Initial setup (injected into contracts state)
    const driverFutures = [
      { code: "VER", name: "Max Verstappen", team: "Red Bull Racing", base: 0.44 },
      { code: "NOR", name: "Lando Norris", team: "McLaren", base: 0.38 },
      { code: "LEC", name: "Charles Leclerc", team: "Ferrari", base: 0.12 },
      { code: "PIA", name: "Oscar Piastri", team: "McLaren", base: 0.05 },
      { code: "HAM", name: "Lewis Hamilton", team: "Ferrari", base: 0.01 }
    ];

    const currentRound = data.round_number || 1;
    const completedRoundsCount = currentRound - 1;
    const f = Math.min(1.0, Math.max(0.0, completedRoundsCount / 24));

    const totalDriverPoints: { [code: string]: number } = {};
    const driverCodes = ["VER", "NOR", "LEC", "PIA", "HAM"];
    driverCodes.forEach(code => {
      totalDriverPoints[code] = (driverPoints && driverPoints[code]) || 0;
    });

    const totalTeamPoints: { [code: string]: number } = {};
    const teamCodes = ["MCL", "FER", "RBR", "MER"];
    teamCodes.forEach(code => {
      totalTeamPoints[code] = (constructorPoints && constructorPoints[code]) || 0;
    });

    const sumDriverPts = Object.values(totalDriverPoints).reduce((a, b) => a + b, 0);
    const sumTeamPts = Object.values(totalTeamPoints).reduce((a, b) => a + b, 0);

    driverFutures.forEach(df => {
      const standingWeight = sumDriverPts > 0 ? (totalDriverPoints[df.code] / sumDriverPts) : df.base;
      const initialMid = (1 - f) * df.base + f * standingWeight;
      const clampedMid = Math.max(0.04, Math.min(0.96, roundToThree(initialMid)));

      const greeksF = calculateGreeks(clampedMid, "FUTURE_DRIVERS", 0, totalLaps, rain, false, df.code === "VER");
      freshContracts[`FUTURE_DRIVERS_${df.code}`] = {
        id: `FUTURE_DRIVERS_${df.code}`,
        type: "FUTURE_DRIVERS",
        title: `${df.name} — Drivers Championship`,
        symbol: `FUT-${df.code}-DRV`,
        target: df.code,
        mid: clampedMid,
        bid: clampedMid - 0.02,
        ask: clampedMid + 0.02,
        prevMid: clampedMid,
        change: 0,
        explanation: `Drivers Title futures. Est. points: ${totalDriverPoints[df.code]}. Standing Weight: ${Math.round(standingWeight*100)}%. Season Progress: ${Math.round(f*100)}%.`,
        settled: false,
        settlementValue: null,
        ...greeksF
      };
    });

    const teamFutures = [
      { code: "MCL", name: "McLaren", base: 0.60 },
      { code: "FER", name: "Ferrari", base: 0.28 },
      { code: "RBR", name: "Red Bull Racing", base: 0.10 },
      { code: "MER", name: "Mercedes", base: 0.02 }
    ];

    teamFutures.forEach(tf => {
      const standingWeight = sumTeamPts > 0 ? (totalTeamPoints[tf.code] / sumTeamPts) : tf.base;
      const initialMid = (1 - f) * tf.base + f * standingWeight;
      const clampedMid = Math.max(0.04, Math.min(0.96, roundToThree(initialMid)));

      const greeksF = calculateGreeks(clampedMid, "FUTURE_CONSTRUCTORS", 0, totalLaps, rain, false, tf.code === "MCL");
      freshContracts[`FUTURE_CONSTRUCTORS_${tf.code}`] = {
        id: `FUTURE_CONSTRUCTORS_${tf.code}`,
        type: "FUTURE_CONSTRUCTORS",
        title: `${tf.name} — Constructors Championship`,
        symbol: `FUT-${tf.code}-CON`,
        target: tf.code,
        mid: clampedMid,
        bid: clampedMid - 0.02,
        ask: clampedMid + 0.02,
        prevMid: clampedMid,
        change: 0,
        explanation: `Constructors Title futures. Est. points: ${totalTeamPoints[tf.code]}. Standing Weight: ${Math.round(standingWeight*100)}%. Season Progress: ${Math.round(f*100)}%.`,
        settled: false,
        settlementValue: null,
        ...greeksF
      };
    });

    // Make spreads realistic across all
    Object.keys(freshContracts).forEach(key => {
      const c = freshContracts[key];
      c.bid = Math.max(0.01, roundToThree(c.mid - 0.02));
      c.ask = Math.min(0.99, roundToThree(c.mid + 0.02));
    });

    setContracts(freshContracts);
    
    // Initial commentary headline
    setCommentary([
      {
        timestamp: "14:00:00",
        lap: 0,
        headline: `Race Event: ${data.race_name} loaded with starting grid priors active. ➔ Market Impact: WINNER and PODIUM contract odds initialized. ➔ Portfolio Impact: Risk boundaries set to $100k cash baseline.`,
        impactType: "info",
        impactDetails: "Portfolio values updated."
      }
    ]);
  }, [selectedRaceId, driverPoints, constructorPoints, completedRaces]);

  // Bayesian Pricing Engine for a specific Lap
  const repriceMarketsForLap = useCallback((data: RaceData, lapIdx: number) => {
    if (!data || lapIdx === 0) return;
    
    const lapData = data.laps[lapIdx - 1];
    const totalLaps = data.laps_total;
    const isFinalLap = lapIdx === totalLaps;
    const rain = lapData.weather.rain_probability;
    
    // w is the "information leakage / outcome convergence" factor.
    const w = Math.pow(lapIdx / totalLaps, 1.6); 

    setContracts((prev) => {
      const nextContracts = { ...prev };

      // Get DNF statuses and current position states
      const retiredCodes = new Set(
        lapData.positions.filter(p => p.dnf).map(p => p.driver_code)
      );

      // Track if Safety Car has occurred up to this lap
      let safetyCarHasOccurred = false;
      for (let i = 0; i < lapIdx; i++) {
        const sc = data.laps[i]?.safety_car;
        if (sc && sc !== "NONE" && sc !== "") {
          safetyCarHasOccurred = true;
          break;
        }
      }

      // Safety Car contracts repricing
      const scContract = nextContracts["SAFETY_CAR_YES"];
      if (scContract && !scContract.settled) {
        scContract.prevMid = scContract.mid;
        if (safetyCarHasOccurred) {
          scContract.mid = 1.0;
          scContract.explanation = "Safety Car deployment occurred. Market settled.";
        } else if (isFinalLap) {
          scContract.mid = 0.0;
          scContract.explanation = "Race completed. No Safety Car occurred. Market settled.";
        } else {
          const rainProb = lapData.weather.rain_probability / 100.0;
          scContract.mid = roundToThree(scContract.mid + rainProb * 0.02 + 0.003);
          scContract.explanation = `Laps remaining: ${totalLaps - lapIdx}. Dynamic rainfall factor adds ${Math.round(rainProb * 2)}% risk premium.`;
        }
        
        // Update Greeks
        const gr = calculateGreeks(scContract.mid, "SAFETY_CAR", lapIdx, totalLaps, rain, safetyCarHasOccurred, false);
        scContract.delta = gr.delta;
        scContract.theta = gr.theta;
        scContract.iv = gr.iv;
      }

      // Reprice Winner, Podium, DNF
      data.starting_grid.forEach((gridItem) => {
        const code = gridItem.driver_code;
        const posState = lapData.positions.find(p => p.driver_code === code);
        const finalState = data.final_result.find(r => r.driver_code === code);
        
        if (!posState || !finalState) return;

        // DNF Pricing
        const dnfC = nextContracts[`DNF_${code}`];
        if (dnfC && !dnfC.settled) {
          dnfC.prevMid = dnfC.mid;
          if (posState.dnf) {
            dnfC.mid = 1.0;
            dnfC.explanation = `Driver retired: ${posState.dnf_reason || "Mechanical failure"}.`;
          } else if (isFinalLap) {
            dnfC.mid = 0.0;
            dnfC.explanation = "Driver finished race. Market settled.";
          } else {
            const rainFactor = lapData.weather.rain_probability > 50 ? 0.05 : 0.0;
            dnfC.mid = roundToThree(Math.min(0.95, 0.02 + (posState.tire_age * 0.003) + rainFactor));
            dnfC.explanation = `Tire age: ${posState.tire_age} laps. Wet surface risk: ${rainFactor > 0 ? "Elevated" : "Normal"}.`;
          }
          const gr = calculateGreeks(dnfC.mid, "DNF", lapIdx, totalLaps, rain, safetyCarHasOccurred, false);
          dnfC.delta = gr.delta;
          dnfC.theta = gr.theta;
          dnfC.iv = gr.iv;
        }

        // Winner Pricing
        const winC = nextContracts[`WINNER_${code}`];
        if (winC && !winC.settled) {
          winC.prevMid = winC.mid;
          if (posState.dnf) {
            winC.mid = 0.0;
            winC.explanation = "Driver retired from race. Contract settles at 0.00.";
          } else {
            const currentPos = posState.position;
            const gap = posState.gap_to_leader;
            let stateProb = Math.max(0.001, Math.exp(-0.75 * (currentPos - 1) - 0.15 * gap));
            const actualOut = (finalState.position === 1 && !finalState.dnf) ? 1.0 : 0.0;
            winC.mid = roundToThree((1 - w) * stateProb + w * actualOut);
            
            if (isFinalLap) {
              winC.explanation = actualOut === 1.0 ? "Settles P1 Winner." : "Settles at 0.00.";
            } else {
              winC.explanation = `P${currentPos} | Gap: +${gap}s. Bayesian likelihood blending (L${lapIdx}/${totalLaps}).`;
            }
          }
          const gr = calculateGreeks(winC.mid, "WINNER", lapIdx, totalLaps, rain, safetyCarHasOccurred, posState.position === 1);
          winC.delta = gr.delta;
          winC.theta = gr.theta;
          winC.iv = gr.iv;
        }

        // Podium Pricing
        const podC = nextContracts[`PODIUM_${code}`];
        if (podC && !podC.settled) {
          podC.prevMid = podC.mid;
          if (posState.dnf) {
            podC.mid = 0.0;
            podC.explanation = "Driver retired from race. Contract settles at 0.00.";
          } else {
            const currentPos = posState.position;
            const gap = posState.gap_to_leader;
            
            let stateProb = currentPos <= 3 
              ? Math.max(0.5, 0.95 - (currentPos - 1) * 0.15 - gap * 0.02)
              : Math.max(0.002, 0.4 * Math.exp(-0.4 * (currentPos - 3) - 0.1 * gap));
            
            const actualOut = (finalState.position !== null && finalState.position <= 3 && !finalState.dnf) ? 1.0 : 0.0;
            podC.mid = roundToThree((1 - w) * stateProb + w * actualOut);

            if (isFinalLap) {
              podC.explanation = actualOut === 1.0 ? `Settles P${finalState.position} Podium.` : "Settles at 0.00.";
            } else {
              podC.explanation = `P${currentPos} | Gap: +${gap}s. Blended timeline confidence index.`;
            }
          }
          const gr = calculateGreeks(podC.mid, "PODIUM", lapIdx, totalLaps, rain, safetyCarHasOccurred, posState.position <= 3);
          podC.delta = gr.delta;
          podC.theta = gr.theta;
          podC.iv = gr.iv;
        }
      });

      // Normalize Winner & Podium (non-retired drivers only)
      normalizeContracts(nextContracts, "WINNER", 0.96);
      normalizeContracts(nextContracts, "PODIUM", 2.88);

      // Reprice Fastest Lap
      let lapFLDriver: string | null = null;
      const flEvent = lapData.events.find(e => e.type === "FASTEST_LAP");
      if (flEvent) {
        lapFLDriver = flEvent.driver_code || null;
      }

      data.starting_grid.forEach((gridItem) => {
        const code = gridItem.driver_code;
        const flC = nextContracts[`FL_${code}`];
        if (!flC || flC.settled) return;

        flC.prevMid = flC.mid;
        const posState = lapData.positions.find(p => p.driver_code === code);
        
        const finalFLDriver = data.starting_grid[2]?.driver_code || "HAM";

        if (posState?.dnf) {
          flC.mid = 0.0;
          flC.explanation = "Driver DNF. Out of contention.";
        } else {
          let stateProb = flC.mid;
          if (lapFLDriver === code) {
            stateProb = Math.min(0.85, stateProb + 0.20);
          } else if (posState?.tires === "S" && lapIdx > totalLaps - 10) {
            stateProb = Math.min(0.70, stateProb + 0.15);
          } else {
            stateProb = Math.max(0.01, stateProb * 0.95);
          }

          const actualOut = code === finalFLDriver ? 1.0 : 0.0;
          flC.mid = roundToThree((1 - w) * stateProb + w * actualOut);
          flC.explanation = `Active tires: ${posState?.tires || "M"}. Speed indicators. Blended confidence: ${Math.round(flC.mid * 100)}%.`;
        }
        
        const gr = calculateGreeks(flC.mid, "FASTEST_LAP", lapIdx, totalLaps, rain, safetyCarHasOccurred, false);
        flC.delta = gr.delta;
        flC.theta = gr.theta;
        flC.iv = gr.iv;
      });
      normalizeContracts(nextContracts, "FASTEST_LAP", 0.92);

      // Reprice H2H
      Object.keys(nextContracts).forEach((key) => {
        const c = nextContracts[key];
        if (c.type !== "H2H" || c.settled) return;

        c.prevMid = c.mid;
        const drivers = key.substring(4).split("_");
        const d1 = drivers[0];
        const d2 = drivers[1];

        const d1State = lapData.positions.find(p => p.driver_code === d1);
        const d2State = lapData.positions.find(p => p.driver_code === d2);
        
        const d1Final = data.final_result.find(r => r.driver_code === d1);
        const d2Final = data.final_result.find(r => r.driver_code === d2);

        if (d1State && d2State && d1Final && d2Final) {
          if (d1State.dnf && d2State.dnf) {
            c.mid = d1Final.position !== null && d2Final.position !== null && d1Final.position < d2Final.position ? 1.0 : 0.0;
          } else if (d1State.dnf) {
            c.mid = 0.0;
          } else if (d2State.dnf) {
            c.mid = 1.0;
          } else {
            const gapDiff = d2State.gap_to_leader - d1State.gap_to_leader;
            let stateProb = Math.min(0.98, Math.max(0.02, 0.5 + gapDiff * 0.08));
            const d1IsWinner = d1Final.dnf === false && (d2Final.dnf || (d1Final.position !== null && d2Final.position !== null && d1Final.position < d2Final.position));
            const actualOut = d1IsWinner ? 1.0 : 0.0;
            c.mid = roundToThree((1 - w) * stateProb + w * actualOut);
          }
          c.explanation = `Matchup telemetry. converges to outcome at final lap.`;
          
          const gr = calculateGreeks(c.mid, "H2H", lapIdx, totalLaps, rain, safetyCarHasOccurred, d1State.position < d2State.position);
          c.delta = gr.delta;
          c.theta = gr.theta;
          c.iv = gr.iv;
        }
      });

      // 6. Dynamic Championship Futures Repricing
      const isAbuDhabi = data.race_id === "abu_dhabi";
      const isAbuDhabiSettled = isAbuDhabi && isFinalLap;
      
      const completedRacesCount = completedRaces ? completedRaces.length : 0;
      const progressFraction = (completedRacesCount + (lapIdx / totalLaps)) / 24;
      const f = Math.min(1.0, Math.max(0.0, progressFraction));

      const getF1Points = (pos: number): number => {
        switch (pos) {
          case 1: return 25;
          case 2: return 18;
          case 3: return 15;
          case 4: return 12;
          case 5: return 10;
          case 6: return 8;
          case 7: return 6;
          case 8: return 4;
          case 9: return 2;
          case 10: return 1;
          default: return 0;
        }
      };

      const livePositions = lapData.positions || [];

      // Calculate total live points for drivers
      const totalDriverPoints: { [code: string]: number } = {};
      const driverCodes = ["VER", "NOR", "LEC", "PIA", "HAM"];
      driverCodes.forEach(code => {
        const prevPoints = (driverPoints && driverPoints[code]) || 0;
        const livePos = livePositions.find(p => p.driver_code === code);
        const livePts = livePos && !livePos.dnf ? getF1Points(livePos.position) : 0;
        totalDriverPoints[code] = prevPoints + livePts;
      });

      // Calculate total live points for constructor teams
      const totalTeamPoints: { [code: string]: number } = {};
      const teamCodes = ["MCL", "FER", "RBR", "MER"];
      teamCodes.forEach(code => {
        const prevPoints = (constructorPoints && constructorPoints[code]) || 0;
        let livePts = 0;
        livePositions.forEach(p => {
          const t = DRIVER_TO_TEAM[p.driver_code];
          if (t === code && !p.dnf) {
            livePts += getF1Points(p.position);
          }
        });
        totalTeamPoints[code] = prevPoints + livePts;
      });

      const sumDriverPts = Object.values(totalDriverPoints).reduce((a, b) => a + b, 0);
      const sumTeamPts = Object.values(totalTeamPoints).reduce((a, b) => a + b, 0);

      // Drivers Futures Repricing
      const dfList = [
        { code: "VER", name: "Max Verstappen", team: "Red Bull Racing", base: 0.44 },
        { code: "NOR", name: "Lando Norris", team: "McLaren", base: 0.38 },
        { code: "LEC", name: "Charles Leclerc", team: "Ferrari", base: 0.12 },
        { code: "PIA", name: "Oscar Piastri", team: "McLaren", base: 0.05 },
        { code: "HAM", name: "Lewis Hamilton", team: "Ferrari", base: 0.01 }
      ];

      dfList.forEach(df => {
        const c = nextContracts[`FUTURE_DRIVERS_${df.code}`];
        if (c && !c.settled) {
          c.prevMid = c.mid;
          
          if (isAbuDhabiSettled) {
            let winnerCode = "VER";
            let maxPts = -1;
            Object.keys(totalDriverPoints).forEach(code => {
              if (totalDriverPoints[code] > maxPts) {
                maxPts = totalDriverPoints[code];
                winnerCode = code;
              }
            });

            const resolvedVal = df.code === winnerCode ? 1.0 : 0.0;
            c.mid = resolvedVal;
            c.settled = true;
            c.settlementValue = resolvedVal;
            c.explanation = `Drivers Championship settled. Winner: ${df.name} (${winnerCode}) with ${totalDriverPoints[winnerCode]} pts.`;
          } else {
            const standingWeight = sumDriverPts > 0 ? (totalDriverPoints[df.code] / sumDriverPts) : df.base;
            let targetMid = (1 - f) * df.base + f * standingWeight;
            
            c.title = `${df.name} — Drivers Championship`;
            
            // Apply minimum pricing floor ($0.04) and spread logic before Abu Dhabi completes
            c.mid = Math.max(0.04, Math.min(0.96, roundToThree(targetMid)));
            c.explanation = `Drivers Title futures. Est. points: ${totalDriverPoints[df.code]}. Standing Weight: ${Math.round(standingWeight*100)}%. Season Progress: ${Math.round(f*100)}%.`;
          }
          
          const gr = calculateGreeks(c.mid, "FUTURE_DRIVERS", lapIdx, totalLaps, rain, safetyCarHasOccurred, df.code === "VER");
          c.delta = gr.delta;
          c.theta = gr.theta;
          c.iv = gr.iv;
        }
      });

      // Constructors Futures Repricing
      const tfList = [
        { code: "MCL", name: "McLaren", base: 0.60 },
        { code: "FER", name: "Ferrari", base: 0.28 },
        { code: "RBR", name: "Red Bull Racing", base: 0.10 },
        { code: "MER", name: "Mercedes", base: 0.02 }
      ];

      tfList.forEach(tf => {
        const c = nextContracts[`FUTURE_CONSTRUCTORS_${tf.code}`];
        if (c && !c.settled) {
          c.prevMid = c.mid;
          
          if (isAbuDhabiSettled) {
            let winnerCode = "MCL";
            let maxPts = -1;
            Object.keys(totalTeamPoints).forEach(code => {
              if (totalTeamPoints[code] > maxPts) {
                maxPts = totalTeamPoints[code];
                winnerCode = code;
              }
            });

            const resolvedVal = tf.code === winnerCode ? 1.0 : 0.0;
            c.mid = resolvedVal;
            c.settled = true;
            c.settlementValue = resolvedVal;
            c.explanation = `Constructors Championship settled. Winner: ${tf.name} (${winnerCode}) with ${totalTeamPoints[winnerCode]} pts.`;
          } else {
            const standingWeight = sumTeamPts > 0 ? (totalTeamPoints[tf.code] / sumTeamPts) : tf.base;
            let targetMid = (1 - f) * tf.base + f * standingWeight;
            
            c.title = `${tf.name} — Constructors Championship`;
            
            c.mid = Math.max(0.04, Math.min(0.96, roundToThree(targetMid)));
            c.explanation = `Constructors Title futures. Est. points: ${totalTeamPoints[tf.code]}. Standing Weight: ${Math.round(standingWeight*100)}%. Season Progress: ${Math.round(f*100)}%.`;
          }
          
          const gr = calculateGreeks(c.mid, "FUTURE_CONSTRUCTORS", lapIdx, totalLaps, rain, safetyCarHasOccurred, tf.code === "MCL");
          c.delta = gr.delta;
          c.theta = gr.theta;
          c.iv = gr.iv;
        }
      });

      // Clamp values and re-calculate Bid/Ask spreads
      Object.keys(nextContracts).forEach((key) => {
        const c = nextContracts[key];
        
        // Handle settlement if it's the final lap
        if (isFinalLap && !c.settled) {
          c.settled = true;
          let settledVal = 0.0;
          if (c.type === "WINNER") {
            const res = data.final_result.find(r => r.driver_code === c.target);
            settledVal = res && res.position === 1 && !res.dnf ? 1.0 : 0.0;
          } else if (c.type === "PODIUM") {
            const res = data.final_result.find(r => r.driver_code === c.target);
            settledVal = res && res.position !== null && res.position <= 3 && !res.dnf ? 1.0 : 0.0;
          } else if (c.type === "FASTEST_LAP") {
            const finalFL = data.starting_grid[2]?.driver_code || "HAM";
            settledVal = c.target === finalFL ? 1.0 : 0.0;
          } else if (c.type === "SAFETY_CAR") {
            settledVal = safetyCarHasOccurred ? 1.0 : 0.0;
          } else if (c.type === "DNF") {
            const res = data.final_result.find(r => r.driver_code === c.target);
            settledVal = res?.dnf ? 1.0 : 0.0;
          } else if (c.type === "H2H") {
            const drivers = key.substring(4).split("_");
            const d1 = drivers[0];
            const d2 = drivers[1];
            const d1F = data.final_result.find(r => r.driver_code === d1);
            const d2F = data.final_result.find(r => r.driver_code === d2);
            if (d1F && d2F) {
              const d1IsWinner = d1F.dnf === false && (d2F.dnf || (d1F.position !== null && d2F.position !== null && d1F.position < d2F.position));
              settledVal = d1IsWinner ? 1.0 : 0.0;
            }
          }
          c.mid = settledVal;
          c.bid = settledVal;
          c.ask = settledVal;
          c.settlementValue = settledVal;
          c.change = roundToThree(c.mid - c.prevMid);
          return;
        }

        // Clamp mid to 0.01 - 0.99 (unless settled)
        if (!c.settled) {
          c.mid = Math.max(0.01, Math.min(0.99, roundToThree(c.mid)));
          c.bid = Math.max(0.01, roundToThree(c.mid - 0.02));
          c.ask = Math.min(0.99, roundToThree(c.mid + 0.02));
        } else {
          c.bid = c.mid;
          c.ask = c.mid;
        }
        c.change = roundToThree(c.mid - c.prevMid);
      });

      return nextContracts;
    });

    // Append commentary and handle halts
    let eventHappened = false;
    let messageString = "";
    let impactType: "info" | "gain" | "loss" | "halt" | "settlement" = "info";

    if (lapData.safety_car && lapData.safety_car !== "NONE" && lapData.safety_car !== "") {
      eventHappened = true;
      impactType = "halt";
      messageString = `Race Event: Safety Car Deployed (${lapData.safety_car}). Field bunched. ➔ Market Impact: SAFETY_CAR_YES contract repriced to $1.00; spreads frozen. ➔ Portfolio Impact: Risk boundaries and active positions locked for validation.`;
      setIsHalted(true);
      isHaltedTimeoutRef.current = true;
      
      setTimeout(() => {
        setIsHalted(false);
        isHaltedTimeoutRef.current = false;
      }, 3500);
    }

    const dnfEvent = lapData.events.find(e => e.type === "DNF");
    if (dnfEvent) {
      eventHappened = true;
      impactType = "halt";
      messageString = `Race Event: Driver retirement (DNF) confirmed - ${dnfEvent.description}. ➔ Market Impact: DNF contract resolves to $1.00; WINNER contract devalued to $0.00. ➔ Portfolio Impact: F1 options chain risk-hedges and exposures recalculated.`;
      setIsHalted(true);
      isHaltedTimeoutRef.current = true;
      
      setTimeout(() => {
        setIsHalted(false);
        isHaltedTimeoutRef.current = false;
      }, 2500);
    }

    const overtakeEvent = lapData.events.find(e => e.type === "OVERTAKE");
    if (overtakeEvent && !eventHappened) {
      eventHappened = true;
      impactType = "info";
      messageString = `Race Event: Lead Change - ${overtakeEvent.description}. ➔ Market Impact: Implied WINNER and PODIUM probabilities adjust to track changes. ➔ Portfolio Impact: MTM portfolio value and net delta/theta exposure updated.`;
    }

    if (!eventHappened) {
      const p1 = lapData.positions.find(p => p.position === 1);
      const p2 = lapData.positions.find(p => p.position === 2);
      messageString = `Race Event: Lap ${lapIdx} completed. ${p1?.driver_code} leading ${p2?.driver_code} (+${p2?.gap_to_leader}s). ➔ Market Impact: Bayesian likelihood model updates option mid/ask/bid prices. ➔ Portfolio Impact: Live unrealized PnL and cash flows repriced mark-to-market.`;
    }

    if (isFinalLap) {
      impactType = "settlement";
      messageString = `Race Event: Checkered Flag. Race completed. ➔ Market Impact: Option contracts resolved to deterministic outcomes ($1.00 or $0.00). ➔ Portfolio Impact: Open liabilities cleared; realized cash credited to sandbox account.`;
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];

    setCommentary((prev) => [
      {
        timestamp: timeStr,
        lap: lapIdx,
        headline: messageString,
        impactType,
        impactDetails: isFinalLap ? "Positions settled." : (lapData.safety_car ? "Halt active" : "Prices recalculated")
      },
      ...prev
    ]);

  }, [selectedRaceId, isPlaying, driverPoints, constructorPoints, completedRaces]);

  // Replay tick timer
  useEffect(() => {
    if (!isPlaying || !raceData) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalTime = Math.max(100, 2000 / speed);

    timerRef.current = setInterval(() => {
      if (isHaltedTimeoutRef.current) {
        return;
      }

      setCurrentLapIdx((prev) => {
        const next = prev + 1;
        if (next > raceData.laps_total) {
          setIsPlaying(false);
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        
        repriceMarketsForLap(raceData, next);
        return next;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, raceData, repriceMarketsForLap]);

  // Play / Pause controls
  const handlePlayPause = () => {
    if (raceData && currentLapIdx >= raceData.laps_total) {
      setCurrentLapIdx(0);
      initializeContracts(raceData, 0);
      setCommentary([]);
    }
    setIsPlaying(prev => !prev);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
  };

  const handleInstantReplay = () => {
    if (!raceData) return;
    setIsPlaying(false);
    setIsHalted(false);
    isHaltedTimeoutRef.current = false;
    
    for (let l = 1; l <= raceData.laps_total; l++) {
      repriceMarketsForLap(raceData, l);
    }
    setCurrentLapIdx(raceData.laps_total);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentLapIdx(0);
    setIsHalted(false);
    isHaltedTimeoutRef.current = false;
    if (raceData) {
      initializeContracts(raceData, 0);
    }
    setCommentary([]);
  };

  return {
    selectedRaceId,
    setSelectedRaceId,
    raceData,
    currentLapIdx,
    isPlaying,
    speed,
    isHalted,
    commentary,
    contracts,
    setContracts,
    activeTab,
    setActiveTab,
    allRaces,
    handlePlayPause,
    handleSpeedChange,
    handleInstantReplay,
    handleReset
  };
}
