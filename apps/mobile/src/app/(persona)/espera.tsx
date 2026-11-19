import { CRISIS_LINES_BY_PATH } from "@abrigo/shared/client";
import { BreathingCircle, Button, CrisisLineCard, Screen, Stack, Text } from "@abrigo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { t } from "@/copy/es";
import { request } from "@/lib/api";
import { useCurrentAlert, type PublicAlert } from "@/lib/persona";
import { enablePush, pushSupported } from "@/lib/push";
import { getSocket } from "@/lib/socket";

export default function Waiting() {
  const qc = useQueryClient();
  const { data: alert, isLoading, isFetching, refetch } = useCurrentAlert();
  const [pushOn, setPushOn] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Tiempo real + consulta periódica de respaldo (conexiones inestables).
  useEffect(() => {
    let active = true;
    let off: (() => void) | undefined;
    void getSocket("anon").then((socket) => {
      if (!active) return;
      const onUpdate = () => void refetch();
      socket.on("alert:update", onUpdate);
      off = () => socket.off("alert:update", onUpdate);
    });
    const timer = setInterval(() => void refetch(), 15_000);
    return () => {
      active = false;
      off?.();
      clearInterval(timer);
    };
  }, [refetch]);

  useEffect(() => {
    if (
      alert &&
      alert.conversationId &&
      (alert.status === "claimed" || alert.status === "active")
    ) {
      router.replace(`/chat/${alert.conversationId}`);
    }
  }, [alert]);

  if (isLoading || (!alert && isFetching)) return <Screen volumes>{null}</Screen>;
  if (!alert) return <GoHome />;

  if (alert.status === "closed") return <Closed alert={alert} />;

  const lines = CRISIS_LINES_BY_PATH[alert.path];
  const stillSearching = alert.escalationLevel >= 4;
  const widenedGender = alert.helperGenderPref === "woman" && alert.escalationLevel >= 3;
  return (
    <Screen
      volumes
      footer={
        <Button
          variant="quiet"
          label={t.waiting.cancel}
          loading={cancelling}
          onPress={async () => {
            setCancelling(true);
            try {
              await request("POST", `/v1/alerts/${alert.id}/cancel`, { auth: "anon" });
              await qc.invalidateQueries({ queryKey: ["current-alert"] });
              router.replace("/");
            } finally {
              setCancelling(false);
            }
          }}
        />
      }
    >
      <Stack gap="xs">
        <Text variant="heading">{t.waiting.title}</Text>
        <Text variant="body" color="inkSoft" accessibilityLiveRegion="polite">
          {t.waiting.body}
        </Text>
        {widenedGender ? (
          <Text variant="body" accessibilityLiveRegion="polite">
            {t.waiting.widenedGender}
          </Text>
        ) : null}
      </Stack>
      {stillSearching ? (
        <Stack gap="sm">
          <Text variant="body" style={{ fontWeight: "700" }} accessibilityLiveRegion="assertive">
            {t.waiting.stillSearching}
          </Text>
          <CrisisLineCard lines={lines} />
        </Stack>
      ) : null}
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
        <BreathingCircle />
        <Text variant="bodySm" color="inkSoft" style={{ textAlign: "center" }}>
          {t.waiting.breathe}
        </Text>
      </View>
      {pushSupported() ? (
        pushOn ? (
          <Text variant="bodySm" color="inkSoft">
            {t.waiting.notifyOn}
          </Text>
        ) : (
          <Button
            variant="secondary"
            label={t.waiting.notify}
            onPress={async () => setPushOn(await enablePush("anon").catch(() => false))}
          />
        )
      ) : null}
      {stillSearching ? null : <CrisisLineCard title={t.waiting.meanwhile} lines={lines} />}
    </Screen>
  );
}

function Closed({ alert }: { alert: PublicAlert }) {
  const qc = useQueryClient();
  return (
    <Screen
      footer={
        <>
          <Button
            label={t.waiting.retry}
            onPress={async () => {
              await qc.invalidateQueries({ queryKey: ["current-alert"] });
              router.replace("/pedir");
            }}
          />
          <Button variant="secondary" label={t.common.back} onPress={() => router.replace("/")} />
        </>
      }
    >
      <Text variant="heading">Acá seguimos</Text>
      <Text variant="body" color="inkSoft">
        {alert.closeReason === "no_response" ? t.waiting.closedNoResponse : t.chat.closedByYou}
      </Text>
      <CrisisLineCard lines={CRISIS_LINES_BY_PATH[alert.path]} />
    </Screen>
  );
}

function GoHome() {
  useEffect(() => {
    router.replace("/");
  }, []);
  return null;
}
