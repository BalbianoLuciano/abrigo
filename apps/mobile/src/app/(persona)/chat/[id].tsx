import { CRISIS_LINES_BY_PATH, PROFESSION_LABELS, type Profession } from "@abrigo/shared/client";
import {
  Button,
  Card,
  ChatBubble,
  ChoiceList,
  CrisisLineCard,
  READING_WIDTH,
  Stack,
  Text,
  spacing,
  useTheme,
} from "@abrigo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Composer } from "@/components/composer";
import { TypingIndicator } from "@/components/typing-dots";
import { reportReasons, t } from "@/copy/es";
import { request } from "@/lib/api";
import { useConversation } from "@/lib/conversation";
import { useCurrentAlert } from "@/lib/persona";

type Panel = null | "menu" | "end" | "another" | "report" | "lines" | "reported";
const RELEASE_REASONS = ["reassigned", "no_first_message", "helper_suspended"];

export default function PersonaChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { data: alert } = useCurrentAlert();
  const conv = useConversation(id, "anon");
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState<(typeof reportReasons)[number]["value"] | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (conv.closed?.reason && RELEASE_REASONS.includes(conv.closed.reason)) {
      void qc
        .invalidateQueries({ queryKey: ["current-alert"] })
        .then(() => router.replace("/espera"));
    }
  }, [conv.closed, qc]);

  const helper = conv.summary?.helper;
  const helperLabel = helper
    ? `${helper.firstName} · ${PROFESSION_LABELS[helper.profession as Profession] ?? helper.profession} ${t.chat.verified}`
    : "";
  const path = alert?.path ?? "mental_health";
  const ended = Boolean(conv.closed);
  const hasHelperMessage = conv.messages.some((m) => m.sender === "helper");

  async function act(kind: "end" | "another") {
    if (!alert) return;
    if (kind === "end") {
      await request("POST", `/v1/conversations/${id}/close`, { auth: "anon", body: {} });
      conv.setClosed({ by: "anon", reason: "closed" });
    } else {
      await request("POST", `/v1/alerts/${alert.id}/reassign`, { auth: "anon" });
      await qc.invalidateQueries({ queryKey: ["current-alert"] });
      router.replace("/espera");
    }
    setPanel(null);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: 72, paddingHorizontal: spacing.lg, gap: spacing.xs }}>
        <View
          style={{ maxWidth: READING_WIDTH, width: "100%", alignSelf: "center", gap: spacing.xs }}
        >
          <Text variant="heading">{helper ? `Te escucha ${helper.firstName}` : "Acá estamos"}</Text>
          {helper ? (
            <Text variant="bodySm" color="embrace">
              {helperLabel}
            </Text>
          ) : null}
          <Button
            variant="quiet"
            block={false}
            label={panel ? "Cerrar opciones" : "Opciones"}
            onPress={() => setPanel(panel ? null : "menu")}
          />
        </View>
      </View>

      <ScrollView
        ref={scroller}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        accessibilityLabel="Mensajes"
      >
        <View
          style={{ maxWidth: READING_WIDTH, width: "100%", alignSelf: "center", gap: spacing.sm }}
        >
          {panel ? (
            <Card>
              {panel === "menu" ? (
                <Stack gap="sm">
                  <Button
                    variant="secondary"
                    label={t.chat.lines}
                    onPress={() => setPanel("lines")}
                  />
                  {!ended ? (
                    <>
                      <Button
                        variant="secondary"
                        label={t.chat.another}
                        onPress={() => setPanel("another")}
                      />
                      <Button
                        variant="secondary"
                        label={t.chat.end}
                        onPress={() => setPanel("end")}
                      />
                    </>
                  ) : null}
                  <Button
                    variant="secondary"
                    label={t.chat.report}
                    onPress={() => setPanel("report")}
                  />
                </Stack>
              ) : panel === "lines" ? (
                <CrisisLineCard lines={CRISIS_LINES_BY_PATH[path]} />
              ) : panel === "end" || panel === "another" ? (
                <Stack gap="sm">
                  <Text variant="title">
                    {panel === "end" ? t.chat.endConfirm : t.chat.anotherConfirm}
                  </Text>
                  <Button
                    variant="secondary"
                    label={panel === "end" ? t.chat.end : t.chat.another}
                    onPress={() => void act(panel)}
                  />
                  <Button variant="quiet" label={t.common.cancel} onPress={() => setPanel(null)} />
                </Stack>
              ) : panel === "report" ? (
                <Stack gap="sm">
                  <Text variant="title">{t.chat.reportTitle}</Text>
                  <ChoiceList
                    accessibilityLabel={t.chat.reportTitle}
                    value={reason}
                    onChange={setReason}
                    options={reportReasons}
                  />
                  <Button
                    variant="secondary"
                    label="Enviar reporte"
                    disabled={!reason}
                    onPress={async () => {
                      await request("POST", `/v1/conversations/${id}/report`, {
                        auth: "anon",
                        body: { reason },
                      });
                      setPanel("reported");
                    }}
                  />
                </Stack>
              ) : (
                <Stack gap="sm">
                  <Text variant="body">{t.chat.reportSent}</Text>
                  {!ended ? (
                    <Button
                      variant="secondary"
                      label={t.chat.another}
                      onPress={() => setPanel("another")}
                    />
                  ) : null}
                </Stack>
              )}
            </Card>
          ) : null}

          {!hasHelperMessage && !ended ? (
            <ChatBubble side="system" body={t.waiting.claimed} />
          ) : null}
          {conv.messages.map((m) => (
            <ChatBubble
              key={m.id}
              side={m.sender === "anon" ? "self" : m.sender === "helper" ? "other" : "system"}
              body={m.body}
              {...(m.sender === "helper" && helper ? { author: helper.firstName } : {})}
            />
          ))}
          {conv.otherTyping && helper ? (
            <TypingIndicator who={helper.firstName} label={t.chat.typing} />
          ) : null}
          {ended ? (
            <Card>
              <Text variant="body">
                {conv.closed?.by === "anon" ? t.chat.closedByYou : t.chat.closedByHelper}
              </Text>
              <CrisisLineCard
                title="Si lo necesitás, estas líneas atienden ahora"
                lines={CRISIS_LINES_BY_PATH[path]}
              />
              <Button
                variant="secondary"
                label={t.common.back}
                onPress={() => router.replace("/")}
              />
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {!ended ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ maxWidth: READING_WIDTH, width: "100%", alignSelf: "center" }}>
            <Composer
              placeholder={t.chat.composer}
              sendLabel={t.chat.send}
              onSend={conv.send}
              onTyping={conv.notifyTyping}
            />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
