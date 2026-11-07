import { expect, test } from "@playwright/test";
import fs from "fs";

const ARTIFACTS = "/opt/cursor/artifacts";
const STUDIO = "https://joeypbrrr.github.io/web-empire/sites/neon-moon-studio/";

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

test("dashboard shows real repo state", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto("/");
  await page.waitForFunction(() => document.body.dataset.scene === "ready", null, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Web Empire" })).toBeVisible();
  await expect(page.locator("[data-agent]")).toHaveCount(6);
  await expect(page.locator("#ship-note")).toContainText("No lead files");
  await expect(page.locator("#updates")).toContainText(/Neon Moon|Scaffold Web Empire/);

  const limits = await page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    cap: window.__empire.pixelRatio,
    shadows: window.__empire.shadows,
  }));
  expect(limits.cap).toBeLessThanOrEqual(2);
  expect(limits.cap).toBeLessThanOrEqual(limits.dpr);
  expect(limits.shadows).toBe(false);

  const data = await (await page.request.get("/data/empire.json")).json();
  expect(data.leads).toEqual([]);
  expect(data.rooms).toEqual([]);
  expect(data.agents).toHaveLength(6);
  expect(JSON.stringify(data)).not.toMatch(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/);
  expect(JSON.stringify(data).toLowerCase()).not.toContain("tel:");
  const studio = (data.readyToShip || []).find((site) => site.slug === "neon-moon-studio");
  expect(studio.previewUrl).toBe(STUDIO);
  expect(studio.name).toMatch(/Neon Moon/);

  await page.screenshot({
    path: `${ARTIFACTS}/screenshot_${testInfo.project.name}_floor.png`,
  });

  const point = await page.evaluate(() => window.__empire.screenPoint("room-builder-2"));
  const tag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point);
  expect(tag, `3D pick point landed on ${tag} at ${point.x},${point.y}`).toBe("CANVAS");
  if (testInfo.project.name.includes("mobile")) {
    await page.touchscreen.tap(point.x, point.y);
  } else {
    await page.mouse.click(point.x, point.y);
  }
  await expect(page.locator("#panel-title")).toHaveText("Room Builder 2");
  await expect(page.locator("#agent-panel")).toContainText("No rooms built yet");
  await expect(page.locator("#agent-panel")).toContainText("different room theme");
  await page.locator("#panel-close").click();
  await expect(page.locator("#agent-panel")).toBeHidden();

  for (const id of ["room-builder-1", "room-builder-2", "room-builder-3"]) {
    if (await page.locator("#agent-panel").isVisible()) await page.locator("#panel-close").click();
    await page.locator(`[data-agent="${id}"]`).click();
    await expect(page.locator("#agent-panel")).toBeVisible();
    await expect(page.locator("#agent-panel")).toContainText("No rooms built yet");
    await expect(page.locator("#agent-panel")).toContainText("Not running");
    if (id === "room-builder-1") {
      await expect(page.locator("#agent-panel")).toContainText("gamer-style");
    }
  }
  for (const id of ["lead-gen-1", "lead-gen-2", "lead-gen-3"]) {
    if (await page.locator("#agent-panel").isVisible()) await page.locator("#panel-close").click();
    await page.locator(`[data-agent="${id}"]`).click();
    await expect(page.locator("#agent-panel")).toContainText("No leads yet");
    await expect(page.locator("#agent-panel")).toContainText("No builds yet");
    await expect(page.locator("#agent-panel")).toContainText("Not running");
    if (id === "lead-gen-1") {
      await expect(page.locator("#agent-panel")).toContainText("Reading, PA 19601");
    }
  }

  if (testInfo.project.name === "webkit-mobile") {
    await page.screenshot({
      path: `${ARTIFACTS}/screenshot_mobile_webkit_lead_panel.png`,
    });
  }

  const link = page.locator(`a.ship-link[href="${STUDIO}"]`);
  await expect(link).toBeVisible();
  await expect(link).toContainText("Open live preview");
  await expect(link).toContainText("neon-moon-studio");
  const live = await page.request.get(STUDIO);
  expect(live.status()).toBe(200);
  expect(await live.text()).toContain("Neon Moon");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("neon moon studio page still loads", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  await page.goto("/sites/neon-moon-studio/");
  await expect(page).toHaveTitle(/Neon Moon Tattoo/);
  await expect(page.locator("h1")).toContainText("Neon Moon");
  await expect(page.locator(".hero-shot img")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop" && !fs.existsSync(`${ARTIFACTS}/screenshot_neon_moon_studio.png`)) {
    await page.screenshot({
      path: `${ARTIFACTS}/screenshot_neon_moon_studio.png`,
    });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
