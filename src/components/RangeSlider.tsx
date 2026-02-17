import { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, step: number): number {
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
  const [isStartDragging, setIsStartDragging] = useState<boolean>(false);
  const [isEndDragging, setIsEndDragging] = useState<boolean>(false);

  const usableTrackWidth = Math.max(1, containerWidth - THUMB_SIZE);
  const range = Math.max(1, max - min);

  const startValueAtGrantRef = useRef<number>(startValue);
  const endValueAtGrantRef = useRef<number>(endValue);
  const latestValuesRef = useRef({
    startValue,
    endValue,
    min,
    max,
    minGap,
    step,
    range,
    usableTrackWidth,
  });

  latestValuesRef.current = {
    startValue,
    endValue,
    min,
    max,
    minGap,
    step,
    range,
    usableTrackWidth,
  };

  const valueToPosition = (value: number): number => {
    const ratio = (value - min) / range;
    return clamp(ratio, 0, 1) * usableTrackWidth;
  };

  const startPosition = valueToPosition(startValue);
  const endPosition = valueToPosition(endValue);

  const startThumbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startValueAtGrantRef.current = latestValuesRef.current.startValue;
          setIsStartDragging(true);
        },
        onPanResponderMove: (_, gestureState) => {
          const latest = latestValuesRef.current;
          const deltaValue = (gestureState.dx / latest.usableTrackWidth) * latest.range;
          const rawNextStart = startValueAtGrantRef.current + deltaValue;
          const stepped = snapToStep(rawNextStart, latest.step);
          const maxStart = latest.endValue - latest.minGap;
          const clampedStart = clamp(stepped, latest.min, maxStart);
          onChange(clampedStart, latest.endValue);
        },
        onPanResponderRelease: () => {
          setIsStartDragging(false);
        },
        onPanResponderTerminate: () => {
          setIsStartDragging(false);
        },
      }),
    [onChange],
  );

  const endThumbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          endValueAtGrantRef.current = latestValuesRef.current.endValue;
          setIsEndDragging(true);
        },
        onPanResponderMove: (_, gestureState) => {
          const latest = latestValuesRef.current;
          const deltaValue = (gestureState.dx / latest.usableTrackWidth) * latest.range;
          const rawNextEnd = endValueAtGrantRef.current + deltaValue;
          const stepped = snapToStep(rawNextEnd, latest.step);
          const minEnd = latest.startValue + latest.minGap;
          const clampedEnd = clamp(stepped, minEnd, latest.max);
          onChange(latest.startValue, clampedEnd);
        },
        onPanResponderRelease: () => {
          setIsEndDragging(false);
        },
        onPanResponderTerminate: () => {
          setIsEndDragging(false);
        },
      }),
    [onChange],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <View style={styles.track} />
      <View style={[styles.selectedTrack, { left: startPosition + THUMB_SIZE / 2, width: endPosition - startPosition }]} />

      <View
        style={[styles.thumb, { left: startPosition }, isStartDragging && styles.thumbDragging]}
        {...startThumbPanResponder.panHandlers}
      />
      <View
        style={[styles.thumb, { left: endPosition }, isEndDragging && styles.thumbDragging]}
        {...endThumbPanResponder.panHandlers}
      />
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
  thumb: {
    position: "absolute",
    top: (SLIDER_HEIGHT - THUMB_SIZE) / 2,
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
