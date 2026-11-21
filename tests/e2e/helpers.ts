import { expect, type Page } from "@playwright/test";

export const ROUTES = [
  { path: "/", name: "overview", heading: /every lap is new/i },
  { path: "/markets/", name: "markets", heading: /^markets$/i },
  { path: "/race/", name: "race", heading: /grand prix/i },
  { path: "/portfolio/", name: "portfolio", heading: /^portfolio$/i },
  { path: "/research/", name: "research", heading: /^research$/i },
];

/** Collect console errors and failed requests for the lifetime of the page. */
export function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
  return problems;
}

export async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#main h1").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: /restoring|loading/i })).toHaveCount(0);
}

export async function clock(page: Page): Promise<string> {
  return (await page.getByTestId("clock").innerText()).replace(/\s+/g, " ");
}

export async function navCents(page: Page): Promise<number> {
  const raw = await page.evaluate(() => window.localStorage.getItem("apexgp.v3.session"));
  const s = JSON.parse(raw ?? "null");
  return s?.navHistory?.[s.navHistory.length - 1]?.nav ?? NaN;
}

export async function sessionState(page: Page) {
  // The store saves 250 ms after a change.
  await page.waitForTimeout(450);
  return JSON.parse((await page.evaluate(() => window.localStorage.getItem("apexgp.v3.session"))) ?? "null");
}
