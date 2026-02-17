import { TextStyle } from "react-native";
import { colors } from "./tokens";

type Typography = {
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  label: TextStyle;
  caption: TextStyle;
  number: TextStyle;
};

export const typography: Typography = {
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.textTertiary,
  },
  number: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
};
