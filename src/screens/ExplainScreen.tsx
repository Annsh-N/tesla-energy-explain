import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../AppNavigator";
import { Card } from "../components/Card";
import { Divider } from "../components/Divider";
import { Pill } from "../components/Pill";
import { Spacer } from "../components/Spacer";
import { TeslaHeader } from "../components/TeslaHeader";
import { storyDayContext, storyDaySamples } from "../data/storyDay";
import {
  buildExplainTimeline,
  ExplainContext,
  ExplainEvent,
  summarizeWindow,
  getWindowSamples,
} from "../logic/explainEngine";
import {
  ReplayMode,
  replayWindow,
} from "../logic/replay";
import { colors, radius, spacing } from "../theme/tokens";
import { theme, withOpacity } from "../theme/theme";
import { formatWindow, minutesToLabel } from "../utils/time";

type Props = NativeStackScreenProps<RootStackParamList, "Explain">;

const RESERVE_MIN = 20;
const RESERVE_MAX = 80;
const RESERVE_STEP = 5;

const eventTypeLabel: Record<ExplainEvent["type"], string> = {
  mode: "Mode",
  rate: "Peak",
  battery: "Battery",
  grid: "Grid",
  storm: "Storm",
  solar: "Solar",
  info: "Info",
};

function overlap(startMin: number, endMin: number, windowStart: number, windowEnd: number): boolean {
  return Math.max(startMin, windowStart) < Math.min(endMin, windowEnd);
}

function formatSigned(value: number, decimals = 1): string {
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

function buildExpectedChanges(
  mode: ReplayMode,
  reservePct: number,
  context: ExplainContext,
  startMin: number,
  endMin: number,
  deltas: { endSocPct: number; gridImportKwh: number; batteryDischargeKwh: number },
): string[] {
  const bullets: string[] = [];
  const stormOverlap = overlap(startMin, endMin, context.stormWatchWindow.startMin, context.stormWatchWindow.endMin);
  const peakOverlap = overlap(startMin, endMin, context.peakWindow.startMin, context.peakWindow.endMin);

  if (mode === "Self-Powered") {
    bullets.push("System would prioritize solar self-consumption over peak arbitrage.");
  } else if (peakOverlap) {
    bullets.push("Time-Based mode would continue prioritizing peak-rate avoidance in this window.");
  }

  if (reservePct > context.backupReservePct) {
    bullets.push("Higher reserve would reduce allowable discharge depth and preserve backup energy.");
  } else if (reservePct < context.backupReservePct) {
    bullets.push("Lower reserve would allow deeper discharge before grid support is needed.");
  }

  if (stormOverlap && context.stormWatchEnabled && mode === "Time-Based Control") {
    bullets.push("Storm Watch overlap would bias charging behavior toward backup readiness.");
  }

  if (deltas.gridImportKwh > 0.15) {
    bullets.push("Grid import is expected to increase in this replay.");
  } else if (deltas.gridImportKwh < -0.15) {
    bullets.push("Grid import is expected to decrease in this replay.");
  }

  if (deltas.endSocPct > 1) {
    bullets.push("Window is likely to end at a higher SOC.");
  } else if (deltas.endSocPct < -1) {
    bullets.push("Window is likely to end at a lower SOC.");
  }

  if (bullets.length < 2) {
    bullets.push("Replay is illustrative and uses the same solar/home profile for the selected window.");
  }

  return bullets.slice(0, 4);
}

export function ExplainScreen({ navigation, route }: Props) {
  const { startMin, endMin, dayDateLabel } = route.params;
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [mode, setMode] = useState<ReplayMode>("Time-Based Control");
  const [reservePct, setReservePct] = useState<number>(storyDayContext.backupReservePct);

  const explainContext: ExplainContext = storyDayContext;
  const windowLabel = formatWindow(startMin, endMin);

  const windowSamples = useMemo(
    () => getWindowSamples(storyDaySamples, startMin, endMin),
    [startMin, endMin],
  );

  const windowSummary = useMemo(
    () => summarizeWindow(windowSamples, explainContext),
    [explainContext, windowSamples],
  );

  const timelineEvents = useMemo(
    () => buildExplainTimeline(storyDaySamples, explainContext, startMin, endMin),
    [endMin, explainContext, startMin],
  );

  const replayResult = useMemo(
    () =>
      replayWindow(storyDaySamples, explainContext, startMin, endMin, {
        mode,
        backupReservePct: reservePct,
      }),
    [endMin, explainContext, mode, reservePct, startMin],
  );

  const expectedChanges = useMemo(
    () => buildExpectedChanges(mode, reservePct, explainContext, startMin, endMin, replayResult.deltas),
    [endMin, explainContext, mode, replayResult.deltas, reservePct, startMin],
  );

  const gridDominance =
    windowSummary.totalGridImportKwhApprox >= windowSummary.totalGridExportKwhApprox
      ? "Import dominant"
      : "Export dominant";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <TeslaHeader
          title="Explain"
          size="title"
          leftIconName="chevron-back"
          onLeftPress={() => navigation.goBack()}
        />

        <Text style={styles.windowSubtitle}>{`Explain ${windowLabel}`}</Text>
        {dayDateLabel ? <Text style={styles.dayLabel}>{dayDateLabel}</Text> : null}

        <Spacer height={spacing.md} />

        <Card style={styles.summaryCard}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>SOC</Text>
            <Text style={styles.summaryValue}>
              {`${Math.round(windowSummary.startSoc)}% → ${Math.round(windowSummary.endSoc)}%`}
            </Text>
          </View>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>Grid</Text>
            <Text style={styles.summaryValue}>{gridDominance}</Text>
          </View>
        </Card>

        <Spacer height={spacing.md} />

        <FlatList
          data={timelineEvents}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.timelineContent}
          renderItem={({ item }) => {
            const isExpanded = expandedEventId === item.id;
            return (
              <Pressable
                onPress={() => {
                  setExpandedEventId((current) => (current === item.id ? null : item.id));
                }}
              >
                <Card style={styles.eventCard}>
                  <View style={styles.eventTopRow}>
                    <View style={styles.eventHeading}>
                      <Text style={styles.eventTime}>{minutesToLabel(item.tsMin)}</Text>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                    </View>
                    <View style={styles.eventMeta}>
                      <Pill label={eventTypeLabel[item.type]} />
                      <Ionicons
                        name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                        size={16}
                        color={colors.icon}
                        style={styles.eventChevron}
                      />
                    </View>
                  </View>

                  {isExpanded ? (
                    <View>
                      <Spacer height={spacing.sm} />
                      <Text style={styles.sectionLabel}>What happened</Text>
                      <Spacer height={spacing.xs} />
                      <Text style={styles.sectionBody}>{item.whatHappened}</Text>

                      <Spacer height={spacing.sm} />
                      <Divider />
                      <Spacer height={spacing.sm} />

                      <Text style={styles.sectionLabel}>Why</Text>
                      <Spacer height={spacing.xs} />

                      {item.reasons.map((reason) => (
                        <View key={`${item.id}-${reason.code}`} style={styles.reasonPanel}>
                          <View style={styles.reasonTitleRow}>
                            <Text style={styles.reasonTitle}>{reason.title}</Text>
                            <Pill
                              label={reason.confidence}
                              variant={reason.confidence === "High" ? "active" : "default"}
                            />
                          </View>
                          <Spacer height={spacing.xs} />
                          {reason.evidence.map((evidenceItem, index) => (
                            <Text key={`${reason.code}-${index}`} style={styles.evidenceItem}>
                              {`\u2022 ${evidenceItem}`}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Card style={styles.whatIfCard}>
              <Text style={styles.whatIfTitle}>What-If (Replay)</Text>
              <Spacer height={spacing.sm} />

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Backup Reserve</Text>
                <Text style={styles.controlValue}>{`${reservePct}%`}</Text>
              </View>

              <Slider
                minimumValue={RESERVE_MIN}
                maximumValue={RESERVE_MAX}
                step={RESERVE_STEP}
                value={reservePct}
                minimumTrackTintColor={colors.textPrimary}
                maximumTrackTintColor={colors.divider}
                thumbTintColor={colors.textPrimary}
                onValueChange={setReservePct}
              />

              <Spacer height={spacing.sm} />

              <Text style={styles.controlLabel}>Mode</Text>
              <Spacer height={spacing.xs} />
              <View style={styles.modeRow}>
                <Pressable onPress={() => setMode("Time-Based Control")} style={styles.modePressable}>
                  <Pill
                    label="Time-Based"
                    variant={mode === "Time-Based Control" ? "active" : "default"}
                    style={styles.modePill}
                  />
                </Pressable>
                <Pressable onPress={() => setMode("Self-Powered")} style={styles.modePressable}>
                  <Pill
                    label="Self-Powered"
                    variant={mode === "Self-Powered" ? "active" : "default"}
                    style={styles.modePill}
                  />
                </Pressable>
              </View>

              <Spacer height={spacing.sm} />
              <Divider />
              <Spacer height={spacing.sm} />

              <Text style={styles.sectionLabel}>Expected changes</Text>
              <Spacer height={spacing.xs} />
              {expectedChanges.map((bullet, index) => (
                <Text key={`expected-${index}`} style={styles.evidenceItem}>
                  {`\u2022 ${bullet}`}
                </Text>
              ))}

              <Spacer height={spacing.sm} />
              <View style={styles.deltaRow}>
                <View style={styles.deltaItem}>
                  <Text style={styles.deltaLabel}>End SOC</Text>
                  <Text style={styles.deltaValue}>{`${formatSigned(replayResult.deltas.endSocPct, 1)}%`}</Text>
                </View>
                <View style={styles.deltaItem}>
                  <Text style={styles.deltaLabel}>Grid import</Text>
                  <Text style={styles.deltaValue}>{`${formatSigned(replayResult.deltas.gridImportKwh, 2)} kWh`}</Text>
                </View>
                <View style={styles.deltaItem}>
                  <Text style={styles.deltaLabel}>Battery discharge</Text>
                  <Text style={styles.deltaValue}>{`${formatSigned(replayResult.deltas.batteryDischargeKwh, 2)} kWh`}</Text>
                </View>
              </View>

              <Spacer height={spacing.xs} />
              <Text style={styles.illustrativeText}>Illustrative replay for selected window only.</Text>
            </Card>
          }
        />
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
  },
  windowSubtitle: {
    ...theme.typography.label,
    color: colors.textPrimary,
  },
  dayLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryColumn: {
    flex: 1,
  },
  summaryLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...theme.typography.subtitle,
  },
  timelineContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  eventCard: {
    marginBottom: spacing.sm,
  },
  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventHeading: {
    flex: 1,
    marginRight: spacing.sm,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventTime: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  eventTitle: {
    ...theme.typography.subtitle,
  },
  eventChevron: {
    marginLeft: spacing.xs,
  },
  sectionLabel: {
    ...theme.typography.label,
    color: colors.textSecondary,
  },
  sectionBody: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  reasonPanel: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reasonTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  reasonTitle: {
    ...theme.typography.subtitle,
    flex: 1,
  },
  evidenceItem: {
    ...theme.typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  whatIfCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  whatIfTitle: {
    ...theme.typography.subtitle,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlLabel: {
    ...theme.typography.label,
  },
  controlValue: {
    ...theme.typography.body,
    color: colors.textPrimary,
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modePressable: {
    flex: 1,
  },
  modePill: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  deltaItem: {
    flex: 1,
    backgroundColor: withOpacity(colors.surface3, 0.65),
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  deltaLabel: {
    ...theme.typography.caption,
    color: colors.textSecondary,
  },
  deltaValue: {
    ...theme.typography.subtitle,
    fontSize: 15,
    lineHeight: 20,
  },
  illustrativeText: {
    ...theme.typography.caption,
    color: colors.textTertiary,
  },
});
