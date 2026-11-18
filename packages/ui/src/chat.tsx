import { StyleSheet, View } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing } from "./tokens";

/** Burbuja de chat. `self`: lo que escribo yo. `other`: lo que escribe la otra persona. */
export function ChatBubble({
  side,
  body,
  author,
}: {
  side: "self" | "other" | "system";
  body: string;
  author?: string;
}) {
  const { colors } = useTheme();
  if (side === "system") {
    return (
      <View style={styles.system}>
        <Text variant="caption" color="mute" style={{ textAlign: "center" }}>
          {body}
        </Text>
      </View>
    );
  }
  const self = side === "self";
  return (
    <View
      style={[
        styles.bubble,
        self
          ? {
              alignSelf: "flex-end",
              backgroundColor: colors.primaryTint,
              borderBottomRightRadius: radius.sm,
            }
          : {
              alignSelf: "flex-start",
              backgroundColor: colors.surface,
              borderColor: colors.hairline,
              borderWidth: 1,
              borderBottomLeftRadius: radius.sm,
            },
      ]}
    >
      {author ? (
        <Text variant="caption" color="embrace" style={{ fontWeight: "700" }}>
          {author}
        </Text>
      ) : null}
      <Text variant="body" selectable>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  system: { alignSelf: "center", paddingVertical: spacing.xs, maxWidth: "90%" },
});
