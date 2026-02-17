import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";
import { shadow } from "../theme/theme";

type CardVariant = "default" | "flat";

type CardProps = PropsWithChildren<{
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, variant = "default", style }: CardProps) {
  return (
    <View style={[styles.base, variant === "default" ? styles.default : styles.flat, variant === "default" && shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  default: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  flat: {
    backgroundColor: colors.surface,
    borderWidth: 0,
  },
});
