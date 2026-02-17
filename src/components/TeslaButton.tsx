import { ReactNode } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

type TeslaButtonVariant = "primary" | "secondary";

type TeslaButtonProps = {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: TeslaButtonVariant;
  disabled?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const buttonHeight = 52;
const pressedOpacity = 0.85;

export function TeslaButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  leftIcon,
  style,
  textStyle,
}: TeslaButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <Text
          style={[
            styles.label,
            variant === "primary" ? styles.primaryLabel : styles.secondaryLabel,
            disabled && styles.disabledLabel,
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    height: buttonHeight,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.buttonPrimary,
  },
  secondary: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryLabel: {
    color: colors.buttonPrimaryText,
  },
  secondaryLabel: {
    color: colors.buttonSecondaryText,
  },
  disabledLabel: {
    color: colors.textTertiary,
  },
});
