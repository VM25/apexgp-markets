import { expect, test } from "@playwright/test";
import { clock, ready, sessionState, watch } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("primary journey: open the app, trade, run the race, settle, move on, reload", async ({ page }) => {
  const problems = watch(page);

  // 1. A first-time visitor lands on the overview and sees what the product is.
  await ready(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/every lap is new/i);
  await expect(page.getByText("fictional money only").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Your session" })).toContainText("R1 · Australian Grand Prix");
  await expect(page.getByRole("complementary", { name: "Your session" })).toContainText("$100,000");

  // 2. Markets: the board shows model estimates and two-sided quotes.
  await page.getByRole("link", { name: /open the markets/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();
  const rows = page.getByRole("region", { name: "Contracts" }).locator("tbody tr");
  await expect(rows).toHaveCount(20);
  await rows.filter({ hasText: "Lando Norris" }).click();
  const detail = page.getByRole("region", { name: "Selected contract" });
  await expect(detail.getByRole("heading", { level: 2 })).toHaveText("Will Lando Norris win the Australian Grand Prix?");

  // 3. Ticket: a live preview, then a two-step confirm.
  const ticket = detail.getByRole("form", { name: /order ticket/i });
  await ticket.getByLabel("Contracts").fill("500");
  await expect(ticket.getByText("Fills now")).toBeVisible();
  const pay = await ticket.locator("dt", { hasText: "You pay" }).locator("xpath=following-sibling::dd").innerText();
  expect(pay).toMatch(/^\$\d{3}\.\d{2}$/);
  await ticket.getByRole("button", { name: "Review buy YES" }).click();
  const confirm = ticket.getByRole("button", { name: /^Confirm · buy 500 YES/ });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(ticket.getByText(/Filled 500 at/)).toBeVisible();
  await expect(rows.filter({ hasText: "Lando Norris" }).locator(".side-yes")).toBeVisible();

  let s = await sessionState(page);
  expect(s.fills).toHaveLength(1);
  const fill = s.fills[0];
  expect(fill.qty).toBe(500);
  expect(s.ledger.cash).toBe(100_000_00 - Math.round(fill.priceYes * 500) - fill.fee);

  // 4. Selling more than is held is refused with a reason; the ticket never submits it.
  await ticket.getByRole("button", { name: "Sell" }).click();
  await ticket.getByLabel("Contracts").fill("900");
  await expect(ticket.getByText(/You can sell at most 500 YES/)).toBeVisible();
  await expect(ticket.getByRole("button", { name: /Review sell YES/ })).toBeDisabled();
  await ticket.getByRole("button", { name: "Buy" }).click();

  // 5. Run the clock: step, then run to the flag. The clock only moves forward.
  await page.getByRole("button", { name: "Advance one lap" }).click();
  await expect.poll(() => clock(page)).toContain("L1/57");
  await page.getByRole("button", { name: "To flag" }).click();
  await expect(page.getByRole("button", { name: /^Settle/ })).toBeVisible({ timeout: 60_000 });
  s = await sessionState(page);
  expect(s.phase).toBe("flag");
  expect(s.frame).toBe(57);

  // 6. Markets are closed at the flag.
  await expect(page.getByText("The race is over and its markets are closed.")).toBeVisible();
  await expect(ticket.getByRole("button", { name: /Review buy YES/ })).toBeDisabled();

  // 7. Settlement on the official classification.
  const cashBefore = s.ledger.cash;
  await page.getByRole("banner").getByRole("button", { name: /^Settle/ }).click();
  const dialog = page.getByRole("dialog", { name: /Settled · Australian Grand Prix/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("P1")).toBeVisible();
  await expect(dialog.locator("li", { hasText: "P1" })).toContainText("Lando Norris");
  await expect(dialog.locator("tbody tr")).toHaveCount(1);
  s = await sessionState(page);
  expect(s.phase).toBe("settled");
  expect(s.settlements).toHaveLength(1);
  expect(s.settlements[0].payoff).toBe(1);
  expect(s.ledger.cash).toBe(cashBefore + 500 * 100);
  expect(Object.values(s.ledger.positions as Record<string, { q: number }>).every((p) => p.q === 0)).toBe(true);

  // 8. Open the next round: a new race, the same account.
  await dialog.getByRole("button", { name: /Open round 2/ }).click();
  await expect.poll(() => clock(page)).toContain("R02");
  await expect(rows.filter({ hasText: "Oscar Piastri" })).toBeVisible();
  s = await sessionState(page);
  expect(s.round).toBe(2);
  expect(s.frame).toBe(0);
  expect(s.settledRounds).toEqual([1]);
  const navAfter = s.navHistory[s.navHistory.length - 1].nav;
  expect(navAfter).toBe(s.ledger.cash);

  // 9. Portfolio shows the settled record; a reload restores everything.
  await page.getByRole("navigation", { name: "Primary" }).first().getByRole("link", { name: "Portfolio" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio" })).toBeVisible();
  await page.getByRole("tab", { name: /Settlements \(1\)/ }).click();
  await expect(page.getByRole("cell", { name: "Lando Norris to win" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio" })).toBeVisible();
  await expect.poll(() => clock(page)).toContain("R02");
  const restored = await sessionState(page);
  expect(restored.ledger.cash).toBe(s.ledger.cash);
  expect(restored.fills).toHaveLength(1);

  expect(problems).toEqual([]);
});

test("a corrupted saved session is discarded safely", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("apexgp.v3.session", '{"version":3,"ledger":"nope"'));
  await ready(page, "/");
  await expect(page.getByRole("complementary", { name: "Your session" })).toContainText("R1 · Australian Grand Prix");
  await expect(page.getByRole("complementary", { name: "Your session" })).toContainText("$100,000");
});

test("a missing data file produces a readable error and a retry, not a blank page", async ({ page }) => {
  await page.route("**/data/model.json", (r) => r.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/");
  const alert = page.locator("#main").getByRole("alert");
  await expect(alert).toContainText("That didn’t load");
  await expect(alert).toContainText("HTTP 503");
  await page.unroute("**/data/model.json");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/every lap is new/i);
});

test("review is read-only and keeps the result behind an explicit action", async ({ page }) => {
  await ready(page, "/race/");
  await page.getByRole("button", { name: "Review another race" }).click();
  const picker = page.getByRole("dialog", { name: "Review a race" });
  await picker.getByRole("button", { name: /Monaco Grand Prix/ }).click();
  await expect(picker.getByText("Round 8 is still ahead of your session.")).toBeVisible();
  await picker.getByRole("button", { name: "Review it anyway" }).click();
  await expect(page.getByText("Review — read only")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Monaco Grand Prix");
  await expect(page.getByRole("button", { name: /^Trade / })).toHaveCount(0);
  await expect(page.getByText(/Computing estimates/)).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("slider").fill("40");
  await expect(page.getByText("Lap 40 of 78").first()).toBeVisible();
  await expect(page.getByRole("table").filter({ hasText: "Points" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show the official result" }).click();
  await expect(page.getByRole("row", { name: /Lando Norris/ }).last()).toContainText("25");
  await page.getByRole("button", { name: /Back to my session/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Australian Grand Prix");
  const s = await sessionState(page);
  expect(s.round).toBe(1);
  expect(s.frame).toBe(0);
});
