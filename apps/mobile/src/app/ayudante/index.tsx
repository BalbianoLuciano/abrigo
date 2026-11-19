import { ALERT_PATH_LABELS, regionName } from "@abrigo/shared/client";
import { Button, Card, Field, Screen, Stack, Text, radius, spacing, useTheme } from "@abrigo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { AlertsMap } from "@/components/alerts-map";
import { ApiError, request } from "@/lib/api";
import type { Coverage } from "@/lib/helper-settings";
import { enablePush, pushSupported } from "@/lib/push";
import { getSocket } from "@/lib/socket";
import {
  confirmTotpSetup,
  signIn,
  signOut,
  startTotpSetup,
  useStaffMe,
  verifyTotp,
  type StaffMe,
} from "@/lib/staff";

export default function HelperHome() {
  const { data: me, isLoading } = useStaffMe();
  if (isLoading) return <Screen>{null}</Screen>;
  if (!me) return <Login />;
  if (!me.twoFactorEnabled) return <TotpSetup />;
  if (me.role === "admin") return <AdminEntry me={me} />;
  if (me.status === "pending") return <Pending />;
  if (me.status === "rejected") return <Rejected />;
  return <Dashboard me={me} />;
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : "Algo falló. Probá de nuevo.";
}

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      if (!needsTotp) {
        const res = await signIn(email.trim(), password);
        if (res.needsTotp) {
          setNeedsTotp(true);
          return;
        }
      } else {
        await verifyTotp(code.trim());
      }
      await qc.invalidateQueries({ queryKey: ["staff-me"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label={needsTotp ? "Verificar" : "Ingresar"} loading={busy} onPress={submit} />
          <Button
            variant="quiet"
            label="Quiero sumarme como ayudante"
            onPress={() => router.push("/ayudante/registro")}
          />
        </>
      }
    >
      <Text variant="heading">Ingreso de ayudantes</Text>
      {needsTotp ? (
        <Field
          label="Código de tu app de autenticación"
          hint="Los 6 números que muestra la app."
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          error={error}
        />
      ) : (
        <Stack gap="md">
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            error={error}
          />
        </Stack>
      )}
      <Link href="/" replace>
        <Text variant="bodySm" color="primary">
          Volver al inicio
        </Text>
      </Link>
    </Screen>
  );
}

function TotpSetup() {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await startTotpSetup(password);
      setUri(res.totpURI);
      setBackup(res.backupCodes);
      const svg = await QRCode.toString(res.totpURI, { type: "svg", margin: 1 });
      setQr(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      await confirmTotpSetup(code.trim());
      await qc.invalidateQueries({ queryKey: ["staff-me"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const secret = uri ? new URL(uri).searchParams.get("secret") : null;

  return (
    <Screen
      footer={
        uri ? (
          <Button label="Confirmar código" loading={busy} onPress={confirm} />
        ) : (
          <Button label="Continuar" loading={busy} onPress={start} />
        )
      }
    >
      <Text variant="heading">Verificación en dos pasos</Text>
      <Text variant="body" color="inkSoft">
        Para cuidar a las personas que piden ayuda, todas las cuentas de ayudantes usan una app de
        autenticación (por ejemplo, Google Authenticator, 1Password o Aegis).
      </Text>
      {!uri ? (
        <Field
          label="Tu contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={error}
        />
      ) : (
        <Stack gap="md">
          {qr ? (
            <Image
              source={{ uri: qr }}
              style={{
                width: 200,
                height: 200,
                alignSelf: "center",
                borderRadius: radius.md,
                backgroundColor: "#fff",
              }}
              accessibilityLabel="Código QR para la app de autenticación"
            />
          ) : null}
          {secret ? (
            <Text variant="bodySm" selectable>
              Si no podés escanear, cargá esta clave: {secret}
            </Text>
          ) : null}
          <Card>
            <Text variant="title">Códigos de respaldo</Text>
            <Text variant="bodySm" color="inkSoft">
              Guardalos en un lugar seguro. Sirven si perdés el teléfono.
            </Text>
            <Text variant="bodySm" selectable>
              {backup.join("  ")}
            </Text>
          </Card>
          <Field
            label="Código de 6 números"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            error={error}
          />
        </Stack>
      )}
    </Screen>
  );
}

function Pending() {
  return (
    <Screen footer={<SignOutButton />}>
      <Text variant="heading">Gracias por sumarte</Text>
      <Text variant="body" color="inkSoft">
        Tu solicitud está en revisión. Verificamos tu matrícula u organización antes de habilitar la
        cuenta. Te vamos a avisar por email.
      </Text>
    </Screen>
  );
}

function Rejected() {
  return (
    <Screen footer={<SignOutButton />}>
      <Text variant="heading">No pudimos aprobar tu solicitud</Text>
      <Text variant="body" color="inkSoft">
        Si creés que es un error, escribinos a hola@abrigo.ar.
      </Text>
    </Screen>
  );
}

function AdminEntry({ me }: { me: StaffMe }) {
  return (
    <Screen footer={<SignOutButton />}>
      <Text variant="heading">Hola{me.firstName ? `, ${me.firstName}` : ""}</Text>
      <Button label="Ir al panel de administración" onPress={() => router.replace("/admin")} />
    </Screen>
  );
}

function SignOutButton() {
  const qc = useQueryClient();
  return (
    <Button
      variant="quiet"
      label="Cerrar sesión"
      onPress={async () => {
        await signOut();
        qc.clear();
      }}
    />
  );
}

interface OpenAlert {
  id: string;
  path: "mental_health" | "violence";
  dangerNow: "yes" | "unsure" | "no";
  safeTimeToWrite: "yes" | "little" | "no" | null;
  helperGenderPref: "woman" | "any" | null;
  regionCode: string | null;
  h3Cell: string | null;
  escalationLevel: number;
  createdAt: string;
}

interface ActiveConversation {
  id: string;
  path: "mental_health" | "violence";
  status: string;
  startedAt: string;
}

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "recién" : m === 1 ? "hace 1 minuto" : `hace ${m} minutos`;
}

function Dashboard({ me }: { me: StaffMe }) {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const onCall = Boolean(me.isOnCall);
  const select = useCallback((id: string) => setSelected(id), []);

  const coverage = useQuery({
    queryKey: ["helper-coverage"],
    queryFn: () => request<Coverage>("GET", "/v1/helper/coverage", { auth: "staff" }),
  });
  const noZone = coverage.data && !coverage.data.circle && coverage.data.regionCodes.length === 0;

  const alerts = useQuery({
    queryKey: ["helper-alerts"],
    queryFn: () => request<{ alerts: OpenAlert[] }>("GET", "/v1/helper/alerts", { auth: "staff" }),
    refetchInterval: 30_000,
  });
  const conversations = useQuery({
    queryKey: ["helper-conversations"],
    queryFn: () =>
      request<{ conversations: ActiveConversation[] }>("GET", "/v1/helper/conversations", {
        auth: "staff",
      }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    let off: (() => void) | undefined;
    void getSocket("staff").then((socket) => {
      const refresh = () => void qc.invalidateQueries({ queryKey: ["helper-alerts"] });
      socket.on("alerts:changed", refresh);
      off = () => socket.off("alerts:changed", refresh);
    });
    return () => off?.();
  }, [qc]);

  async function toggleOnCall() {
    setError(null);
    try {
      await request("PATCH", "/v1/helper/availability", {
        auth: "staff",
        body: { isOnCall: !onCall },
      });
      if (!onCall && pushSupported() && !pushOn)
        setPushOn(await enablePush("staff").catch(() => false));
      await qc.invalidateQueries({ queryKey: ["staff-me"] });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function claim(id: string) {
    setError(null);
    try {
      const res = await request<{ conversationId: string }>(
        "POST",
        `/v1/helper/alerts/${id}/claim`,
        {
          auth: "staff",
        },
      );
      router.push(`/ayudante/chat/${res.conversationId}`);
    } catch (err) {
      setError(errorText(err));
      await qc.invalidateQueries({ queryKey: ["helper-alerts"] });
    }
  }

  return (
    <Screen footer={<SignOutButton />}>
      <Stack gap="xs">
        <Text variant="heading">Hola, {me.firstName}</Text>
        <Text variant="body" color="inkSoft">
          {onCall
            ? "Estás de guardia. Te avisamos cuando alguien pida ayuda."
            : "No estás de guardia."}
        </Text>
      </Stack>
      <Button
        variant={onCall ? "secondary" : "primary"}
        label={onCall ? "Pausar mi guardia" : "Estoy de guardia"}
        onPress={toggleOnCall}
      />
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button
          variant="quiet"
          block={false}
          label="Tu zona"
          onPress={() => router.push("/ayudante/zona")}
        />
        <Button
          variant="quiet"
          block={false}
          label="Avisos"
          onPress={() => router.push("/ayudante/avisos")}
        />
      </View>
      {noZone ? (
        <Card>
          <Text variant="body">
            Marcá tu zona para recibir primero los pedidos cercanos: conocés los recursos de ahí.
          </Text>
          <Button
            variant="secondary"
            label="Marcar mi zona"
            onPress={() => router.push("/ayudante/zona")}
          />
        </Card>
      ) : null}
      {error ? (
        <Text
          variant="body"
          style={{ color: colors.dangerForm }}
          accessibilityLiveRegion="assertive"
        >
          {error}
        </Text>
      ) : null}

      {conversations.data?.conversations.length ? (
        <Stack gap="sm">
          <Text variant="title">Tus conversaciones en curso</Text>
          {conversations.data.conversations.map((c) => (
            <Card key={c.id}>
              <Text variant="body">
                {ALERT_PATH_LABELS[c.path]} · {minutesAgo(c.startedAt)}
              </Text>
              <Button
                variant="secondary"
                label="Abrir conversación"
                onPress={() => router.push(`/ayudante/chat/${c.id}`)}
              />
            </Card>
          ))}
        </Stack>
      ) : null}

      <Stack gap="sm">
        <Text variant="title">Pedidos abiertos</Text>
        {alerts.data?.alerts.length === 0 ? (
          <Text variant="body" color="inkSoft">
            {onCall
              ? "No hay pedidos abiertos para vos en este momento."
              : "Ponete de guardia para ver los pedidos abiertos."}
          </Text>
        ) : null}
        {alerts.data?.alerts.length ? (
          <AlertsMap
            alerts={alerts.data.alerts}
            coverage={coverage.data?.circle ?? null}
            selectedId={selected}
            onSelect={select}
          />
        ) : null}
        {alerts.data?.alerts.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: a.id === selected ? colors.primaryTint : colors.surface,
              borderColor: a.id === selected ? colors.primary : colors.hairline,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <Text variant="title">{ALERT_PATH_LABELS[a.path]}</Text>
            {a.dangerNow !== "no" ? (
              <Text variant="bodySm" color="urgent" style={{ fontWeight: "700" }}>
                {a.dangerNow === "yes"
                  ? "Indicó que está en peligro"
                  : "No sabe si está en peligro"}
              </Text>
            ) : null}
            <Text variant="bodySm" color="inkSoft">
              {minutesAgo(a.createdAt)}
              {a.regionCode
                ? ` · ${regionName(a.regionCode)}`
                : a.h3Cell
                  ? " · zona aproximada compartida"
                  : ""}
              {a.safeTimeToWrite === "no" ? " · puede tener que irse pronto" : ""}
              {a.helperGenderPref === "woman" ? " · prefiere que le escriba una mujer" : ""}
              {a.escalationLevel >= 3 ? " · lleva más de 10 minutos esperando" : ""}
            </Text>
            <Button label="Tomar esta conversación" onPress={() => claim(a.id)} />
          </View>
        ))}
      </Stack>
    </Screen>
  );
}
