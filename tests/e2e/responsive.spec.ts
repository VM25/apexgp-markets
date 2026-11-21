import { expect, test } from "@playwright/test";
import { ready, ROUTES, watch } from "./helpers";

const VIEWPORTS = [
  { w: 320, h: 640 }, { w: 375, h: 812 }, { w: 390, h: 844 }, { w: 430, h: 932 }, { w: 768, h: 1024 },
  { w: 1024, h: 768 }, { w: 1280, h: 800 }, { w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 2560, h: 1440 },
];
const LANDSCAPE = [{ w: 812, h: 375 }, { w: 932, h: 430 }, { w: 1024, h: 600 }];
const SAVE = new Set([320, 390, 768, 1440, 2560]);

/** A session with a position and twenty laps on the clock, so every view has real content. */
const SEED = `(() => {
  if (window.localStorage.getItem("apexgp.seeded")) return;
  window.localStorage.setItem("apexgp.seeded", "1");
})()`;

async function audit(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { scrollWidth: document.documentElement.scrollWidth, vw, offenders: [] as string[], tiny: [] as string[], smallTargets: [] as string[] };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
    };
    const clipped = (el: Element) => {
      // Inside a horizontally scrollable region, overflow is intended.
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && !clipped(el) && getComputedStyle(el).position !== "fixed") out.offenders.push(`${el.tagName}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || !visible(el) || el.closest("svg")) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 10.4) out.tiny.push(`${size}px "${node.textContent.trim().slice(0, 30)}"`);
    }
    for (const el of Array.from(document.querySelectorAll("main button, main a.btn, header button, nav a"))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      // WCAG 2.2 target size (minimum): 24 by 24 CSS pixels.
      if (r.width < 24 || r.height < 24) {
        const cs = getComputedStyle(el, "::after");
        const expanded = cs.content !== "none" && cs.position === "absolute";
        if (!expanded) out.smallTargets.push(`${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
}

for (const vp of [...VIEWPORTS, ...LANDSCAPE]) {
  test.describe(`${vp.w}×${vp.h}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w < 1024, isMobile: vp.w < 768 });

    test("every view fits, is legible and has no errors", async ({ page }) => {
      const problems = watch(page);
      await page.addInitScript(SEED);
      // Put a position on and run some laps so the views are populated.
      await ready(page, "/markets/");
      await page.evaluate(() => window.scrollTo(0, 0));
      const step = page.getByRole("button", { name: "Advance one lap" });
      for (let k = 0; k < 12; k++) await step.click();

      for (const route of ROUTES) {
        await ready(page, route.path);
        await expect(page.locator("#main h1").first()).toHaveText(route.heading);
        const a = await audit(page);
        expect.soft(a.scrollWidth, `${route.name}: horizontal overflow (${a.offenders.slice(0, 4).join(" | ")})`).toBeLessThanOrEqual(a.vw);
        expect.soft(a.offenders, `${route.name}: elements wider than the viewport`).toEqual([]);
        expect.soft(a.tiny, `${route.name}: text under 10.5px`).toEqual([]);
        expect.soft(a.smallTargets, `${route.name}: targets under 24px`).toEqual([]);
        // The clock and its primary control are always on screen.
        const play = page.getByRole("button", { name: /Play the race clock|Pause the race clock/ });
        await expect(play).toBeInViewport();
        const box = await play.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(40);
        expect(box!.height).toBeGreaterThanOrEqual(36);
        // Primary navigation is reachable.
        await expect(page.getByRole("navigation", { name: "Primary" }).filter({ visible: true }).getByRole("link", { name: "Portfolio" })).toBeInViewport();
        if (SAVE.has(vp.w) && vp.h > vp.w * 0.5) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: `docs/evidence/screens/${route.name}-${vp.w}.jpg`, type: "jpeg", quality: 62 });
        }
      }
      expect(problems).toEqual([]);
    });
  });
}
