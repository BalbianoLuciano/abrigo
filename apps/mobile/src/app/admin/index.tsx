import { PROFESSION_LABELS, regionName, type Profession } from "@abrigo/shared/client";
import { Button, Card, ChoiceList, Field, Screen, Stack, Text, useTheme } from "@abrigo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Linking } from "react-native";
import { ApiError, request } from "@/lib/api";
import { signOut, useStaffMe } from "@/lib/staff";

type Status = "pending" | "approved" | "suspended" | "rejected";
type Tab = Status | "metrics";

interface AdminHelper {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profession: Profession;
  licenseNumber: string | null;
  licenseJurisdiction: string | null;
  organization: string | null;
  specialties: string[];
  gender: string | null;
  bioShort: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Solicitudes pendientes" },
  { value: "approved", label: "Ayudantes activos" },
  { value: "suspended", label: "Suspendidos" },
  { value: "rejected", label: "Rechazados" },
  { value: "metrics", label: "Métricas" },
];

/** Consulta pública de matrículas (REFEPS / SISA). */
const REFEPS_URL = "https://sisa.msal.gov.ar/sisa/#sisa";

export default function Admin() {
  const me = useStaffMe();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");

  const list = useQuery({
    queryKey: ["admin-helpers", tab],
    queryFn: () =>
      request<{ helpers: AdminHelper[] }>("GET", `/v1/admin/helpers?status=${tab}`, {
        auth: "staff",
      }),
    enabled: me.data?.role === "admin" && tab !== "metrics",
  });

  if (me.isLoading) return <Screen>{null}</Screen>;
  if (me.data?.role !== "admin" || !me.data.twoFactorEnabled) {
    return (
      <Screen footer={<Button label="Ingresar" onPress={() => router.replace("/ayudante")} />}>
        <Text variant="heading">Panel de administración</Text>
        <Text variant="body" color="inkSoft">
          Necesitás ingresar con una cuenta de administración y verificación en dos pasos.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          variant="quiet"
          label="Cerrar sesión"
          onPress={async () => {
            await signOut();
            qc.clear();
            router.replace("/ayudante");
          }}
        />
      }
    >
      <Text variant="heading">Administración</Text>
      <ChoiceList accessibilityLabel="Sección" value={tab} onChange={setTab} options={TABS} />
      {tab === "metrics" ? <Metrics /> : null}
      {tab !== "metrics" && list.data?.helpers.length === 0 ? (
        <Text variant="body" color="inkSoft">
          No hay nada acá.
        </Text>
      ) : null}
      {tab === "metrics"
        ? null
        : list.data?.helpers.map((h) => (
            <HelperCard
              key={h.id}
              helper={h}
              status={tab}
              onChanged={() => qc.invalidateQueries({ queryKey: ["admin-helpers"] })}
            />
          ))}
    </Screen>
  );
}

function HelperCard({
  helper,
  status,
  onChanged,
}: {
  helper: AdminHelper;
  status: Status;
  onChanged: () => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<null | "reject" | "suspend">(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(undefined);
    try {
      await request("POST", `/v1/admin/helpers/${helper.id}/${path}`, {
        auth: "staff",
        ...(body ? { body } : {}),
      });
      setMode(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo falló");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="title">
        {helper.firstName} {helper.lastName}
      </Text>
      <Text variant="bodySm" color="inkSoft">
        {PROFESSION_LABELS[helper.profession]} · {helper.email}
      </Text>
      {helper.licenseNumber ? (
        <Text variant="bodySm">
          Matrícula {helper.licenseNumber} ({helper.licenseJurisdiction})
        </Text>
      ) : null}
      {helper.organization ? (
        <Text variant="bodySm">Organización: {helper.organization}</Text>
      ) : null}
      <Text variant="bodySm">
        Especialidades:{" "}
        {helper.specialties
          .map((s) => (s === "mental_health" ? "salud mental" : "violencia"))
          .join(", ")}
        {helper.gender ? ` · género: ${helper.gender}` : ""}
      </Text>
      {helper.bioShort ? (
        <Text variant="bodySm" color="inkSoft">
          “{helper.bioShort}”
        </Text>
      ) : null}
      <Text variant="caption" color="mute">
        2FA {helper.twoFactorEnabled ? "activo" : "pendiente"} · solicitó el{" "}
        {new Date(helper.createdAt).toLocaleDateString("es-AR")}
      </Text>
      {status === "pending" && helper.licenseNumber ? (
        <Button
          variant="quiet"
          block={false}
          label="Consultar matrícula en REFEPS/SISA"
          onPress={() => Linking.openURL(REFEPS_URL)}
        />
      ) : null}

      {mode ? (
        <Stack gap="sm">
          <Field
            label={mode === "reject" ? "Motivo del rechazo" : "Motivo de la suspensión"}
            value={reason}
            onChangeText={setReason}
            multiline
            error={error}
          />
          <Button
            label={mode === "reject" ? "Rechazar" : "Suspender ahora"}
            loading={busy}
            disabled={mode === "suspend" && reason.trim().length < 3}
            onPress={() =>
              mode === "reject"
                ? act("decision", {
                    decision: "reject",
                    ...(reason.trim() ? { reason: reason.trim() } : {}),
                  })
                : act("suspend", { reason: reason.trim() })
            }
          />
          <Button variant="quiet" label="Cancelar" onPress={() => setMode(null)} />
        </Stack>
      ) : (
        <Stack gap="sm">
          {status === "pending" ? (
            <>
              <Button
                label="Aprobar"
                loading={busy}
                onPress={() => act("decision", { decision: "approve" })}
              />
              <Button variant="secondary" label="Rechazar" onPress={() => setMode("reject")} />
            </>
          ) : null}
          {status === "approved" ? (
            <Button variant="secondary" label="Suspender" onPress={() => setMode("suspend")} />
          ) : null}
          {status === "suspended" ? (
            <Button
              variant="secondary"
              label="Reactivar"
              loading={busy}
              onPress={() => act("reactivate")}
            />
          ) : null}
          {error ? (
            <Text variant="caption" style={{ color: colors.dangerForm }}>
              {error}
            </Text>
          ) : null}
        </Stack>
      )}
    </Card>
  );
}

interface WaitRow {
  claims: number;
  p50Seconds: number | null;
  p90Seconds: number | null;
}

interface MetricsSummary {
  days: number;
  alertsCreated: number;
  alertsUnanswered: number;
  byLevel: (WaitRow & { level: number })[];
  byRegion: (WaitRow & { region: string })[];
}

const LEVEL_LABELS = ["Zona", "50 km", "Provincia", "Todo el país", "Sin respuesta a 20 min"];

function duration(s: number | null) {
  if (s === null) return "—";
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}

function regionLabel(code: string) {
  if (code === "cell") return "Zona aproximada (sin provincia)";
  if (code === "none") return "Sin ubicación";
  return regionName(code) ?? code;
}

/** Tiempo hasta que alguien toma un pedido. Solo agregados. */
function Metrics() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const q = useQuery({
    queryKey: ["admin-metrics", days],
    queryFn: () =>
      request<MetricsSummary>("GET", `/v1/admin/metrics?days=${days}`, { auth: "staff" }),
  });
  const m = q.data;
  return (
    <Stack gap="md">
      <ChoiceList
        accessibilityLabel="Período"
        value={days}
        onChange={setDays}
        options={[
          { value: "7", label: "Últimos 7 días" },
          { value: "30", label: "Últimos 30 días" },
          { value: "90", label: "Últimos 90 días" },
        ]}
      />
      {m ? (
        <>
          <Card>
            <Text variant="title">
              {m.alertsCreated} pedidos · {m.alertsUnanswered} sin respuesta
            </Text>
          </Card>
          <Card>
            <Text variant="title">Por nivel en que se tomó</Text>
            {m.byLevel.length === 0 ? (
              <Text variant="bodySm" color="inkSoft">
                Todavía no hay datos.
              </Text>
            ) : null}
            {m.byLevel.map((r) => (
              <Text key={r.level} variant="bodySm">
                {LEVEL_LABELS[r.level] ?? r.level}: {r.claims} · mediana {duration(r.p50Seconds)} ·
                p90 {duration(r.p90Seconds)}
              </Text>
            ))}
          </Card>
          <Card>
            <Text variant="title">Por provincia</Text>
            {m.byRegion.map((r) => (
              <Text key={r.region} variant="bodySm">
                {regionLabel(r.region)}: {r.claims} · mediana {duration(r.p50Seconds)} · p90{" "}
                {duration(r.p90Seconds)}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
