import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing, typography } from "./tokens";

export interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  /** Solo del lado ayudante/admin. */
  error?: string | undefined;
}

export function Field({ label, hint, error, style, ...rest }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="bodySm" style={{ fontWeight: "700" }} nativeID={`${label}-label`}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" color="mute">
          {hint}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        aria-labelledby={`${label}-label`}
        placeholderTextColor={colors.mute}
        style={[
          typography.body,
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.dangerForm : colors.hairline,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          variant="caption"
          style={{ color: colors.dangerForm }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
