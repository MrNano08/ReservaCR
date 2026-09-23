import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.WEB_TEST_URL || "http://localhost:5173";
const password = process.env.SEED_PASSWORD;
assert.ok(password, "Define SEED_PASSWORD para las cuentas ficticias.");
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function login(email) {
  await page.goto(base + "/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("ingresar"));
}
async function logout() {
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByRole("link", { name: /Ingresar/ }).waitFor();
}
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Un buen lugar para empezar" })
    .waitFor();
  await page.locator(".business-card").first().waitFor();
  assert.equal(await page.locator(".business-card").count(), 4);
  await page.screenshot({
    path: "test-results/catalogo-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Barbería", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".business-card").length === 1,
  );
  assert.ok(
    (await page.locator(".business-card").innerText()).includes(
      "Barbería Central",
    ),
  );
  await page
    .getByRole("button", { name: "Todos los negocios", exact: true })
    .click();
  await login("cliente@reservacr.test");
  await page.goto(base);
  await page
    .locator(".business-card")
    .filter({ hasText: "Estudio Nativa" })
    .click();
  await page.getByRole("button", { name: /Corte y estilo/ }).click();
  let chosen = false;
  for (let days = 5; days < 12; days++) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + days * 86400000));
    await page.getByLabel("Fecha de la cita").fill(date);
    await page.waitForTimeout(400);
    if (await page.locator(".slots button").count()) {
      chosen = true;
      break;
    }
  }
  assert.ok(chosen, "Existen horarios para la prueba");
  await page.locator(".slots button").last().click();
  await page
    .getByLabel("Nota para el negocio (opcional)")
    .fill("Prueba del recorrido en navegador");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await page
    .getByRole("heading", { name: "Tu cita está confirmada" })
    .waitFor();
  await page.screenshot({
    path: "test-results/reserva-confirmada.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Ver mis reservas", exact: true })
    .click();
  await page
    .locator(".reservation")
    .filter({ hasText: "Prueba del recorrido en navegador" })
    .getByRole("button", { name: "Cancelar cita" })
    .click();
  await page.getByRole("button", { name: "Sí, cancelar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  console.log("PASS navegador: cliente busca, reserva y cancela");
  await logout();
  await login("negocio@reservacr.test");
  await page
    .getByRole("heading", { name: "Estudio Nativa", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Servicios", exact: true }).click();
  await page
    .getByRole("heading", { name: "Tus servicios", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Horarios y cupos" }).click();
  assert.ok((await page.locator(".hours-editor").count()) >= 6);
  await page.screenshot({
    path: "test-results/panel-negocio.png",
    fullPage: true,
  });
  console.log("PASS navegador: negocio consulta servicios, horarios y cupos");
  await logout();
  await login("admin@reservacr.test");
  await page
    .getByRole("heading", { name: "Un catálogo en buenas manos" })
    .waitFor();
  await page
    .getByRole("button", { name: "Revisar", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Categorías", exact: true }).click();
  await page
    .getByRole("heading", { name: "Categorías del catálogo" })
    .waitFor();
  console.log("PASS navegador: administrador revisa negocios y categorías");
  await logout();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.locator(".business-card").first().waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "No hay desplazamiento horizontal móvil",
  );
  assert.ok(
    (await page.getByRole("combobox", { name: "Provincia" }).boundingBox())
      .width > 100,
    "Filtro de provincia utilizable en móvil",
  );
  await page.screenshot({
    path: "test-results/catalogo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.locator("nav.open").waitFor();
  await page.getByRole("button", { name: "Cambiar tema" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  console.log("PASS navegador: móvil, menú y cambio de tema");
  assert.deepEqual(errors, [], "No hay errores JavaScript en las pantallas");
  console.log("PASS navegador: sin excepciones JavaScript");
} finally {
  await browser.close();
}
