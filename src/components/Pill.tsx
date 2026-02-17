import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";
import { typography } from "../theme/typography";

type IconName = ComponentProps<typeof Ionicons>["name"];
type PillVariant = "default" | "active" | "disabled";

type PillProps = {
  label: string;
  iconName?: IconName;
  variant?: PillVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const iconSize = 13;

export function Pill({ label, iconName, variant = "default", style, textStyle }: PillProps) {
  return (
    <View style={[styles.container, variant === "active" && styles.activeContainer, variant === "disabled" && styles.disabledContainer, style]}>
      {iconName ? <Ionicons name={iconName} size={iconSize} color={variant === "disabled" ? colors.textTertiary : colors.icon} style={styles.icon} /> : null}
      <Text style={[styles.label, variant === "active" && styles.activeLabel, variant === "disabled" && styles.disabledLabel, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  activeContainer: {
    backgroundColor: colors.surface3,
    borderColor: colors.divider,
  },
  disabledContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  activeLabel: {
    color: colors.textPrimary,
  },
  disabledLabel: {
    color: colors.textTertiary,
  },
});
