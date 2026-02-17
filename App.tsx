import { StatusBar } from "expo-status-bar";
import {
  DarkTheme as NavigationDarkTheme,
  NavigationContainer,
  Theme as NavigationTheme,
} from "@react-navigation/native";
import { AppNavigator } from "./src/AppNavigator";
import { theme } from "./src/theme/theme";

const navigationTheme: NavigationTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.background,
    border: theme.colors.divider,
    text: theme.colors.textPrimary,
    primary: theme.colors.textPrimary,
    notification: theme.colors.textPrimary,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}
