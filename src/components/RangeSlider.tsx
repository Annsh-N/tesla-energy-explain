import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { colors, radius } from "../theme/tokens";
import { withOpacity } from "../theme/theme";

type RangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  minGap?: number;
  startValue: number;
  endValue: number;
  onChange: (startValue: number, endValue: number) => void;
  style?: StyleProp<ViewStyle>;
};

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;
const SLIDER_HEIGHT = 32;
const THUMB_RADIUS = THUMB_SIZE / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function workletClamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function workletSnapToStep(value: number, step: number): number {
  "worklet";
  return Math.round(value / step) * step;
}

export function RangeSlider({
  min,
  max,
  step = 5,
  minGap = 30,
  startValue,
  endValue,
  onChange,
  style,
}: RangeSliderProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isStartDragging, setIsStartDragging] = useState(false);
  const [isEndDragging, setIsEndDragging] = useState(false);

  const range = Math.max(1, max - min);
  const trackWidth = Math.max(1, containerWidth - THUMB_SIZE);

  const trackWidthSv = useSharedValue(trackWidth);
  const startPositionSv = useSharedValue(0);
  const endPositionSv = useSharedValue(0);
  const startGestureOriginSv = useSharedValue(0);
  const endGestureOriginSv = useSharedValue(0);

  const isDraggingRef = useRef(false);
  const emittedRangeRef = useRef({ start: startValue, end: endValue });

  const setDraggingState = useCallback((target: "start" | "end", active: boolean) => {
    isDraggingRef.current = active;
    if (target === "start") {
      setIsStartDragging(active);
      if (active) {
        setIsEndDragging(false);
      }
      return;
    }
    setIsEndDragging(active);
    if (active) {
      setIsStartDragging(false);
    }
  }, []);

  const valueToPosition = useCallback(
    (value: number, width: number): number => {
      const ratio = (value - min) / range;
      return clamp(ratio, 0, 1) * width;
    },
    [min, range],
  );

  const positionToValue = useCallback(
    (position: number, width: number): number => {
      const ratio = clamp(position / Math.max(1, width), 0, 1);
      return min + ratio * range;
    },
    [min, range],
  );

  const emitRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      const safeStart = clamp(Math.round(nextStart), min, max);
      const safeEnd = clamp(Math.round(nextEnd), min, max);
      const previous = emittedRangeRef.current;
      if (previous.start === safeStart && previous.end === safeEnd) {
        return;
      }
      emittedRangeRef.current = { start: safeStart, end: safeEnd };
      onChange(safeStart, safeEnd);
    },
    [max, min, onChange],
  );

  useEffect(() => {
    trackWidthSv.value = trackWidth;
  }, [trackWidth, trackWidthSv]);

  useEffect(() => {
    if (trackWidth <= 0 || isDraggingRef.current) {
      return;
    }

    const minGapPx = (minGap / range) * trackWidth;
    const nextStartPosition = valueToPosition(startValue, trackWidth);
    const nextEndPosition = valueToPosition(endValue, trackWidth);

    const clampedStart = clamp(nextStartPosition, 0, trackWidth - minGapPx);
    const clampedEnd = clamp(nextEndPosition, clampedStart + minGapPx, trackWidth);

    startPositionSv.value = clampedStart;
    endPositionSv.value = clampedEnd;
    emittedRangeRef.current = { start: startValue, end: endValue };
  }, [
    endPositionSv,
    endValue,
    minGap,
    range,
    startPositionSv,
    startValue,
    trackWidth,
    valueToPosition,
  ]);

  const startGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startGestureOriginSv.value = startPositionSv.value;
          runOnJS(setDraggingState)("start", true);
        })
        .onUpdate((event) => {
          const width = trackWidthSv.value;
          const minGapPx = (minGap / range) * width;
          const maxStartPosition = endPositionSv.value - minGapPx;
          const nextStartPosition = workletClamp(
            startGestureOriginSv.value + event.translationX,
            0,
            maxStartPosition,
          );

          startPositionSv.value = nextStartPosition;

          const nextStartValue = min + (nextStartPosition / Math.max(1, width)) * range;
          const currentEndValue = min + (endPositionSv.value / Math.max(1, width)) * range;
          runOnJS(emitRange)(nextStartValue, currentEndValue);
        })
        .onFinalize(() => {
          const width = trackWidthSv.value;
          const currentEndValue = min + (endPositionSv.value / Math.max(1, width)) * range;
          const snappedEndValue = workletSnapToStep(currentEndValue, step);
          let snappedStartValue = workletSnapToStep(
            min + (startPositionSv.value / Math.max(1, width)) * range,
            step,
          );

          const maxStartValue = snappedEndValue - minGap;
          snappedStartValue = workletClamp(snappedStartValue, min, maxStartValue);
          const snappedStartPosition = ((snappedStartValue - min) / range) * width;
          const snappedEndPosition = ((snappedEndValue - min) / range) * width;
          startPositionSv.value = workletClamp(snappedStartPosition, 0, width);
          endPositionSv.value = workletClamp(snappedEndPosition, 0, width);

          runOnJS(emitRange)(snappedStartValue, snappedEndValue);
          runOnJS(setDraggingState)("start", false);
        }),
    [
      emitRange,
      endPositionSv,
      min,
      minGap,
      range,
      setDraggingState,
      startGestureOriginSv,
      startPositionSv,
      step,
      trackWidthSv,
    ],
  );

  const endGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          endGestureOriginSv.value = endPositionSv.value;
          runOnJS(setDraggingState)("end", true);
        })
        .onUpdate((event) => {
          const width = trackWidthSv.value;
          const minGapPx = (minGap / range) * width;
          const minEndPosition = startPositionSv.value + minGapPx;
          const nextEndPosition = workletClamp(
            endGestureOriginSv.value + event.translationX,
            minEndPosition,
            width,
          );

          endPositionSv.value = nextEndPosition;

          const currentStartValue = min + (startPositionSv.value / Math.max(1, width)) * range;
          const nextEndValue = min + (nextEndPosition / Math.max(1, width)) * range;
          runOnJS(emitRange)(currentStartValue, nextEndValue);
        })
        .onFinalize(() => {
          const width = trackWidthSv.value;
          const currentStartValue = min + (startPositionSv.value / Math.max(1, width)) * range;
          const snappedStartValue = workletSnapToStep(currentStartValue, step);
          let snappedEndValue = workletSnapToStep(
            min + (endPositionSv.value / Math.max(1, width)) * range,
            step,
          );

          const minEndValue = snappedStartValue + minGap;
          snappedEndValue = workletClamp(snappedEndValue, minEndValue, max);
          const snappedStartPosition = ((snappedStartValue - min) / range) * width;
          const snappedEndPosition = ((snappedEndValue - min) / range) * width;
          startPositionSv.value = workletClamp(snappedStartPosition, 0, width);
          endPositionSv.value = workletClamp(snappedEndPosition, 0, width);

          runOnJS(emitRange)(snappedStartValue, snappedEndValue);
          runOnJS(setDraggingState)("end", false);
        }),
    [
      emitRange,
      endGestureOriginSv,
      endPositionSv,
      max,
      min,
      minGap,
      range,
      setDraggingState,
      startPositionSv,
      step,
      trackWidthSv,
    ],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  const selectedTrackStyle = useAnimatedStyle(() => ({
    left: startPositionSv.value + THUMB_RADIUS,
    width: Math.max(0, endPositionSv.value - startPositionSv.value),
  }));

  const startThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startPositionSv.value }],
  }));

  const endThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endPositionSv.value }],
  }));

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <View style={styles.track} />
      <Animated.View style={[styles.selectedTrack, selectedTrackStyle]} />

      <GestureDetector gesture={startGesture}>
        <Animated.View style={[styles.thumbHitBox, startThumbStyle]}>
          <View style={[styles.thumb, isStartDragging && styles.thumbDragging]} />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={endGesture}>
        <Animated.View style={[styles.thumbHitBox, endThumbStyle]}>
          <View style={[styles.thumb, isEndDragging && styles.thumbDragging]} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SLIDER_HEIGHT,
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
  },
  selectedTrack: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: withOpacity(colors.textPrimary, 0.9),
  },
  thumbHitBox: {
    position: "absolute",
    top: (SLIDER_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.textPrimary,
    borderWidth: 1,
    borderColor: withOpacity(colors.buttonPrimaryText, 0.15),
  },
  thumbDragging: {
    backgroundColor: withOpacity(colors.textPrimary, 0.9),
  },
});
