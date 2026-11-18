import {
  AR_PROVINCES,
  LICENSED_PROFESSIONS,
  PROFESSION_LABELS,
  PROFESSIONS,
  helperRegistrationSchema,
  type Profession,
} from "@abrigo/shared";
import { Button, ChoiceList, Field, Screen, Stack, Text, useTheme } from "@abrigo/ui";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ApiError, request } from "@/lib/api";
import { getCaptchaToken } from "@/lib/captcha";

const GENDERS = [
  { value: "woman", label: "Mujer" },
  { value: "man", label: "Varón" },
  { value: "non_binary", label: "No binario" },
  { value: "prefer_not", label: "Prefiero no decirlo" },
] as const;

type Specialty = "mental_health" | "violence";

export default function Register() {
  const { colors } = useTheme();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    profession: null as Profession | null,
    licenseNumber: "",
    licenseJurisdiction: "",
    organization: "",
    gender: null as (typeof GENDERS)[number]["value"] | null,
    bioShort: "",
    specialties: [] as Specialty[],
    acceptsCodeOfConduct: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const licensed = form.profession ? LICENSED_PROFESSIONS.includes(form.profession) : false;

  function toggleSpecialty(s: Specialty) {
    set(
      "specialties",
      form.specialties.includes(s)
        ? form.specialties.filter((x) => x !== s)
        : [...form.specialties, s],
    );
  }

  async function submit() {
    setServerError(null);
    const candidate = {
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      profession: form.profession ?? undefined,
      ...(licensed
        ? {
            licenseNumber: form.licenseNumber || undefined,
            licenseJurisdiction: form.licenseJurisdiction || undefined,
          }
        : { organization: form.organization || undefined }),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(form.bioShort ? { bioShort: form.bioShort } : {}),
      specialties: form.specialties,
      languages: ["es"],
      acceptsRemoteAnywhere: true,
      acceptsCodeOfConduct: form.acceptsCodeOfConduct || undefined,
    };
    const parsed = helperRegistrationSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= MESSAGES[key] ?? issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const captchaToken = await getCaptchaToken();
      await request("POST", "/v1/helpers/register", {
        body: { ...parsed.data, ...(captchaToken ? { captchaToken } : {}) },
      });
      setDone(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Algo falló. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen footer={<Button label="Ingresar" onPress={() => router.replace("/ayudante")} />}>
        <Text variant="heading">¡Gracias!</Text>
        <Text variant="body" color="inkSoft">
          Recibimos tu solicitud. Ingresá para configurar la verificación en dos pasos mientras
          revisamos tus datos.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Enviar solicitud" loading={busy} onPress={submit} />}>
      <Text variant="heading">Sumate como ayudante</Text>
      <Text variant="body" color="inkSoft">
        Abrigo conecta a personas en crisis con profesionales matriculados y voluntarios de
        organizaciones. Revisamos cada solicitud a mano.
      </Text>

      <Stack gap="md">
        <Field
          label="Nombre"
          value={form.firstName}
          onChangeText={(v) => set("firstName", v)}
          error={errors.firstName}
        />
        <Field
          label="Apellido"
          value={form.lastName}
          onChangeText={(v) => set("lastName", v)}
          error={errors.lastName}
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={(v) => set("email", v)}
          autoCapitalize="none"
          keyboardType="email-address"
          error={errors.email}
        />
        <Field
          label="Contraseña"
          hint="Al menos 12 caracteres."
          value={form.password}
          onChangeText={(v) => set("password", v)}
          secureTextEntry
          autoComplete="new-password"
          error={errors.password}
        />
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Profesión</Text>
        <ChoiceList
          accessibilityLabel="Profesión"
          value={form.profession}
          onChange={(v) => set("profession", v)}
          options={PROFESSIONS.map((p) => ({ value: p, label: capitalize(PROFESSION_LABELS[p]) }))}
        />
        {errors.profession ? <FormError text={errors.profession} /> : null}
      </Stack>

      {form.profession ? (
        licensed ? (
          <Stack gap="md">
            <Field
              label="Matrícula"
              value={form.licenseNumber}
              onChangeText={(v) => set("licenseNumber", v)}
              error={errors.licenseNumber}
            />
            <Field
              label="Jurisdicción de la matrícula"
              hint={`Por ejemplo: Nacional, ${AR_PROVINCES[0].name}, ${AR_PROVINCES[5].name}.`}
              value={form.licenseJurisdiction}
              onChangeText={(v) => set("licenseJurisdiction", v)}
              error={errors.licenseJurisdiction}
            />
          </Stack>
        ) : (
          <Field
            label="Organización"
            hint="La organización de ayuda con la que colaborás."
            value={form.organization}
            onChangeText={(v) => set("organization", v)}
            error={errors.organization}
          />
        )
      ) : null}

      <Stack gap="sm">
        <Text variant="title">¿En qué podés acompañar?</Text>
        {(["mental_health", "violence"] as const).map((s) => {
          const on = form.specialties.includes(s);
          return (
            <Pressable
              key={s}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggleSpecialty(s)}
              style={{
                minHeight: 52,
                borderRadius: 16,
                borderWidth: 1.5,
                padding: 14,
                borderColor: on ? colors.primary : colors.hairline,
                backgroundColor: on ? colors.primaryTint : colors.surface,
              }}
            >
              <Text variant="body">
                {on ? "✓ " : ""}
                {s === "mental_health" ? "Salud mental" : "Violencia de género, familiar o sexual"}
              </Text>
            </Pressable>
          );
        })}
        {errors.specialties ? <FormError text={errors.specialties} /> : null}
      </Stack>

      <Stack gap="sm">
        <Text variant="title">Género (opcional)</Text>
        <Text variant="bodySm" color="inkSoft">
          Algunas personas que sufren violencia prefieren que les escriba una mujer.
        </Text>
        <ChoiceList
          accessibilityLabel="Género"
          value={form.gender}
          onChange={(v) => set("gender", v)}
          options={GENDERS}
        />
      </Stack>

      <Field
        label="Presentación breve (opcional)"
        hint="Hasta 280 caracteres. No la ve quien pide ayuda."
        value={form.bioShort}
        onChangeText={(v) => set("bioShort", v)}
        multiline
        maxLength={280}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.acceptsCodeOfConduct }}
        onPress={() => set("acceptsCodeOfConduct", !form.acceptsCodeOfConduct)}
      >
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text variant="body">{form.acceptsCodeOfConduct ? "☑" : "☐"}</Text>
          <Text variant="body" style={{ flex: 1 }}>
            Leí y acepto el código de conducta: no pido datos personales, no propongo encuentros,
            actúo bajo mi propia matrícula o mi organización y derivo ante riesgo.
          </Text>
        </View>
      </Pressable>
      {errors.acceptsCodeOfConduct ? <FormError text={errors.acceptsCodeOfConduct} /> : null}
      {serverError ? <FormError text={serverError} /> : null}
    </Screen>
  );
}

const MESSAGES: Record<string, string> = {
  email: "Revisá el email",
  password: "La contraseña tiene que tener al menos 12 caracteres",
  firstName: "Completá tu nombre",
  lastName: "Completá tu apellido",
  profession: "Elegí tu profesión",
  specialties: "Elegí al menos una",
  acceptsCodeOfConduct: "Tenés que aceptar el código de conducta",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FormError({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text variant="caption" style={{ color: colors.dangerForm }} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}
