import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

/** Captures the key workflow states as screenshots for docs/evidence. Assertions are light; journey.spec.ts is the real check. */
test.describe("workflow evidence", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("desktop: ticket, live race, settlement, portfolio", async ({ page }) => {
    const shot = (name: string) => page.screenshot({ path: `docs/evidence/screens/flow-${name}.jpg`, type: "jpeg", quality: 64 });
    await ready(page, "/markets/");
    const detail = page.getByRole("region", { name: "Selected contract" });
    const ticket = detail.getByRole("form", { name: /order ticket/i });
    await ticket.locator("#ticket-qty").fill("800");
    await ticket.getByRole("button", { name: "Review buy YES" }).click();
    await ticket.getByRole("button", { name: /^Confirm/ }).click();
    // A second, related position and a resting order, so risk and orders have content.
    await page.getByRole("tab", { name: "Podium" }).click();
    await page.getByRole("button", { name: /Max Verstappen on the podium/ }).click();
    await ticket.locator("#ticket-qty").fill("600");
    await ticket.getByRole("button", { name: "○ NO" }).click();
    await ticket.getByRole("button", { name: "Review buy NO" }).click();
    await ticket.getByRole("button", { name: /^Confirm/ }).click();
    await page.getByRole("tab", { name: "Winner" }).click();
    await page.getByRole("button", { name: /Oscar Piastri to win/ }).click();
    await ticket.getByRole("button", { name: "● YES" }).click();
    await ticket.getByRole("button", { name: "Limit" }).click();
    await ticket.locator("#ticket-limit").fill("9");
    await ticket.locator("#ticket-qty").fill("1000");
    await ticket.getByRole("button", { name: "Review buy YES" }).click();
    await ticket.getByRole("button", { name: /^Confirm/ }).click();
    const step = page.getByRole("button", { name: "Advance one lap" });
    for (let k = 0; k < 26; k++) await step.click();
    await page.getByRole("button", { name: /Lando Norris to win/ }).click();
    await page.waitForTimeout(400);
    await shot("markets-ticket-1440");

    await page.goto("/race/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Australian Grand Prix");
    await page.waitForTimeout(900);
    await shot("race-live-1440");

    await page.goto("/portfolio/");
    await expect(page.getByRole("heading", { level: 1, name: "Portfolio" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "docs/evidence/screens/flow-portfolio-1440.jpg", type: "jpeg", quality: 60, fullPage: true });

    await page.getByRole("button", { name: "To flag" }).click();
    await page.getByRole("banner").getByRole("button", { name: /^Settle/ }).click({ timeout: 60_000 });
    await expect(page.getByRole("dialog", { name: /Settled/ })).toBeVisible();
    await page.waitForTimeout(400);
    await shot("settlement-1440");
  });

  test("research: validation and quote lab", async ({ page }) => {
    await ready(page, "/research/");
    await page.locator("#validation").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "docs/evidence/screens/flow-research-validation-1440.jpg", type: "jpeg", quality: 62 });
    await page.getByText("Quote lab").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/evidence/screens/flow-research-quotelab-1440.jpg", type: "jpeg", quality: 62 });
  });
});

test.describe("phone evidence", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("phone: contract sheet with ticket", async ({ page }) => {
    await ready(page, "/markets/");
    for (let k = 0; k < 9; k++) await page.getByRole("button", { name: "Advance one lap" }).tap();
    await page.getByRole("button", { name: /Lando Norris to win/ }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "docs/evidence/screens/flow-contract-sheet-390.jpg", type: "jpeg", quality: 64 });
  });
});
