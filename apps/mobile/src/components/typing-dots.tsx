import { Text } from "@abrigo/ui";

/** "está escribiendo…" sin animación saltarina. */
export function TypingIndicator({ who, label }: { who: string; label: string }) {
  return (
    <Text variant="caption" color="mute" accessibilityLiveRegion="polite">
      {who} {label}
    </Text>
  );
}
