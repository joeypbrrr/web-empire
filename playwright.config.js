import { defineConfig } from "@playwright/test";

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8765",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1",
    port: 8765,
    reuseExistingServer: true,
    timeout: 15000,
  },
  projects: [
    { name: "chromium-desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "chromium-mobile", use: { browserName: "chromium", ...mobile } },
    { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1280, height: 800 } } },
    { name: "webkit-mobile", use: { browserName: "webkit", ...mobile } },
  ],
});
