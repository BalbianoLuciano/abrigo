import { Button, Card, CheckList, ChoiceList, Screen, Stack, Text, useTheme } from "@abrigo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { ApiError, request } from "@/lib/api";
import { backToDashboard, formatMinute, type NotificationPrefs } from "@/lib/helper-settings";

type Channel = "webPush" | "email" | "telegram";
type Quiet = "none" | "night" | "late";

const QUIET: Record<Quiet, [number, number] | null> = {
  none: null,
  night: [23 * 60, 7 * 60],
  late: [0, 8 * 60],
};

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const prefs = useQuery({
    queryKey: ["helper-prefs"],
    queryFn: () =>
      request<NotificationPrefs>("GET", "/v1/helper/notification-prefs", { auth: "staff" }),
  });
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [quiet, setQuiet] = useState<Quiet>("none");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    const p = prefs.data;
    if (!p || channels) return;
    setChannels((["webPush", "email", "telegram"] as const).filter((c) => p[c]) as Channel[]);
    const match = (Object.keys(QUIET) as Quiet[]).find((k) => {
      const v = QUIET[k];
      return v ? v[0] === p.quietStartMin && v[1] === p.quietEndMin : p.quietStartMin === null;
    });
    setQuiet(match ?? "none");
  }, [prefs.data, channels]);

  if (!prefs.data || !channels) return <Screen>{null}</Screen>;
  const p = prefs.data;
  const custom =
    p.quietStartMin !== null &&
    !Object.values(QUIET).some((v) => v && v[0] === p.quietStartMin && v[1] === p.quietEndMin);

  async function save() {
    setBusy(true);
    setNote(null);
    const q = QUIET[quiet];
    try {
      const saved = await request<NotificationPrefs>("PUT", "/v1/helper/notification-prefs", {
        auth: "staff",
        body: {
          webPush: channels!.includes("webPush"),
          email: channels!.includes("email"),
          telegram: channels!.includes("telegram"),
          quietStartMin: q ? q[0] : null,
          quietEndMin: q ? q[1] : null,
        },
      });
      qc.setQueryData(["helper-prefs"], saved);
      setNote("Guardado.");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function linkTelegram() {
    setNote(null);
    try {
      const res = await request<{ url: string | null }>("POST", "/v1/helper/telegram/link", {
        auth: "staff",
      });
      if (res.url) {
        setLinkUrl(res.url);
        await Linking.openURL(res.url);
      }
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "No se pudo generar el enlace.");
    }
  }

  async function unlinkTelegram() {
    await request("DELETE", "/v1/helper/telegram", { auth: "staff" });
    await qc.invalidateQueries({ queryKey: ["helper-prefs"] });
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Guardar" loading={busy} onPress={save} />
          <Button variant="quiet" label="Volver" onPress={() => void backToDashboard()} />
        </>
      }
    >
      <Stack gap="xs">
        <Text variant="heading">Avisos</Text>
        <Text variant="body" color="inkSoft">
          Solo te avisamos cuando estás de guardia. Los avisos nunca dicen dónde está la persona.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Por dónde</Text>
        <CheckList
          accessibilityLabel="Canales"
          values={channels}
          onChange={setChannels}
          options={[
            { value: "webPush", label: "Notificaciones de este dispositivo" },
            { value: "email", label: "Email" },
            ...(p.telegramAvailable
              ? [
                  {
                    value: "telegram" as const,
                    label: "Telegram",
                    hint: p.telegramLinked ? "Vinculado" : "Primero vinculá tu cuenta",
                  },
                ]
              : []),
          ]}
        />
        {!channels.length ? (
          <Text variant="bodySm" style={{ color: colors.dangerForm }}>
            Sin ningún canal no vas a enterarte de los pedidos.
          </Text>
        ) : null}
      </Stack>

      {p.telegramAvailable ? (
        <Card>
          <Text variant="title">Telegram</Text>
          {p.telegramLinked ? (
            <Button variant="secondary" label="Desvincular Telegram" onPress={unlinkTelegram} />
          ) : (
            <>
              <Text variant="bodySm" color="inkSoft">
                Se abre el bot de Abrigo con un código de un solo uso que vence en 15 minutos.
              </Text>
              <Button variant="secondary" label="Vincular Telegram" onPress={linkTelegram} />
              {linkUrl ? (
                <Button
                  variant="quiet"
                  label="Ya lo vinculé"
                  onPress={() => qc.invalidateQueries({ queryKey: ["helper-prefs"] })}
                />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <Stack gap="sm">
        <Text variant="title">Horario de silencio</Text>
        {custom ? (
          <Text variant="bodySm" color="inkSoft">
            Ahora: de {formatMinute(p.quietStartMin!)} a {formatMinute(p.quietEndMin!)}.
          </Text>
        ) : null}
        <ChoiceList
          accessibilityLabel="Horario de silencio"
          value={quiet}
          onChange={setQuiet}
          options={[
            { value: "none", label: "Sin horario de silencio" },
            { value: "night", label: "De 23 a 7" },
            { value: "late", label: "De 0 a 8" },
          ]}
        />
      </Stack>
      {note ? (
        <Text variant="bodySm" color="inkSoft" accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </Screen>
  );
}
