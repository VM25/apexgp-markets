import { expect, test } from "@playwright/test";
import { clock, ready, sessionState, watch } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("phone: the whole trade is possible by touch, in a purpose-built layout", async ({ page }) => {
  const problems = watch(page);
  await ready(page, "/");
  // Bottom tab bar, not the desktop navigation.
  const tabs = page.getByRole("navigation", { name: "Primary" }).filter({ visible: true });
  await expect(tabs.getByRole("link")).toHaveCount(5);
  await tabs.getByRole("link", { name: "Markets" }).tap();
  await expect(page.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();

  // The contract opens as a sheet with chart, ladder and ticket.
  await page.getByRole("button", { name: /Oscar Piastri to win/ }).tap();
  const sheet = page.getByRole("dialog", { name: "Oscar Piastri to win" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("img", { name: /model estimate and simulated dealer quote/i })).toBeVisible();
  const ticket = sheet.getByRole("form", { name: /order ticket/i });
  await ticket.getByRole("button", { name: "○ NO" }).tap();
  await ticket.getByRole("button", { name: "1,000", exact: true }).tap();
  await ticket.getByRole("button", { name: "Review buy NO" }).tap();
  await ticket.getByRole("button", { name: /^Confirm · buy 1,000 NO/ }).tap();
  await expect(ticket.getByText(/Filled 1,000 at/)).toBeVisible();
  // The sheet fits the screen and closes with its button.
  const box = await sheet.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await sheet.getByRole("button", { name: "Close" }).first().tap();
  await expect(sheet).toBeHidden();

  let s = await sessionState(page);
  expect(s.fills[0].side).toBe("NO");
  const pos = Object.values(s.ledger.positions as Record<string, { q: number; basis: number }>)[0];
  expect(pos.q).toBe(-1000);
  // Buying NO never costs more than $1.00 a contract and locks exactly that much.
  expect(pos.basis).toBeLessThan(1000 * 100);

  // Race view: one pane at a time, clock controls in thumb reach.
  await tabs.getByRole("link", { name: "Race" }).tap();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Australian Grand Prix");
  await page.getByRole("button", { name: "Step one lap" }).tap();
  await expect.poll(() => clock(page)).toContain("L1/57");
  for (const pane of ["Map", "Chart", "Events", "Timing"]) {
    await page.getByRole("tab", { name: pane }).tap();
    await expect(page.getByRole("tab", { name: pane })).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByRole("table").first()).toBeVisible();
  await page.getByRole("group", { name: "Playback speed" }).getByRole("button", { name: "15×" }).tap();
  await page.getByRole("button", { name: "To flag" }).tap();
  await expect(page.getByRole("button", { name: "Settle on the official result" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Settle on the official result" }).tap();
  const settled = page.getByRole("dialog", { name: /Settled · Australian Grand Prix/ });
  await expect(settled).toBeVisible();
  s = await sessionState(page);
  // Piastri did not win in Australia, so 1,000 NO contracts pay $1.00 each.
  expect(s.settlements[0].payoff).toBe(0);
  expect(s.settlements[0].realized).toBe(1000 * 100 - pos.basis);
  await settled.getByRole("button", { name: "Close" }).last().tap();

  await tabs.getByRole("link", { name: "Portfolio" }).tap();
  await expect(page.getByText("You hold no contracts")).toBeVisible();
  expect(problems).toEqual([]);
});

test("phone: explanations open on tap and close on outside tap — nothing depends on hover", async ({ page }) => {
  await ready(page, "/portfolio/");
  const tip = page.getByRole("button", { name: "About: Net asset value" });
  await tip.tap();
  await expect(page.getByRole("note")).toContainText("Cash plus the value of every open position");
  await page.getByRole("heading", { level: 1 }).tap();
  await expect(page.getByRole("note")).toHaveCount(0);
});
