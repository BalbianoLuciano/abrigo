import { useTheme } from "@abrigo/ui";
import { Stack } from "expo-router";

export default function HelperLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}
