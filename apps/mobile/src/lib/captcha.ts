/** Nativo: sin Turnstile por ahora (etapa 4); el servidor limita por sesión e IP. */
export async function getCaptchaToken(): Promise<string | undefined> {
  return undefined;
}
