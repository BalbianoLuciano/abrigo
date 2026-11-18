import { View } from "react-native";
import { useTheme } from "./theme";
import { radius } from "./tokens";

/** Progreso suave y sin números. */
export function SoftProgress({ value }: { value: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0.08, Math.min(1, value));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        height: 6,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceSunk,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: 6,
          borderRadius: radius.full,
          backgroundColor: colors.volLeaf,
        }}
      />
    </View>
  );
}
