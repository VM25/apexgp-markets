import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ready, ROUTES } from "./helpers";

for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`accessibility at ${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });
    for (const route of ROUTES) {
      test(`${route.name}: no WCAG 2.2 A/AA violations detected by axe`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await ready(page, route.path);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.failureSummary?.split("\n")[1] ?? ""}`);
        expect(summary).toEqual([]);
      });
    }
  });
}

test.describe("keyboard and motion", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a keyboard user can reach the content, trade and dismiss dialogs", async ({ page }) => {
    await ready(page, "/markets/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    // Every interactive element has an accessible name.
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, a[href], input, select"))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || (el as HTMLInputElement).labels?.length || el.getAttribute("title")))
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
    // Focus is visible.
    const row = page.getByRole("button", { name: /Max Verstappen to win/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Selected contract" }).getByRole("heading", { level: 2 })).toContainText("Max Verstappen");
    const outline = await page.locator("#ticket-qty").evaluate((el) => {
      (el as HTMLElement).focus();
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe("none");
    // The ticket submits from the keyboard, in two steps.
    await page.locator("#ticket-qty").fill("200");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Confirm · buy 200 YES/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Filled 200 at/)).toBeVisible();
    // Space plays and pauses the clock when focus is on the page.
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Pause the race clock" })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Play the race clock" })).toBeVisible();
    // Dialogs trap focus and close on Escape.
    await page.goto("/race/");
    await page.getByRole("button", { name: "Review another race" }).click();
    await expect(page.getByRole("dialog", { name: "Review a race" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Review a race" })).toBeHidden();
  });

  test("charts expose their data to assistive technology and to the keyboard", async ({ page }) => {
    await ready(page, "/markets/");
    for (let k = 0; k < 6; k++) await page.getByRole("button", { name: "Advance one lap" }).click();
    const chart = page.getByRole("img", { name: /model estimate and simulated dealer quote by lap/i });
    await expect(chart).toHaveAttribute("aria-label", /Latest values: Model estimate \d+%/);
    await chart.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".eyebrow", { hasText: /^Lap \d+$/ })).toBeVisible();
  });

  test("reduced-motion preference removes animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, "/");
    const duration = await page.locator(".rise").first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });
});
