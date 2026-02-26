import { assertEquals } from "@std/assert";
import { formatFiat, fiatPartsToString, parseFiatString } from "./format.ts";

Deno.test("formatFiat() EN locale — basic amount", () => {
  const parts = formatFiat(1234.56, "en");
  assertEquals(parts.currency, "$");
  assertEquals(parts.integer, "1,234");
  assertEquals(parts.decimal, ".56");
});

Deno.test("formatFiat() EN locale — zero", () => {
  const parts = formatFiat(0, "en");
  assertEquals(parts.currency, "$");
  assertEquals(parts.integer, "0");
  assertEquals(parts.decimal, ".00");
});

Deno.test("formatFiat() EN locale — large amount", () => {
  const parts = formatFiat(999999.99, "en");
  assertEquals(parts.currency, "$");
  assertEquals(parts.integer, "999,999");
  assertEquals(parts.decimal, ".99");
});

Deno.test("formatFiat() ES locale — uses comma as decimal", () => {
  const parts = formatFiat(1234.56, "es");
  // ES locale may produce "US$" or "$" depending on CLDR
  assertEquals(typeof parts.currency, "string");
  assertEquals(parts.currency.length > 0, true);
  // Decimal should contain a comma
  assertEquals(parts.decimal.includes(","), true);
});

Deno.test("fiatPartsToString() round-trip", () => {
  const parts = formatFiat(42.5, "en");
  const str = fiatPartsToString(parts);
  assertEquals(str, "$42.50");
});

Deno.test("parseFiatString() parses $XX.XX format", () => {
  assertEquals(parseFiatString("$1,234.56"), 1234.56);
});

Deno.test("parseFiatString() handles missing $", () => {
  assertEquals(parseFiatString("1234.56"), 1234.56);
});

Deno.test("parseFiatString() handles zero", () => {
  assertEquals(parseFiatString("$0"), 0);
});

Deno.test("parseFiatString() handles empty string", () => {
  assertEquals(parseFiatString(""), 0);
});
