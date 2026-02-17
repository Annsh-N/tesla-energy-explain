import { StorySample } from "../data/storyDay";
import { formatWindow, minutesToLabel } from "../utils/time";

const STEP_HOURS = 5 / 60;
const MAX_EVENTS = 10;

export type ExplainEventType = "mode" | "rate" | "battery" | "grid" | "storm" | "solar" | "info";

export type ReasonCode =
  | "TBC_PEAK_AVOIDANCE"
  | "SOLAR_SURPLUS_CHARGE"
  | "BACKUP_RESERVE_PROTECTION"
  | "STORM_WATCH_PRECHARGE"
  | "EXPORTING_SURPLUS"
  | "HOLDING_CHARGE";

export type ExplainReason = {
  code: ReasonCode;
  title: string;
  confidence: "High" | "Medium" | "Low";
  evidence: string[];
};

export type ExplainEvent = {
  id: string;
  tsMin: number;
  title: string;
  type: ExplainEventType;
  whatHappened: string;
  reasons: ExplainReason[];
};

export type ExplainSummary = {
  startSoc: number;
  endSoc: number;
  minSoc: number;
  maxSoc: number;
  totalGridImportKwhApprox: number;
  totalGridExportKwhApprox: number;
  totalBatteryChargeKwhApprox: number;
  totalBatteryDischargeKwhApprox: number;
};

export type ExplainContext = {
  mode: string;
  backupReservePct: number;
  peakWindow: {
    startMin: number;
    endMin: number;
  };
  stormWatchWindow: {
    startMin: number;
    endMin: number;
  };
  stormWatchEnabled: boolean;
};

type BaseReason = {
  title: string;
  confidence: "High" | "Medium" | "Low";
};

const reasonCatalog: Record<ReasonCode, BaseReason> = {
  TBC_PEAK_AVOIDANCE: {
    title: "Peak avoidance in Time-Based Control",
    confidence: "High",
  },
  SOLAR_SURPLUS_CHARGE: {
    title: "Charging from solar surplus",
    confidence: "High",
  },
  BACKUP_RESERVE_PROTECTION: {
    title: "Reserve protection near backup threshold",
    confidence: "Medium",
  },
  STORM_WATCH_PRECHARGE: {
    title: "Storm Watch pre-charge behavior",
    confidence: "High",
  },
  EXPORTING_SURPLUS: {
    title: "Exporting excess energy",
    confidence: "Medium",
  },
  HOLDING_CHARGE: {
    title: "Holding battery level",
    confidence: "Low",
  },
};

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function overlapsWindow(
  startMin: number,
  endMin: number,
  window: { startMin: number; endMin: number },
): { overlaps: boolean; start: number; end: number } {
  const overlapStart = Math.max(startMin, window.startMin);
  const overlapEnd = Math.min(endMin, window.endMin);
  return {
    overlaps: overlapStart < overlapEnd,
    start: overlapStart,
    end: overlapEnd,
  };
}

function average(samples: StorySample[], picker: (sample: StorySample) => number): number {
  if (samples.length === 0) {
    return 0;
  }
  return samples.reduce((sum, sample) => sum + picker(sample), 0) / samples.length;
}

function buildReason(code: ReasonCode, evidence: string[], confidence?: "High" | "Medium" | "Low"): ExplainReason {
  const base = reasonCatalog[code];
  return {
    code,
    title: base.title,
    confidence: confidence ?? base.confidence,
    evidence: evidence.slice(0, 3),
  };
}

function findFirstSample(
  samples: StorySample[],
  predicate: (sample: StorySample) => boolean,
  fallbackMin: number,
): number {
  const match = samples.find(predicate);
  return match ? match.ts : fallbackMin;
}

function hasConsecutiveGridExport(samples: StorySample[], minRunLength = 3): number | null {
  let run = 0;
  let runStart: number | null = null;

  for (const sample of samples) {
    if (sample.gridKw < -0.6) {
      run += 1;
      if (runStart === null) {
        runStart = sample.ts;
      }
      if (run >= minRunLength) {
        return runStart;
      }
    } else {
      run = 0;
      runStart = null;
    }
  }

  return null;
}

function ensureUniqueTimestamp(
  proposedTs: number,
  usedTs: Set<number>,
  startMin: number,
  endMin: number,
): number {
  const upperBound = Math.max(startMin, endMin - 5);
  let ts = clamp(proposedTs, startMin, upperBound);

  while (usedTs.has(ts) && ts <= upperBound) {
    ts += 5;
  }
  while (usedTs.has(ts) && ts >= startMin) {
    ts -= 5;
  }

  return clamp(ts, startMin, upperBound);
}

export function getWindowSamples(samples: StorySample[], startMin: number, endMin: number): StorySample[] {
  const safeStart = Math.min(startMin, endMin);
  const safeEnd = Math.max(startMin, endMin);
  return samples.filter((sample) => sample.ts >= safeStart && sample.ts < safeEnd);
}

export function summarizeWindow(samples: StorySample[], _context: ExplainContext): ExplainSummary {
  if (samples.length === 0) {
    return {
      startSoc: 0,
      endSoc: 0,
      minSoc: 0,
      maxSoc: 0,
      totalGridImportKwhApprox: 0,
      totalGridExportKwhApprox: 0,
      totalBatteryChargeKwhApprox: 0,
      totalBatteryDischargeKwhApprox: 0,
    };
  }

  let gridImport = 0;
  let gridExport = 0;
  let batteryCharge = 0;
  let batteryDischarge = 0;
  let minSoc = Number.POSITIVE_INFINITY;
  let maxSoc = Number.NEGATIVE_INFINITY;

  for (const sample of samples) {
    gridImport += Math.max(sample.gridKw, 0) * STEP_HOURS;
    gridExport += Math.max(-sample.gridKw, 0) * STEP_HOURS;
    batteryCharge += Math.max(sample.batteryKw, 0) * STEP_HOURS;
    batteryDischarge += Math.max(-sample.batteryKw, 0) * STEP_HOURS;
    minSoc = Math.min(minSoc, sample.socPct);
    maxSoc = Math.max(maxSoc, sample.socPct);
  }

  return {
    startSoc: round(samples[0].socPct, 1),
    endSoc: round(samples[samples.length - 1].socPct, 1),
    minSoc: round(minSoc, 1),
    maxSoc: round(maxSoc, 1),
    totalGridImportKwhApprox: round(gridImport, 2),
    totalGridExportKwhApprox: round(gridExport, 2),
    totalBatteryChargeKwhApprox: round(batteryCharge, 2),
    totalBatteryDischargeKwhApprox: round(batteryDischarge, 2),
  };
}

export function buildExplainTimeline(
  samplesAll: StorySample[],
  context: ExplainContext,
  startMin: number,
  endMin: number,
): ExplainEvent[] {
  const windowSamples = getWindowSamples(samplesAll, startMin, endMin);
  if (windowSamples.length === 0) {
    return [];
  }

  const summary = summarizeWindow(windowSamples, context);
  const avgBatteryKw = average(windowSamples, (sample) => sample.batteryKw);
  const avgSolarKw = average(windowSamples, (sample) => sample.solarKw);
  const avgHomeKw = average(windowSamples, (sample) => sample.homeKw);
  const peakOverlap = overlapsWindow(startMin, endMin, context.peakWindow);
  const stormOverlap = overlapsWindow(startMin, endMin, context.stormWatchWindow);

  const rawEvents: (Omit<ExplainEvent, "id" | "tsMin"> & { proposedTsMin: number })[] = [];

  if (peakOverlap.overlaps) {
    rawEvents.push({
      proposedTsMin: peakOverlap.start,
      type: "rate",
      title: "Peak rate period",
      whatHappened: "Peak period started. System prioritized reducing grid usage.",
      reasons: [
        buildReason("TBC_PEAK_AVOIDANCE", [
          `Mode: ${context.mode}.`,
          `Selected window overlaps peak period (${formatWindow(context.peakWindow.startMin, context.peakWindow.endMin)}).`,
          `Battery average power was ${round(avgBatteryKw, 2)} kW in this selection.`,
        ]),
      ],
    });
  }

  if (stormOverlap.overlaps && context.stormWatchEnabled) {
    rawEvents.push({
      proposedTsMin: stormOverlap.start,
      type: "storm",
      title: "Storm Watch",
      whatHappened:
        "Storm Watch engaged. Powerwall increased charge to improve backup readiness.",
      reasons: [
        buildReason("STORM_WATCH_PRECHARGE", [
          "Storm Watch is enabled in site settings.",
          `Window overlaps Storm Watch (${formatWindow(context.stormWatchWindow.startMin, context.stormWatchWindow.endMin)}).`,
          `SOC moved ${round(summary.startSoc, 1)}% → ${round(summary.endSoc, 1)}% in selection.`,
        ]),
      ],
    });
  }

  if (avgBatteryKw > 0.4) {
    const chargeStartTs = findFirstSample(windowSamples, (sample) => sample.batteryKw > 0.4, startMin);
    const reasons: ExplainReason[] = [];
    if (stormOverlap.overlaps && context.stormWatchEnabled) {
      reasons.push(
        buildReason("STORM_WATCH_PRECHARGE", [
          "Charging occurred while Storm Watch interval was active.",
          `Average battery power was +${round(avgBatteryKw, 2)} kW.`,
        ]),
      );
    }
    if (avgSolarKw > avgHomeKw + 0.3) {
      reasons.push(
        buildReason(
          "SOLAR_SURPLUS_CHARGE",
          [
            `Average solar ${round(avgSolarKw, 2)} kW exceeded home load ${round(avgHomeKw, 2)} kW.`,
            `Battery charged about ${summary.totalBatteryChargeKwhApprox} kWh in this window.`,
          ],
          stormOverlap.overlaps ? "Medium" : "High",
        ),
      );
    }
    if (reasons.length === 0) {
      reasons.push(
        buildReason("HOLDING_CHARGE", [
          `Battery stayed net charging at +${round(avgBatteryKw, 2)} kW.`,
          `SOC increased from ${summary.startSoc}% to ${summary.endSoc}% during the selected period.`,
        ]),
      );
    }
    rawEvents.push({
      proposedTsMin: chargeStartTs,
      type: "battery",
      title: "Battery charging",
      whatHappened:
        "Powerwall was mostly charging during the selected period.",
      reasons,
    });
  }

  if (avgBatteryKw < -0.4) {
    const dischargeStartTs = findFirstSample(windowSamples, (sample) => sample.batteryKw < -0.4, startMin);
    const reasons: ExplainReason[] = [];
    if (peakOverlap.overlaps) {
      reasons.push(
        buildReason("TBC_PEAK_AVOIDANCE", [
          `Selection overlaps peak period (${formatWindow(context.peakWindow.startMin, context.peakWindow.endMin)}).`,
          `Battery average power was ${round(avgBatteryKw, 2)} kW (discharging).`,
        ]),
      );
    }
    if (summary.minSoc <= context.backupReservePct + 2) {
      reasons.push(
        buildReason(
          "BACKUP_RESERVE_PROTECTION",
          [
            `Backup reserve is ${context.backupReservePct}%.`,
            `SOC approached reserve. Minimum observed ${summary.minSoc}%.`,
          ],
          "Medium",
        ),
      );
    }
    if (reasons.length === 0) {
      reasons.push(
        buildReason("HOLDING_CHARGE", [
          `Battery delivered about ${summary.totalBatteryDischargeKwhApprox} kWh in this window.`,
          `SOC declined ${summary.startSoc}% → ${summary.endSoc}%.`,
        ]),
      );
    }
    rawEvents.push({
      proposedTsMin: dischargeStartTs,
      type: "battery",
      title: "Battery discharging",
      whatHappened:
        "Powerwall supplied home demand to reduce grid dependence.",
      reasons,
    });
  }

  const exportRunStart = hasConsecutiveGridExport(windowSamples, 3);
  if (exportRunStart !== null) {
    rawEvents.push({
      proposedTsMin: exportRunStart,
      type: "grid",
      title: "Exporting to grid",
      whatHappened:
        "Solar production exceeded site demand and excess energy was exported.",
      reasons: [
        buildReason(
          "EXPORTING_SURPLUS",
          [
            "At least 15 minutes of consecutive grid export was observed.",
            `Average solar ${round(avgSolarKw, 2)} kW vs home ${round(avgHomeKw, 2)} kW.`,
            `Approx export in selection: ${summary.totalGridExportKwhApprox} kWh.`,
          ],
          summary.totalGridExportKwhApprox > 0.5 ? "High" : "Medium",
        ),
      ],
    });
  }

  if (Math.abs(avgBatteryKw) < 0.25 && avgSolarKw > avgHomeKw + 0.25) {
    const holdTs = findFirstSample(windowSamples, () => true, startMin);
    rawEvents.push({
      proposedTsMin: holdTs,
      type: "solar",
      title: "Holding battery level",
      whatHappened:
        "Battery power stayed near neutral while solar carried most of the load.",
      reasons: [
        buildReason(
          "HOLDING_CHARGE",
          [
            `Average battery power stayed near ${round(avgBatteryKw, 2)} kW.`,
            `SOC remained within ${summary.minSoc}% to ${summary.maxSoc}% during this selection.`,
            `Solar remained above home load on average (${round(avgSolarKw, 2)} vs ${round(avgHomeKw, 2)} kW).`,
          ],
          "Medium",
        ),
      ],
    });
  }

  if (rawEvents.length === 0) {
    rawEvents.push({
      proposedTsMin: startMin,
      type: "info",
      title: "Stable operation",
      whatHappened:
        "No major state transitions were detected in this window.",
      reasons: [
        buildReason("HOLDING_CHARGE", [
          `Window: ${formatWindow(startMin, endMin)}.`,
          `SOC changed ${summary.startSoc}% → ${summary.endSoc}%.`,
          `Average battery power ${round(avgBatteryKw, 2)} kW.`,
        ]),
      ],
    });
  }

  const usedTimestamps = new Set<number>();
  const normalizedEvents: ExplainEvent[] = rawEvents
    .map((event, index) => {
      const tsMin = ensureUniqueTimestamp(event.proposedTsMin, usedTimestamps, startMin, endMin);
      usedTimestamps.add(tsMin);
      return {
        id: `${tsMin}-${index}`,
        tsMin,
        title: event.title,
        type: event.type,
        whatHappened: event.whatHappened,
        reasons: event.reasons,
      };
    })
    .sort((a, b) => a.tsMin - b.tsMin)
    .slice(0, MAX_EVENTS);

  return normalizedEvents.map((event, index) => ({
    ...event,
    id: `${event.type}-${event.tsMin}-${index}`,
    whatHappened: event.whatHappened,
    reasons: event.reasons.map((reason) => ({
      ...reason,
      evidence: [
        ...reason.evidence,
        `Event time: ${minutesToLabel(event.tsMin)}.`,
      ].slice(0, 3),
    })),
  }));
}
