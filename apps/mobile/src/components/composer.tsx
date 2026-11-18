import { Button, radius, spacing, typography, useTheme } from "@abrigo/ui";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";

export function Composer({
  placeholder,
  sendLabel,
  onSend,
  onTyping,
  disabled,
}: {
  placeholder: string;
  sendLabel: string;
  onSend: (body: string) => Promise<void>;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastTyping = useRef(0);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(body);
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.surfaceSunk,
        borderRadius: radius.xl,
        padding: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.mute}
        value={text}
        editable={!disabled}
        multiline
        maxLength={4000}
        onChangeText={(v) => {
          setText(v);
          const now = Date.now();
          if (now - lastTyping.current > 2500) {
            lastTyping.current = now;
            onTyping();
          }
        }}
        onKeyPress={(e) => {
          const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
          if (ne.key === "Enter" && !ne.shiftKey) {
            (e as unknown as { preventDefault?: () => void }).preventDefault?.();
            void submit();
          }
        }}
        style={[
          typography.body,
          {
            color: colors.ink,
            minHeight: 48,
            maxHeight: 160,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          },
        ]}
      />
      <Button
        label={sendLabel}
        disabled={disabled || !text.trim()}
        loading={sending}
        onPress={submit}
      />
    </View>
  );
}
