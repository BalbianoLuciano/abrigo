import { Button, Card, Screen, Stack, Text } from "@abrigo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { t } from "@/copy/es";
import { eraseEverything, useCurrentAlert } from "@/lib/persona";

export default function Home() {
  const { data: alert } = useCurrentAlert();
  const qc = useQueryClient();
  const [confirmErase, setConfirmErase] = useState(false);
  const [erased, setErased] = useState(false);

  const live = alert && alert.status !== "closed" ? alert : null;

  return (
    <Screen
      volumes
      footer={
        <>
          {live ? (
            <Button
              label={
                live.conversationId && live.status === "active"
                  ? t.home.resume
                  : t.home.resumeWaiting
              }
              onPress={() =>
                live.conversationId && live.status === "active"
                  ? router.replace(`/chat/${live.conversationId}`)
                  : router.replace("/espera")
              }
            />
          ) : (
            <Button label={t.home.cta} onPress={() => router.replace("/pedir")} />
          )}
          <Button
            variant="secondary"
            label={t.home.lines}
            onPress={() => router.replace("/lineas")}
          />
        </>
      }
    >
      <Stack gap="md">
        <Text variant="display">{t.home.title}</Text>
        <Text variant="body" color="inkSoft">
          {t.home.body}
        </Text>
        <Text variant="bodySm" color="mute">
          {t.home.notEmergency}
        </Text>
      </Stack>

      {erased ? (
        <Card>
          <Text variant="body">{t.erase.done}</Text>
        </Card>
      ) : confirmErase ? (
        <Card>
          <Text variant="title">{t.erase.title}</Text>
          <Text variant="body" color="inkSoft">
            {t.erase.body}
          </Text>
          <Button
            variant="secondary"
            label={t.erase.confirm}
            onPress={async () => {
              await eraseEverything();
              qc.clear();
              setConfirmErase(false);
              setErased(true);
            }}
          />
          <Button variant="quiet" label={t.common.cancel} onPress={() => setConfirmErase(false)} />
        </Card>
      ) : (
        <Stack gap="xs">
          <Button
            variant="quiet"
            block={false}
            label={t.home.eraseAll}
            onPress={() => setConfirmErase(true)}
          />
          <Button
            variant="quiet"
            block={false}
            label={t.home.helperLink}
            onPress={() => router.push("/ayudante")}
          />
        </Stack>
      )}
    </Screen>
  );
}
