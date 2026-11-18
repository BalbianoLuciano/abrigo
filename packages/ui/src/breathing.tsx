import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "./theme";
import { motion } from "./tokens";

/**
 * Espera que respira: un volumen que se expande 4 s y se contrae 4 s.
 * Con movimiento reducido, el círculo queda quieto.
 */
export function BreathingCircle({ size = 180 }: { size?: number }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.72)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduced) {
      scale.setValue(0.86);
      return;
    }
    const half = motion.breathCycle / 2;
    const ease = Easing.bezier(0.45, 0, 0.55, 1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
        Animated.timing(scale, {
          toValue: 0.72,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale]);

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.volLeaf,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: "center", justifyContent: "center" } });
