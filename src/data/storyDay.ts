import { clampToStep, minutesToLabel } from "../utils/time";

const MINUTES_PER_DAY = 24 * 60;
const SAMPLE_STEP_MINUTES = 5;
const SAMPLE_COUNT = MINUTES_PER_DAY / SAMPLE_STEP_MINUTES;
const BATTERY_CAPACITY_KWH = 13.5;
const SOC_START_PCT = 62;

type TimeWindow = {
  startMin: number;
  endMin: number;
};

export type StorySample = {
  // Minutes since midnight for the sample timestamp.
  ts: number;
  solarKw: number;
  homeKw: number;
  batteryKw: number;
  gridKw: number;
  socPct: number;
};

export const storyDayContext = {
  mode: "Time-Based Control",
  backupReservePct: 30,
  peakWindow: {
    startMin: 17 * 60,
    endMin: 21 * 60,
  },
  stormWatchWindow: {
    startMin: 20 * 60 + 30,
    endMin: 21 * 60 + 15,
  },
  stormWatchEnabled: true,
  // Demo-only context that intentionally combines multiple scenarios in one day.
  note: "Synthetic one-day profile for UI demonstration only.",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function gaussian(minute: number, center: number, width: number): number {
  const normalized = (minute - center) / width;
  return Math.exp(-0.5 * normalized * normalized);
}

function deterministicNoise(index: number, seed = 1): number {
  const raw = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return raw - Math.floor(raw) - 0.5;
}

function isInWindow(minute: number, window: TimeWindow): boolean {
  return minute >= window.startMin && minute < window.endMin;
}

function solarKwAt(minute: number, index: number): number {
  const sunriseMin = 7 * 60;
  const sunsetMin = 18 * 60 + 30;

  if (minute < sunriseMin || minute > sunsetMin) {
    return 0;
  }

  const progress = (minute - sunriseMin) / (sunsetMin - sunriseMin);
  const arc = Math.sin(Math.PI * progress);
  const base = 6.4 * Math.pow(Math.max(0, arc), 1.5);
  const cloudDip = 1 - 0.08 * gaussian(minute, 13 * 60, 85);
  const noise = deterministicNoise(index, 11) * 0.2;

  return clamp(base * cloudDip + noise, 0, 7);
}

function homeKwAt(minute: number, index: number): number {
  const baseline = 0.82 + 0.1 * Math.sin((minute / MINUTES_PER_DAY) * Math.PI * 2 - 1.1);
  const morning = 0.82 * gaussian(minute, 8 * 60, 70);
  const midday = 0.32 * gaussian(minute, 12 * 60 + 20, 200);
  const evening = 1.55 * gaussian(minute, 19 * 60, 120);
  const late = 0.24 * gaussian(minute, 22 * 60 + 15, 80);
  const noise = deterministicNoise(index, 23) * 0.12;

  return clamp(baseline + morning + midday + evening + late + noise, 0.55, 3.6);
}

function batteryTargetKw(minute: number, socPct: number, solarKw: number, homeKw: number): number {
  const { peakWindow, stormWatchWindow, stormWatchEnabled, backupReservePct } = storyDayContext;
  const inPeakWindow = isInWindow(minute, peakWindow);
  const inStormWindow = stormWatchEnabled && isInWindow(minute, stormWatchWindow);

  if (inStormWindow) {
    if (socPct < 70) {
      return 2.8;
    }
    if (socPct < 77) {
      return 1.9;
    }
    return 0.9;
  }

  if (inPeakWindow) {
    if (socPct <= backupReservePct + 2) {
      return 0;
    }

    const peakDischargeCap = minute < 19 * 60 ? 2.9 : 1.7;
    const netLoadKw = Math.max(0.25, homeKw - solarKw + 0.25);
    return -Math.min(peakDischargeCap, netLoadKw);
  }

  const solarSurplus = solarKw - homeKw;
  const isSolarChargeWindow = minute >= 9 * 60 && minute < 16 * 60 + 30;
  if (isSolarChargeWindow && solarSurplus > 0.2 && socPct < 94) {
    const chargeFactor = socPct < 88 ? 0.9 : 0.35;
    return Math.min(3.6, solarSurplus * chargeFactor);
  }

  const overnightDischarge = (minute < 5 * 60 || minute >= 22 * 60) && socPct > 56;
  if (overnightDischarge) {
    return -0.2;
  }

  const preDawnDischarge = minute >= 5 * 60 && minute < 7 * 60 && socPct > 54;
  if (preDawnDischarge) {
    return -0.1;
  }

  return 0;
}

function clampBatteryBySoc(targetKw: number, socPct: number): number {
  const reservePct = storyDayContext.backupReservePct;
  const stepHours = SAMPLE_STEP_MINUTES / 60;
  const maxChargeKw = ((100 - socPct) / 100) * BATTERY_CAPACITY_KWH / stepHours;
  const maxDischargeKw = ((socPct - reservePct) / 100) * BATTERY_CAPACITY_KWH / stepHours;

  if (targetKw > 0) {
    return Math.min(targetKw, Math.max(0, maxChargeKw));
  }

  if (targetKw < 0) {
    return -Math.min(Math.abs(targetKw), Math.max(0, maxDischargeKw));
  }

  return 0;
}

function buildStoryDaySamples(): StorySample[] {
  const samples: StorySample[] = [];
  let socPct = SOC_START_PCT;
  const stepHours = SAMPLE_STEP_MINUTES / 60;

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const minute = index * SAMPLE_STEP_MINUTES;
    const solarKw = round(solarKwAt(minute, index), 2);
    const homeKw = round(homeKwAt(minute, index), 2);

    let targetBatteryKw = batteryTargetKw(minute, socPct, solarKw, homeKw);
    if (targetBatteryKw > 0 && !isInWindow(minute, storyDayContext.stormWatchWindow)) {
      const solarOnlyCap = Math.max(0, solarKw - homeKw);
      targetBatteryKw = Math.min(targetBatteryKw, solarOnlyCap);
    }

    const batteryKw = round(clampBatteryBySoc(targetBatteryKw, socPct), 2);
    const gridKw = round(homeKw - solarKw + batteryKw, 2);
    const socDelta = ((batteryKw * stepHours) / BATTERY_CAPACITY_KWH) * 100;
    socPct = clamp(socPct + socDelta, storyDayContext.backupReservePct, 100);

    samples.push({
      ts: minute,
      solarKw,
      homeKw,
      batteryKw,
      gridKw,
      socPct: round(socPct, 1),
    });
  }

  return samples;
}

export const storyDaySamples: StorySample[] = buildStoryDaySamples();

export function formatStoryTime(minute: number): string {
  return minutesToLabel(clampToStep(minute, SAMPLE_STEP_MINUTES));
}

export function getSamplesInWindow(startMin: number, endMin: number): StorySample[] {
  const roundedStart = clamp(clampToStep(startMin, SAMPLE_STEP_MINUTES), 0, MINUTES_PER_DAY);
  const roundedEnd = clamp(clampToStep(endMin, SAMPLE_STEP_MINUTES), 0, MINUTES_PER_DAY);
  const safeStart = Math.min(roundedStart, roundedEnd);
  const safeEnd = Math.max(roundedStart, roundedEnd);

  return storyDaySamples.filter((sample) => sample.ts >= safeStart && sample.ts < safeEnd);
}
