import { Platform, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, spacing } from "./tokens";
import { typography } from "./typography";

export const theme = {
  colors,
  spacing,
  radius,
  typography,
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

export const shadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  default: {},
}) ?? {};

export function withOpacity(hexColor: string, opacity: number): string {
  const normalized = hexColor.replace("#", "");
  const safeOpacity = Math.min(1, Math.max(0, opacity));

  if (normalized.length !== 3 && normalized.length !== 6) {
    return hexColor;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
}

export type AppTheme = typeof theme;
