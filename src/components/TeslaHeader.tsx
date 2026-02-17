import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius } from "../theme/tokens";
import { typography } from "../theme/typography";
import { Divider } from "./Divider";

type IconName = ComponentProps<typeof Ionicons>["name"];

type TeslaHeaderProps = {
  title: string;
  size?: "title" | "subtitle";
  leftIconName?: IconName;
  onLeftPress?: () => void;
  rightIconName?: IconName;
  onRightPress?: () => void;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

const headerHeight = 56;
const iconSize = 20;
const iconHitArea = 32;

export function TeslaHeader({
  title,
  size = "subtitle",
  leftIconName,
  onLeftPress,
  rightIconName,
  onRightPress,
  showDivider = false,
  style,
}: TeslaHeaderProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        <View style={styles.leftContainer}>
          {leftIconName ? (
            <Pressable onPress={onLeftPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, styles.leftIconButton]}>
              <Ionicons name={leftIconName} size={iconSize} color={colors.icon} />
            </Pressable>
          ) : null}
          <Text style={size === "title" ? styles.title : styles.subtitle}>{title}</Text>
        </View>
        {rightIconName ? (
          <Pressable onPress={onRightPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name={rightIconName} size={iconSize} color={colors.icon} />
          </Pressable>
        ) : null}
      </View>
      {showDivider ? <Divider /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: headerHeight,
    justifyContent: "center",
  },
  row: {
    minHeight: headerHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
  },
  iconButton: {
    width: iconHitArea,
    height: iconHitArea,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  leftIconButton: {
    marginRight: 10,
  },
  pressed: {
    opacity: 0.85,
  },
});
