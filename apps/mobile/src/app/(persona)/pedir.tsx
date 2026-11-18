import {
  AR_PROVINCES,
  CRISIS_LINES_BY_PATH,
  UNDERAGE_LINES,
  requiresCrisisLines,
  type AlertPath,
  type DangerNow,
  type HelperGenderPref,
  type SafeTimeToWrite,
} from "@abrigo/shared/client";
import { Button, ChoiceList, CrisisLineCard, Screen, SoftProgress, Stack, Text } from "@abrigo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { t } from "@/copy/es";
import { ApiError, request } from "@/lib/api";
import { getCaptchaToken } from "@/lib/captcha";
import type { PublicAlert } from "@/lib/persona";
import { approximateZone } from "@/lib/zone";

type Step =
  "age" | "underage" | "path" | "danger" | "safeTime" | "gender" | "zone" | "province" | "consent";

interface Draft {
  path: AlertPath | null;
  dangerNow: DangerNow | null;
  crisisLinesShownAt: string | null;
  safeTimeToWrite: SafeTimeToWrite | null;
  helperGenderPref: HelperGenderPref | null;
  h3Cell: string | null;
  regionCode: string | null;
}

const ORDER: Step[] = ["age", "path", "danger", "safeTime", "gender", "zone", "consent"];

/**
 * Pedido de ayuda: una pregunta por pantalla. Todo vive en una sola ruta para
 * que la app ocupe una sola entrada en la historia del navegador (salida rápida).
 */
export default function Ask() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("age");
  const [draft, setDraft] = useState<Draft>({
    path: null,
    dangerNow: null,
    crisisLinesShownAt: null,
    safeTimeToWrite: null,
    helperGenderPref: null,
    h3Cell: null,
    regionCode: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneNote, setZoneNote] = useState<string | null>(null);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const progress = (ORDER.indexOf(step === "province" ? "zone" : step) + 1) / ORDER.length;

  const goAfterDanger = () => setStep(draft.path === "violence" ? "safeTime" : "zone");

  async function submit() {
    if (!draft.path || !draft.dangerNow) return;
    setBusy(true);
    setError(null);
    try {
      const captcha = await getCaptchaToken();
      const created = await request<PublicAlert>("POST", "/v1/alerts", {
        auth: "anon",
        headers: captcha ? { "x-captcha-token": captcha } : {},
        body: {
          ageConfirmed: true,
          consentAccepted: true,
          path: draft.path,
          dangerNow: draft.dangerNow,
          ...(draft.crisisLinesShownAt ? { crisisLinesShownAt: draft.crisisLinesShownAt } : {}),
          ...(draft.h3Cell ? { h3Cell: draft.h3Cell } : {}),
          ...(draft.regionCode ? { regionCode: draft.regionCode } : {}),
          ...(draft.path === "violence" && draft.safeTimeToWrite
            ? { safeTimeToWrite: draft.safeTimeToWrite }
            : {}),
          ...(draft.path === "violence" && draft.helperGenderPref
            ? { helperGenderPref: draft.helperGenderPref }
            : {}),
        },
      });
      qc.setQueryData(["current-alert"], created);
      router.replace("/espera");
    } catch (err) {
      if (err instanceof ApiError && err.code === "alert_in_progress") {
        router.replace("/espera");
        return;
      }
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const header = <SoftProgress value={progress} />;

  switch (step) {
    case "age":
      return (
        <Screen volumes>
          {header}
          <Text variant="heading">{t.age.title}</Text>
          <ChoiceList
            accessibilityLabel={t.age.title}
            value={null}
            onChange={(v) => setStep(v === "yes" ? "path" : "underage")}
            options={[
              { value: "yes", label: t.age.yes },
              { value: "no", label: t.age.no },
            ]}
          />
        </Screen>
      );

    case "underage":
      return (
        <Screen
          footer={
            <Button variant="secondary" label={t.common.back} onPress={() => router.replace("/")} />
          }
        >
          <Text variant="heading">{t.underage.title}</Text>
          <Text variant="body" color="inkSoft">
            {t.underage.body}
          </Text>
          <CrisisLineCard title="Podés llamar ahora" lines={UNDERAGE_LINES} />
        </Screen>
      );

    case "path":
      return (
        <Screen volumes>
          {header}
          <Stack gap="xs">
            <Text variant="heading">{t.path.title}</Text>
            <Text variant="body" color="inkSoft">
              {t.path.hint}
            </Text>
          </Stack>
          <ChoiceList
            accessibilityLabel={t.path.title}
            value={draft.path}
            onChange={(path) => {
              update({ path });
              setStep("danger");
            }}
            options={[
              { value: "mental_health", label: t.path.mental },
              { value: "violence", label: t.path.violence },
            ]}
          />
        </Screen>
      );

    case "danger": {
      const showLines = draft.dangerNow !== null && requiresCrisisLines(draft.dangerNow);
      return (
        <Screen
          volumes={!showLines}
          footer={
            draft.dangerNow ? (
              <Button label={t.common.continue} onPress={goAfterDanger} />
            ) : undefined
          }
        >
          {header}
          <Text variant="heading">{t.danger.title}</Text>
          <ChoiceList
            accessibilityLabel={t.danger.title}
            value={draft.dangerNow}
            onChange={(dangerNow) => {
              const needsLines = requiresCrisisLines(dangerNow);
              update({
                dangerNow,
                // Se registra el momento en que las líneas aparecen en pantalla.
                crisisLinesShownAt: needsLines
                  ? (draft.crisisLinesShownAt ?? new Date().toISOString())
                  : draft.crisisLinesShownAt,
              });
              if (!needsLines) setStep(draft.path === "violence" ? "safeTime" : "zone");
            }}
            options={[
              { value: "yes", label: t.danger.yes },
              { value: "unsure", label: t.danger.unsure },
              { value: "no", label: t.danger.no },
            ]}
          />
          {showLines && draft.path ? (
            <Stack gap="sm">
              <Text variant="body" accessibilityLiveRegion="assertive">
                {t.danger.linesIntro}
              </Text>
              <CrisisLineCard lines={CRISIS_LINES_BY_PATH[draft.path]} />
            </Stack>
          ) : null}
        </Screen>
      );
    }

    case "safeTime":
      return (
        <Screen volumes>
          {header}
          <Text variant="heading">{t.violence.safeTitle}</Text>
          <ChoiceList
            accessibilityLabel={t.violence.safeTitle}
            value={draft.safeTimeToWrite}
            onChange={(safeTimeToWrite) => {
              update({ safeTimeToWrite });
              setStep("gender");
            }}
            options={[
              { value: "yes", label: t.violence.safeYes },
              { value: "little", label: t.violence.safeLittle },
              { value: "no", label: t.violence.safeNo },
            ]}
          />
        </Screen>
      );

    case "gender":
      return (
        <Screen volumes>
          {header}
          <Stack gap="xs">
            <Text variant="heading">{t.violence.genderTitle}</Text>
            <Text variant="body" color="inkSoft">
              {t.violence.genderHint}
            </Text>
          </Stack>
          <ChoiceList
            accessibilityLabel={t.violence.genderTitle}
            value={draft.helperGenderPref}
            onChange={(helperGenderPref) => {
              update({ helperGenderPref });
              setStep("zone");
            }}
            options={[
              { value: "woman", label: t.violence.genderWoman },
              { value: "any", label: t.violence.genderAny },
            ]}
          />
        </Screen>
      );

    case "zone":
      return (
        <Screen volumes>
          {header}
          <Stack gap="xs">
            <Text variant="heading">{t.zone.title}</Text>
            <Text variant="body" color="inkSoft">
              {t.zone.body}
            </Text>
          </Stack>
          {zoneNote ? (
            <Text variant="bodySm" color="inkSoft" accessibilityLiveRegion="polite">
              {zoneNote}
            </Text>
          ) : null}
          <ChoiceList
            accessibilityLabel={t.zone.title}
            value={null}
            onChange={async (v) => {
              if (v === "gps") {
                setZoneNote(t.zone.locating);
                try {
                  const cell = await approximateZone();
                  if (cell) {
                    update({ h3Cell: cell, regionCode: null });
                    setZoneNote(null);
                    setStep("consent");
                    return;
                  }
                } catch {
                  // sigue abajo
                }
                setZoneNote(t.zone.gpsFailed);
              } else if (v === "province") {
                setStep("province");
              } else {
                update({ h3Cell: null, regionCode: null });
                setStep("consent");
              }
            }}
            options={[
              { value: "gps", label: t.zone.gps },
              { value: "province", label: t.zone.province },
              { value: "none", label: t.zone.none },
            ]}
          />
        </Screen>
      );

    case "province":
      return (
        <Screen>
          {header}
          <Text variant="heading">{t.zone.province}</Text>
          <ChoiceList
            accessibilityLabel={t.zone.province}
            value={draft.regionCode}
            onChange={(regionCode) => {
              update({ regionCode, h3Cell: null });
              setStep("consent");
            }}
            options={AR_PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
          />
        </Screen>
      );

    case "consent":
      return (
        <Screen footer={<Button label={t.consent.accept} loading={busy} onPress={submit} />}>
          {header}
          <Text variant="heading">{t.consent.title}</Text>
          <Stack gap="sm">
            {t.consent.items.map((item) => (
              <Text key={item} variant="body">
                · {item}
              </Text>
            ))}
          </Stack>
          {error ? (
            <Text variant="body" color="urgent" accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
          {draft.path ? (
            <CrisisLineCard
              title="Si en algún momento estás en peligro"
              lines={CRISIS_LINES_BY_PATH[draft.path].slice(0, 2)}
            />
          ) : null}
        </Screen>
      );
  }
}
