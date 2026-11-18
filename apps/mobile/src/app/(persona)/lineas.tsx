import { CRISIS_LINES, UNDERAGE_LINES } from "@abrigo/shared/client";
import { Button, CrisisLineCard, Screen, Text } from "@abrigo/ui";
import { router } from "expo-router";
import { t } from "@/copy/es";

export default function Lines() {
  return (
    <Screen
      footer={
        <Button variant="secondary" label={t.common.back} onPress={() => router.replace("/")} />
      }
    >
      <Text variant="heading">Líneas de ayuda</Text>
      <CrisisLineCard
        title="Salud mental"
        lines={[CRISIS_LINES.suicide, CRISIS_LINES.suicideNational, CRISIS_LINES.emergency]}
      />
      <CrisisLineCard
        title="Violencia"
        lines={[CRISIS_LINES.genderViolence, CRISIS_LINES.familyViolence]}
      />
      <CrisisLineCard title="Si tenés menos de 18" lines={UNDERAGE_LINES.slice(0, 1)} />
    </Screen>
  );
}
