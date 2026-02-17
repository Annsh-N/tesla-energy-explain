import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/tokens";
import { hairlineWidth } from "../theme/theme";

type DividerProps = {
  inset?: number;
  style?: StyleProp<ViewStyle>;
};

export function Divider({ inset = 0, style }: DividerProps) {
  return <View style={[styles.base, inset > 0 && { marginHorizontal: inset }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    height: hairlineWidth,
    backgroundColor: colors.divider,
    width: "100%",
  },
});
