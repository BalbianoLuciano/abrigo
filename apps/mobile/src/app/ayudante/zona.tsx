import { AR_PROVINCES } from "@abrigo/shared/client";
import { Button, CheckList, ChoiceList, Screen, Stack, Text, useTheme } from "@abrigo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useState } from "react";
import { ApiError, request } from "@/lib/api";
import { backToDashboard, coverageCenter, type Coverage } from "@/lib/helper-settings";

const RADII = ["10", "25", "50", "100"] as const;

export default function CoverageScreen() {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const current = useQuery({
    queryKey: ["helper-coverage"],
    queryFn: () => request<Coverage>("GET", "/v1/helper/coverage", { auth: "staff" }),
  });
  const [draft, setDraft] = useState<Coverage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (current.data && !draft) setDraft(current.data);
  }, [current.data, draft]);

  if (!draft) return <Screen>{null}</Screen>;

  const radius = draft.circle ? String(nearestRadius(draft.circle.radiusKm)) : null;

  async function locate() {
    setNote("Buscando tu ubicación…");
    try {
      const center = await coverageCenter();
      if (!center) {
        setNote("No pudimos acceder a tu ubicación. Podés elegir provincias abajo.");
        return;
      }
      setDraft((d) => d && { ...d, circle: { ...center, radiusKm: d.circle?.radiusKm ?? 25 } });
      setNote("Listo. Guardamos el centro redondeado a 1 km.");
    } catch {
      setNote("No pudimos acceder a tu ubicación. Podés elegir provincias abajo.");
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setNote(null);
    try {
      const saved = await request<Coverage>("PUT", "/v1/helper/coverage", {
        auth: "staff",
        body: {
          circle: draft.circle,
          regionCodes: draft.regionCodes,
          acceptsRemoteAnywhere: draft.acceptsRemoteAnywhere,
        },
      });
      qc.setQueryData(["helper-coverage"], saved);
      await qc.invalidateQueries({ queryKey: ["helper-alerts"] });
      void backToDashboard();
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "No se pudo guardar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Guardar mi zona" loading={busy} onPress={save} />
          <Button variant="quiet" label="Volver" onPress={() => void backToDashboard()} />
        </>
      }
    >
      <Stack gap="xs">
        <Text variant="heading">Tu zona</Text>
        <Text variant="body" color="inkSoft">
          Te avisamos primero de los pedidos cercanos, porque conocés los recursos de tu zona. Si
          nadie responde, el aviso se amplía.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Alrededor de</Text>
        <Text variant="bodySm" color="inkSoft">
          {draft.circle
            ? `Tu ubicación aproximada, ${draft.circle.radiusKm} km a la redonda.`
            : "Todavía no marcaste una zona."}
        </Text>
        <Button
          variant="secondary"
          label={draft.circle ? "Actualizar con mi ubicación" : "Usar mi ubicación"}
          onPress={locate}
        />
        {note ? (
          <Text variant="bodySm" color="inkSoft" accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
        {draft.circle ? (
          <>
            <ChoiceList
              accessibilityLabel="Radio"
              value={radius}
              onChange={(v) =>
                setDraft(
                  (d) => d && d.circle && { ...d, circle: { ...d.circle, radiusKm: Number(v) } },
                )
              }
              options={RADII.map((r) => ({ value: r, label: `${r} km` }))}
            />
            <Button
              variant="quiet"
              label="Quitar zona"
              onPress={() => setDraft((d) => d && { ...d, circle: null })}
            />
          </>
        ) : null}
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Provincias cuyos recursos conocés</Text>
        <CheckList
          accessibilityLabel="Provincias"
          values={draft.regionCodes}
          onChange={(regionCodes) => setDraft((d) => d && { ...d, regionCodes })}
          options={AR_PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
        />
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Pedidos de todo el país</Text>
        <ChoiceList
          accessibilityLabel="Pedidos de todo el país"
          value={draft.acceptsRemoteAnywhere ? "yes" : "no"}
          onChange={(v) => setDraft((d) => d && { ...d, acceptsRemoteAnywhere: v === "yes" })}
          options={[
            {
              value: "yes",
              label: "Sí, avisame también",
              hint: "Cuando un pedido lleva 10 minutos sin respuesta.",
            },
            { value: "no", label: "No, solo de mi zona" },
          ]}
        />
      </Stack>
      {!draft.circle && !draft.regionCodes.length && !draft.acceptsRemoteAnywhere ? (
        <Text variant="bodySm" style={{ color: colors.dangerForm }}>
          Con esta configuración no vas a recibir avisos.
        </Text>
      ) : null}
    </Screen>
  );
}

function nearestRadius(km: number) {
  return RADII.map(Number).reduce((best, r) => (Math.abs(r - km) < Math.abs(best - km) ? r : best));
}
