import { expect, test, type Page } from "@playwright/test";
import { createAdmin, createHelper, totp } from "./api.js";

async function helperLogin(page: Page, email: string, password: string, secret: string) {
  await page.goto("/ayudante");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByLabel("Código de tu app de autenticación").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar" }).click();
}

test("pedido de ayuda → aviso → tomar → chat → cierre", async ({ browser }) => {
  const admin = await createAdmin();
  const helper = await createHelper(admin, "Lucía");

  // Ayudante: ingresa con TOTP y se pone de guardia.
  const helperCtx = await browser.newContext();
  const hp = await helperCtx.newPage();
  await helperLogin(hp, helper.email, helper.password, helper.secret);
  await expect(hp.getByText("Hola, Lucía")).toBeVisible();
  await hp.getByRole("button", { name: "Estoy de guardia" }).click();
  await expect(
    hp.getByText("Estás de guardia. Te avisamos cuando alguien pida ayuda.", { exact: true }),
  ).toBeVisible();

  // Ayudante: marca las provincias que conoce (PUT a través de CORS).
  await hp.getByRole("button", { name: "Tu zona" }).click();
  await hp.getByRole("checkbox", { name: "Ciudad de Buenos Aires" }).click();
  await hp.getByRole("button", { name: "Guardar mi zona" }).click();
  await expect(hp.getByText("Marcá tu zona", { exact: false })).toHaveCount(0);

  // Persona: pide ayuda sin dar ningún dato.
  const personCtx = await browser.newContext();
  const pp = await personCtx.newPage();
  await pp.goto("/");
  await expect(pp.getByRole("button", { name: "Salir rápido de Abrigo" })).toBeVisible();
  await pp.getByRole("button", { name: "Quiero que alguien me escuche" }).click();
  await pp.getByRole("radio", { name: "Sí, tengo 18 o más" }).click();
  await pp.getByRole("radio", { name: "Me siento muy mal o pienso en hacerme daño" }).click();
  await pp.getByRole("radio", { name: "No sé" }).click();
  // Primero la vida: las líneas aparecen antes de seguir.
  await expect(pp.getByText("Asistencia al Suicida", { exact: true })).toBeVisible();
  await pp.getByRole("button", { name: "Continuar" }).click();
  await pp.getByRole("radio", { name: "Prefiero no" }).click();
  await pp.getByRole("button", { name: "Entiendo y quiero enviar mi pedido" }).click();
  await expect(pp.getByText("Gracias por escribir. Acá estamos.")).toBeVisible();

  // Ayudante: ve el pedido en tiempo real y lo toma.
  await expect(hp.getByText("No sabe si está en peligro")).toBeVisible();
  await hp.getByRole("button", { name: "Tomar esta conversación" }).click();
  await expect(hp.getByText("Guía de primer contacto")).toBeVisible();

  // Persona: pasa sola al chat.
  await expect(pp.getByText("Te escucha Lucía")).toBeVisible();
  await expect(pp.getByText("Lucía · psicóloga/o verificada/o")).toBeVisible();

  await hp.getByLabel("Escribí tu mensaje").fill("Hola, soy Lucía. Gracias por escribir.");
  await hp.getByRole("button", { name: "Enviar" }).click();
  await expect(pp.getByText("Hola, soy Lucía. Gracias por escribir.")).toBeVisible();

  await pp.getByLabel("Escribí tu mensaje").fill("Hola, gracias por responder");
  await pp.getByRole("button", { name: "Enviar" }).click();
  await expect(hp.getByText("Hola, gracias por responder")).toBeVisible();

  // Ayudante: cierra con un resumen privado.
  await hp.getByRole("button", { name: "Cerrar conversación" }).click();
  await hp.getByLabel("Resumen privado (opcional)").fill("Derivé a la línea 135.");
  await hp.getByRole("button", { name: "Cerrar la conversación" }).click();
  await expect(pp.getByText("La conversación terminó.", { exact: false })).toBeVisible();

  await helperCtx.close();
  await personCtx.close();
});

test("un menor de 18 ve la línea 102 y no puede crear un pedido", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quiero que alguien me escuche" }).click();
  await page.getByRole("radio", { name: "No, tengo menos de 18" }).click();
  await expect(page.getByText("La línea 102", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Llamar a Niñez y adolescencia/ })).toBeVisible();
});

test("salida rápida con Esc dos veces, sin volver a Abrigo con 'atrás'", async ({ page }) => {
  await page.route("https://www.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>neutral</title>neutral" }),
  );
  await page.goto("about:blank");
  await page.goto("/");
  await page.getByRole("button", { name: "Quiero que alguien me escuche" }).click();
  await page.getByRole("radio", { name: "Sí, tengo 18 o más" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForURL(/google\.com/);
  await page.goBack();
  // "Atrás" vuelve a lo que había antes de Abrigo, no a Abrigo.
  expect(page.url()).toBe("about:blank");
});
