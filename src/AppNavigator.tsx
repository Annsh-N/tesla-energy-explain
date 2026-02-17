import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { EnergyOverviewScreen } from "./screens/EnergyOverviewScreen";
import { theme } from "./theme/theme";

export type RootStackParamList = {
  EnergyOverview: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="EnergyOverview" component={EnergyOverviewScreen} />
    </Stack.Navigator>
  );
}
