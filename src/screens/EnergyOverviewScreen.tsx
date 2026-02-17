import { memo, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VictoryChart, VictoryLine } from "victory-native";
import { Card } from "../components/Card";
import { Divider } from "../components/Divider";
import { Pill } from "../components/Pill";
import { RangeSlider } from "../components/RangeSlider";
import { Spacer } from "../components/Spacer";
import { TeslaButton } from "../components/TeslaButton";
import { TeslaHeader } from "../components/TeslaHeader";
import { storyDaySamples } from "../data/storyDay";
import { colors, radius, spacing } from "../theme/tokens";
import { hairlineWidth, theme, withOpacity } from "../theme/theme";
import { formatWindow, minutesToLabel } from "../utils/time";

const MINUTES_PER_DAY = 24 * 60;
const CHART_HEIGHT = 200;
const CHART_MIN_WIDTH = 280;
const CHART_SIDE_PADDING = spacing.lg;
const CHART_Y_LABEL_WIDTH = 24;
const CHART_Y_LABEL_GAP = spacing.xs;
const WINDOW_STEP_MINUTES = 5;
const MIN_WINDOW_MINUTES = 30;
const DEFAULT_START_MIN = 17 * 60;
const DEFAULT_END_MIN = 19 * 60;
const SEGMENT_OPTIONS = ["Day", "Week", "Month", "Year"] as const;
const TIME_MARKERS = [
  { minute: 0, label: "12AM" },
  { minute: 6 * 60, label: "6AM" },
  { minute: 12 * 60, label: "12PM" },
  { minute: 18 * 60, label: "6PM" },
] as const;
const SAMPLE_STEP_MINUTES = 5;

type ChartPoint = {
  x: number;
  y: number;
};

type SocChartProps = {
  chartWidth: number;
  socSeries: ChartPoint[];
};

function SocChart({ chartWidth, socSeries }: SocChartProps) {
  return (
    <VictoryChart
      width={chartWidth}
      height={CHART_HEIGHT}
      domain={{ x: [0, MINUTES_PER_DAY], y: [0, 100] }}
      padding={{
        top: spacing.sm,
        right: 0,
        bottom: spacing.md,
        left: 0,
      }}
    >
      <VictoryLine
        data={socSeries}
        interpolation="monotoneX"
        style={{
          data: {
            stroke: colors.textPrimary,
            strokeWidth: 2.2,
          },
        }}
      />
    </VictoryChart>
  );
}

const MemoizedSocChart = memo(SocChart);

export function EnergyOverviewScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [range, setRange] = useState<{ startMin: number; endMin: number }>({
    startMin: DEFAULT_START_MIN,
    endMin: DEFAULT_END_MIN,
  });
  const { startMin, endMin } = range;

  const chartWidth = Math.max(CHART_MIN_WIDTH, screenWidth - spacing.xl * 2 - CHART_SIDE_PADDING * 2);
  const chartPlotWidth = Math.max(1, chartWidth - CHART_Y_LABEL_WIDTH - CHART_Y_LABEL_GAP);

  const socSeries: ChartPoint[] = useMemo(
    () => {
      const points = storyDaySamples.map((sample) => ({ x: sample.ts, y: sample.socPct }));
      const lastPoint = points[points.length - 1];
      if (!lastPoint) {
        return points;
      }
      return [...points, { x: MINUTES_PER_DAY, y: lastPoint.y }];
    },
    [],
  );

  const selectedSampleIndex = Math.min(
    storyDaySamples.length - 1,
    Math.max(0, Math.floor(endMin / SAMPLE_STEP_MINUTES) - 1),
  );
  const selectedSoc = storyDaySamples[selectedSampleIndex]?.socPct ?? 0;
  const windowLabel = formatWindow(startMin, endMin);
  const explainTitle = `Explain ${windowLabel}`;

  const selectedStartPct = (startMin / MINUTES_PER_DAY) * 100;
  const selectedWidthPct = ((endMin - startMin) / MINUTES_PER_DAY) * 100;

  const handleRangeChange = (nextStartMin: number, nextEndMin: number) => {
    setRange((prev) =>
      prev.startMin === nextStartMin && prev.endMin === nextEndMin
        ? prev
        : { startMin: nextStartMin, endMin: nextEndMin },
    );
  };

  const handleExplainPress = () => {
    // Step 3 scope: log window only, no navigation yet.
    console.log({
      startMin,
      endMin,
      label: windowLabel,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <TeslaHeader title="Energy" size="title" rightIconName="information-circle-outline" />

        <Spacer height={spacing.md} />

        <View style={styles.segmentedRow}>
          {SEGMENT_OPTIONS.map((option) => (
            <Pill
              key={option}
              label={option}
              variant={option === "Day" ? "active" : "disabled"}
              style={styles.segmentPill}
            />
          ))}
        </View>

        <Spacer height={spacing.md} />

        <Card>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.dateLabel}>Feb 17</Text>
          </View>

          <Spacer height={spacing.xs} />
          <Text style={theme.typography.number}>{Math.round(selectedSoc)}%</Text>
          <Spacer height={spacing.xs} />
          <Text style={styles.selfPoweredLabel}>State of charge</Text>

          <Spacer height={spacing.md} />
          <View style={styles.chartRow}>
            <View style={styles.yAxisLabelColumn}>
              <Text style={styles.yAxisLabel}>100</Text>
              <Text style={styles.yAxisLabel}>50</Text>
              <Text style={styles.yAxisLabel}>0</Text>
            </View>

            <View style={[styles.chartWrapper, { width: chartPlotWidth }]}>
              <View style={[styles.gridline, styles.gridlineTop]} />
              <View style={[styles.gridline, styles.gridlineMiddle]} />
              <View style={[styles.gridline, styles.gridlineBottom]} />

              <View
                style={[
                  styles.chartBand,
                  styles.selectedWindowBand,
                  { left: `${selectedStartPct}%` as `${number}%`, width: `${selectedWidthPct}%` as `${number}%` },
                ]}
              />

              <MemoizedSocChart chartWidth={chartPlotWidth} socSeries={socSeries} />
            </View>
          </View>

          <View style={[styles.timeMarkersRow, { marginLeft: CHART_Y_LABEL_WIDTH + CHART_Y_LABEL_GAP, width: chartPlotWidth }]}>
            {TIME_MARKERS.map((marker) => (
              <Text key={marker.minute} style={styles.timeMarkerText}>
                {marker.label}
              </Text>
            ))}
          </View>

          <Spacer height={spacing.md} />
          <Divider />
          <Spacer height={spacing.sm} />

          <View style={styles.windowRow}>
            <Text style={styles.windowLabel}>Window</Text>
            <Text style={styles.windowValue}>{windowLabel}</Text>
          </View>

          <Spacer height={spacing.sm} />
          <RangeSlider
            min={0}
            max={MINUTES_PER_DAY}
            step={WINDOW_STEP_MINUTES}
            minGap={MIN_WINDOW_MINUTES}
            startValue={startMin}
            endValue={endMin}
            onChange={handleRangeChange}
          />

          <View style={styles.sliderLabelsRow}>
            <Text style={styles.sliderValue}>{minutesToLabel(startMin)}</Text>
            <Text style={styles.sliderValue}>{minutesToLabel(endMin)}</Text>
          </View>
        </Card>

        <View style={styles.bottomSpacer} />

        <TeslaButton title={explainTitle} onPress={handleExplainPress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  segmentPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    ...theme.typography.subtitle,
  },
  dateLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  selfPoweredLabel: {
    ...theme.typography.label,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  yAxisLabelColumn: {
    width: CHART_Y_LABEL_WIDTH,
    height: CHART_HEIGHT,
    marginRight: CHART_Y_LABEL_GAP,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    justifyContent: "space-between",
  },
  yAxisLabel: {
    ...theme.typography.caption,
    textAlign: "right",
    color: colors.textTertiary,
  },
  chartWrapper: {
    height: CHART_HEIGHT,
    backgroundColor: colors.surface3,
    borderRadius: radius.md,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  chartBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  gridline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: hairlineWidth,
    backgroundColor: withOpacity(colors.divider, 0.8),
    zIndex: 0,
  },
  gridlineTop: {
    top: spacing.sm,
  },
  gridlineMiddle: {
    top: "50%",
    transform: [{ translateY: -0.5 }],
  },
  gridlineBottom: {
    bottom: spacing.md,
  },
  selectedWindowBand: {
    backgroundColor: withOpacity(colors.statusGood, 0.16),
  },
  timeMarkersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  timeMarkerText: {
    ...theme.typography.caption,
  },
  windowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  windowLabel: {
    ...theme.typography.label,
  },
  windowValue: {
    ...theme.typography.subtitle,
    fontSize: 15,
    lineHeight: 20,
  },
  sliderLabelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sliderValue: {
    ...theme.typography.caption,
    color: colors.textPrimary,
  },
  bottomSpacer: {
    flex: 1,
  },
});
