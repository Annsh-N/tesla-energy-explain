import { StyleProp, View, ViewStyle } from "react-native";

type SpacerProps = {
  height?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

export function Spacer({ height = 0, width = 0, style }: SpacerProps) {
  return <View style={[{ height, width }, style]} />;
}
