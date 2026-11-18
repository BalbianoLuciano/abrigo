import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_700Bold,
} from "@expo-google-fonts/atkinson-hyperlegible-next";
import { Fraunces_400Regular, Fraunces_500Medium } from "@expo-google-fonts/fraunces";
import { ThemeProvider, useTheme } from "@abrigo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { WebGlobalStyles } from "@/components/web-global-styles";
import { queryClient } from "@/lib/query";

export default function RootLayout() {
  // Si las fuentes tardan, se muestra el texto con la fuente del sistema: nunca una pantalla en blanco.
  useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function Shell() {
  const { colors, scheme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <WebGlobalStyles />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
      />
    </View>
  );
}
