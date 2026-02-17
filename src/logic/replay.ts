import { StorySample } from "../data/storyDay";
import { ExplainContext, getWindowSamples, summarizeWindow } from "./explainEngine";

const STEP_HOURS = 5 / 60;
const BATTERY_CAPACITY_KWH = 13.5;
const MAX_CHARGE_KW = 5;
const MAX_DISCHARGE_KW = 5;
const STORM_TARGET_SOC_PCT = 85;

export type ReplayMode = "Time-Based Control" | "Self-Powered";

export type ReplayOverrides = {
  backupReservePct?: number;
  mode?: ReplayMode;
  peakStartMin?: number;
};

export type ReplaySummary = {
  startSoc: number;
  endSoc: number;
  totalGridImportKwhApprox: number;
  totalGridExportKwhApprox: number;
  totalBatteryChargeKwhApprox: number;
  totalBatteryDischargeKwhApprox: number;
};

export type ReplayResult = {
  actual: ReplaySummary;
  replay: ReplaySummary;
  deltas: {
    endSocPct: number;
    gridImportKwh: number;
    batteryDischargeKwh: number;
  };
  modeUsed: ReplayMode;
  reserveUsed: number;
};

type RunningTotals = {
  gridImport: number;
  gridExport: number;
  batteryCharge: number;
  batteryDischarge: number;
};

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeEnergyBounds(socPct: number, reservePct: number): { maxChargeKw: number; maxDischargeKw: number } {
  const maxChargeKwh = ((100 - socPct) / 100) * BATTERY_CAPACITY_KWH;
  const maxDischargeKwh = ((socPct - reservePct) / 100) * BATTERY_CAPACITY_KWH;
  return {
    maxChargeKw: Math.max(0, maxChargeKwh / STEP_HOURS),
    maxDischargeKw: Math.max(0, maxDischargeKwh / STEP_HOURS),
  };
}

function applyEnergyStep(
  batteryKw: number,
  solarKw: number,
  homeKw: number,
  socPct: number,
  reservePct: number,
): { nextSocPct: number; gridKw: number; batteryKw: number } {
  const boundedBatteryKw = clamp(batteryKw, -MAX_DISCHARGE_KW, MAX_CHARGE_KW);
  const deltaSocPct = ((boundedBatteryKw * STEP_HOURS) / BATTERY_CAPACITY_KWH) * 100;
  const nextSocPct = clamp(socPct + deltaSocPct, reservePct, 100);
  const gridKw = homeKw - solarKw + boundedBatteryKw;

  return {
    nextSocPct,
    gridKw,
    batteryKw: boundedBatteryKw,
  };
}

function accumulateTotals(totals: RunningTotals, batteryKw: number, gridKw: number): RunningTotals {
  return {
    gridImport: totals.gridImport + Math.max(gridKw, 0) * STEP_HOURS,
    gridExport: totals.gridExport + Math.max(-gridKw, 0) * STEP_HOURS,
    batteryCharge: totals.batteryCharge + Math.max(batteryKw, 0) * STEP_HOURS,
    batteryDischarge: totals.batteryDischarge + Math.max(-batteryKw, 0) * STEP_HOURS,
  };
}

function simulateSelfPoweredStep(
  sample: StorySample,
  socPct: number,
  reservePct: number,
): { nextSocPct: number; gridKw: number; batteryKw: number } {
  const netSolarKw = sample.solarKw - sample.homeKw;
  const bounds = computeEnergyBounds(socPct, reservePct);
  let batteryKw = 0;

  if (netSolarKw > 0 && socPct < 100) {
    batteryKw = Math.min(netSolarKw, MAX_CHARGE_KW, bounds.maxChargeKw);
  } else if (netSolarKw < 0 && socPct > reservePct) {
    const deficitKw = Math.abs(netSolarKw);
    batteryKw = -Math.min(deficitKw, MAX_DISCHARGE_KW, bounds.maxDischargeKw);
  }

  return applyEnergyStep(batteryKw, sample.solarKw, sample.homeKw, socPct, reservePct);
}

function simulateTimeBasedStep(
  sample: StorySample,
  context: ExplainContext,
  socPct: number,
  reservePct: number,
  peakStartMin: number,
): { nextSocPct: number; gridKw: number; batteryKw: number } {
  const inPeak =
    sample.ts >= peakStartMin && sample.ts < context.peakWindow.endMin;
  const inStorm =
    context.stormWatchEnabled &&
    sample.ts >= context.stormWatchWindow.startMin &&
    sample.ts < context.stormWatchWindow.endMin;

  const bounds = computeEnergyBounds(socPct, reservePct);
  const deficitKw = Math.max(0, sample.homeKw - sample.solarKw);
  let batteryKw = 0;

  if (inPeak && socPct > reservePct) {
    batteryKw = -Math.min(deficitKw + 0.35, MAX_DISCHARGE_KW, bounds.maxDischargeKw);
  } else if (inStorm && socPct < Math.max(reservePct, STORM_TARGET_SOC_PCT)) {
    const desiredChargeKw = Math.max(0, deficitKw + 2.2);
    batteryKw = Math.min(desiredChargeKw, MAX_CHARGE_KW, bounds.maxChargeKw);
  } else {
    return simulateSelfPoweredStep(sample, socPct, reservePct);
  }

  return applyEnergyStep(batteryKw, sample.solarKw, sample.homeKw, socPct, reservePct);
}

function finalizeSummary(
  startSoc: number,
  endSoc: number,
  totals: RunningTotals,
): ReplaySummary {
  return {
    startSoc: round(startSoc, 1),
    endSoc: round(endSoc, 1),
    totalGridImportKwhApprox: round(totals.gridImport, 2),
    totalGridExportKwhApprox: round(totals.gridExport, 2),
    totalBatteryChargeKwhApprox: round(totals.batteryCharge, 2),
    totalBatteryDischargeKwhApprox: round(totals.batteryDischarge, 2),
  };
}

export function replayWindow(
  samplesAll: StorySample[],
  context: ExplainContext,
  startMin: number,
  endMin: number,
  overrides: ReplayOverrides,
): ReplayResult {
  const windowSamples = getWindowSamples(samplesAll, startMin, endMin);
  const actualSummary = summarizeWindow(windowSamples, context);

  const modeUsed: ReplayMode = overrides.mode ?? (context.mode as ReplayMode);
  const reserveUsed = overrides.backupReservePct ?? context.backupReservePct;
  const peakStartMin = overrides.peakStartMin ?? context.peakWindow.startMin;

  if (windowSamples.length === 0) {
    const empty: ReplaySummary = {
      startSoc: 0,
      endSoc: 0,
      totalGridImportKwhApprox: 0,
      totalGridExportKwhApprox: 0,
      totalBatteryChargeKwhApprox: 0,
      totalBatteryDischargeKwhApprox: 0,
    };
    return {
      actual: empty,
      replay: empty,
      deltas: {
        endSocPct: 0,
        gridImportKwh: 0,
        batteryDischargeKwh: 0,
      },
      modeUsed,
      reserveUsed,
    };
  }

  let socPct = windowSamples[0].socPct;
  const replayStartSoc = socPct;
  let totals: RunningTotals = {
    gridImport: 0,
    gridExport: 0,
    batteryCharge: 0,
    batteryDischarge: 0,
  };

  for (const sample of windowSamples) {
    const step =
      modeUsed === "Self-Powered"
        ? simulateSelfPoweredStep(sample, socPct, reserveUsed)
        : simulateTimeBasedStep(sample, context, socPct, reserveUsed, peakStartMin);

    socPct = step.nextSocPct;
    totals = accumulateTotals(totals, step.batteryKw, step.gridKw);
  }

  const replaySummary = finalizeSummary(replayStartSoc, socPct, totals);

  return {
    actual: {
      startSoc: actualSummary.startSoc,
      endSoc: actualSummary.endSoc,
      totalGridImportKwhApprox: actualSummary.totalGridImportKwhApprox,
      totalGridExportKwhApprox: actualSummary.totalGridExportKwhApprox,
      totalBatteryChargeKwhApprox: actualSummary.totalBatteryChargeKwhApprox,
      totalBatteryDischargeKwhApprox: actualSummary.totalBatteryDischargeKwhApprox,
    },
    replay: replaySummary,
    deltas: {
      endSocPct: round(replaySummary.endSoc - actualSummary.endSoc, 1),
      gridImportKwh: round(
        replaySummary.totalGridImportKwhApprox - actualSummary.totalGridImportKwhApprox,
        2,
      ),
      batteryDischargeKwh: round(
        replaySummary.totalBatteryDischargeKwhApprox - actualSummary.totalBatteryDischargeKwhApprox,
        2,
      ),
    },
    modeUsed,
    reserveUsed,
  };
}
