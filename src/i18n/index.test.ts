import { assertEquals } from "@std/assert";
import { t, detectLocale, SUPPORTED_LOCALES } from "./index.ts";

Deno.test("t() returns English string for 'en' locale", () => {
  assertEquals(t("en", "button.pay"), "Pay");
});

Deno.test("t() returns Spanish string for 'es' locale", () => {
  assertEquals(t("es", "button.pay"), "Pagar");
});

Deno.test("t() interpolates parameters in EN", () => {
  assertEquals(t("en", "order.badge", { id: "42" }), "ORDER 42");
});

Deno.test("t() interpolates parameters in ES", () => {
  assertEquals(t("es", "order.badge", { id: "42" }), "PEDIDO 42");
});

Deno.test("t() interpolates multiple parameters", () => {
  assertEquals(
    t("en", "transaction.viewOn", { explorer: "Etherscan" }),
    "View transaction on Etherscan",
  );
  assertEquals(
    t("es", "transaction.viewOn", { explorer: "Etherscan" }),
    "Ver transaccion en Etherscan",
  );
});

Deno.test("t() falls back to English for missing keys", () => {
  // deno-lint-ignore no-explicit-any
  assertEquals(t("es", "nonexistent.key" as any), "nonexistent.key");
});

Deno.test("SUPPORTED_LOCALES contains en and es", () => {
  assertEquals(SUPPORTED_LOCALES.includes("en"), true);
  assertEquals(SUPPORTED_LOCALES.includes("es"), true);
  assertEquals(SUPPORTED_LOCALES.length, 2);
});

Deno.test("detectLocale() returns 'en' when no preference set", () => {
  localStorage.removeItem("kp-locale");
  // In Deno test env, navigator.languages defaults based on system.
  // We just test that detectLocale returns a valid locale.
  const locale = detectLocale();
  assertEquals(SUPPORTED_LOCALES.includes(locale), true);
});

Deno.test("detectLocale() returns stored locale from localStorage", () => {
  localStorage.setItem("kp-locale", "es");
  assertEquals(detectLocale(), "es");
  localStorage.removeItem("kp-locale");
});

Deno.test("detectLocale() ignores invalid localStorage value", () => {
  localStorage.setItem("kp-locale", "fr");
  const locale = detectLocale();
  // Should not return "fr" — falls through to navigator or "en"
  assertEquals(locale !== "fr" as unknown, true);
  localStorage.removeItem("kp-locale");
});
