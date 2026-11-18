import { StyleSheet, View } from "react-native";
import { useTheme } from "./theme";
import type { ColorName } from "./tokens";

const SHAPES: { color: ColorName; top: string; left: string; size: number; rotate: number }[] = [
  { color: "volSun", top: "-6%", left: "62%", size: 260, rotate: -8 },
  { color: "volLeaf", top: "58%", left: "-18%", size: 300, rotate: 6 },
  { color: "volSkin", top: "82%", left: "70%", size: 220, rotate: -4 },
  { color: "volCalm", top: "30%", left: "88%", size: 160, rotate: 8 },
];

/** Volúmenes orgánicos de fondo (eco del HITO). Decorativos. */
export function Volumes() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {SHAPES.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: s.top as `${number}%`,
            left: s.left as `${number}%`,
            width: s.size,
            height: s.size * 0.82,
            borderTopLeftRadius: s.size * 0.6,
            borderTopRightRadius: s.size * 0.45,
            borderBottomLeftRadius: s.size * 0.4,
            borderBottomRightRadius: s.size * 0.55,
            backgroundColor: colors[s.color],
            opacity: 0.55,
            transform: [{ rotate: `${s.rotate}deg` }],
          }}
        />
      ))}
    </View>
  );
}
