import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { EnergyOverviewScreen } from "./screens/EnergyOverviewScreen";
import { ExplainScreen } from "./screens/ExplainScreen";
import { theme } from "./theme/theme";

export type RootStackParamList = {
  EnergyOverview: undefined;
  Explain: {
    startMin: number;
    endMin: number;
    dayDateLabel?: string;
  };
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
      <Stack.Screen name="Explain" component={ExplainScreen} />
    </Stack.Navigator>
  );
}
