import { Text as RNText, type TextProps } from "react-native";
import { useTheme } from "./theme";
import { typography, type ColorName, type TypographyVariant } from "./tokens";

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
}

export function Text({ variant = "body", color = "ink", style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const role =
    variant === "display" || variant === "heading" || variant === "title" ? "header" : undefined;
  return (
    <RNText
      accessibilityRole={role}
      style={[typography[variant], { color: colors[color] }, style]}
      maxFontSizeMultiplier={2}
      {...rest}
    />
  );
}
