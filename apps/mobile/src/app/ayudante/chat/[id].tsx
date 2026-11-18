import { CRISIS_LINES_BY_PATH } from "@abrigo/shared/client";
import {
  Button,
  Card,
  ChatBubble,
  CrisisLineCard,
  Field,
  READING_WIDTH,
  Stack,
  Text,
  spacing,
  useTheme,
} from "@abrigo/ui";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type React from "react";
import { useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Composer } from "@/components/composer";
import { TypingIndicator } from "@/components/typing-dots";
import { request } from "@/lib/api";
import { useConversation } from "@/lib/conversation";

const FIRST_CONTACT = [
  "Presentate con tu nombre de pila y agradecé que haya escrito.",
  "Preguntá si está en un lugar seguro para conversar.",
  "Escuchá sin juzgar ni apurar. No prometas lo que no podés cumplir.",
  "Si hay riesgo de vida, compartí las líneas y alentá a llamar ahora.",
  "No pidas datos personales ni propongas encuentros.",
  "Antes de cerrar, acordá qué puede hacer después y dejale las líneas.",
];

interface ActiveConversation {
  id: string;
  path: "mental_health" | "violence";
  dangerNow: "yes" | "unsure" | "no";
  safeTimeToWrite: "yes" | "little" | "no" | null;
}

export default function HelperChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const conv = useConversation(id, "staff");
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const meta = useQuery({
    queryKey: ["helper-conversations"],
    queryFn: () =>
      request<{ conversations: ActiveConversation[] }>("GET", "/v1/helper/conversations", {
        auth: "staff",
      }),
  });
  const info = meta.data?.conversations.find((c) => c.id === id);
  const path = info?.path ?? "mental_health";
  const ended = Boolean(conv.closed);

  async function close() {
    await request("POST", `/v1/conversations/${id}/close`, {
      auth: "staff",
      body: note.trim() ? { helperNote: note.trim() } : {},
    });
    conv.setClosed({ by: "helper", reason: "closed" });
    setClosing(false);
  }

  const panel = (
    <Stack gap="md">
      {info?.dangerNow && info.dangerNow !== "no" ? (
        <Text variant="body" color="urgent" style={{ fontWeight: "700" }}>
          {info.dangerNow === "yes" ? "Indicó que está en peligro." : "No sabe si está en peligro."}
        </Text>
      ) : null}
      {info?.safeTimeToWrite && info.safeTimeToWrite !== "yes" ? (
        <Text variant="bodySm" color="inkSoft">
          Puede que no tenga mucho tiempo seguro para escribir.
        </Text>
      ) : null}
      <CrisisLineCard title="Líneas de derivación" lines={CRISIS_LINES_BY_PATH[path]} />
      <Card>
        <Text variant="title">Guía de primer contacto</Text>
        {FIRST_CONTACT.map((g) => (
          <Text key={g} variant="bodySm">
            · {g}
          </Text>
        ))}
      </Card>
      {!ended ? (
        closing ? (
          <Card>
            <Field
              label="Resumen privado (opcional)"
              hint="Solo lo ves vos. Se guarda cifrado. No incluyas datos que identifiquen a la persona."
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={2000}
            />
            <Button label="Cerrar la conversación" onPress={close} />
            <Button variant="quiet" label="Volver" onPress={() => setClosing(false)} />
          </Card>
        ) : (
          <Button
            variant="secondary"
            label="Cerrar conversación"
            onPress={() => setClosing(true)}
          />
        )
      ) : null}
    </Stack>
  );

  return (
    <View
      style={{ flex: 1, flexDirection: wide ? "row" : "column", backgroundColor: colors.canvas }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg, gap: spacing.xs }}>
          <Button
            variant="quiet"
            block={false}
            label="← Volver al panel"
            onPress={() => router.replace("/ayudante")}
          />
          <Text variant="heading">Conversación</Text>
        </View>
        <ScrollView
          ref={scroller}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        >
          <View
            style={{ maxWidth: READING_WIDTH, width: "100%", alignSelf: "center", gap: spacing.sm }}
          >
            {conv.messages.length === 0 && !ended ? (
              <ChatBubble
                side="system"
                body="Escribí el primer mensaje: tenés 3 minutos antes de que el pedido vuelva a quedar abierto."
              />
            ) : null}
            {conv.messages.map((m) => (
              <ChatBubble
                key={m.id}
                side={m.sender === "helper" ? "self" : m.sender === "anon" ? "other" : "system"}
                body={m.body}
              />
            ))}
            {conv.otherTyping ? (
              <TypingIndicator who="La persona" label="está escribiendo…" />
            ) : null}
            {ended ? (
              <ChatBubble
                side="system"
                body={
                  conv.closed?.reason === "reassigned"
                    ? "La persona pidió hablar con otra persona."
                    : conv.closed?.reason === "no_first_message"
                      ? "El pedido volvió a quedar abierto porque no hubo primer mensaje a tiempo."
                      : "La conversación terminó."
                }
              />
            ) : null}
            {!wide ? panel : null}
          </View>
        </ScrollView>
        {!ended ? (
          <View style={{ padding: spacing.lg }}>
            <View style={{ maxWidth: READING_WIDTH, width: "100%", alignSelf: "center" }}>
              <Composer
                placeholder="Escribí tu mensaje"
                sendLabel="Enviar"
                onSend={conv.send}
                onTyping={conv.notifyTyping}
              />
            </View>
          </View>
        ) : null}
      </View>
      {wide ? (
        <ScrollView
          style={{ width: 380, flexGrow: 0, borderLeftWidth: 1, borderColor: colors.hairline }}
          contentContainerStyle={{ padding: spacing.lg }}
        >
          {panel}
        </ScrollView>
      ) : null}
    </View>
  );
}
