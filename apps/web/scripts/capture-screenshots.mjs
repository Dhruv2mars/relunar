import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3000";
const outDir = "/opt/cursor/artifacts/screenshots";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/home-light.png`, fullPage: true });

await page.emulateMedia({ colorScheme: "dark" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/home-dark.png`, fullPage: true });

await page.emulateMedia({ colorScheme: "light" });
await page.goto(`${baseUrl}/docs`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/docs-index.png`, fullPage: true });

await page.goto(`${baseUrl}/docs/getting-started`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/docs-getting-started.png`, fullPage: true });

await browser.close();
console.log("Screenshots saved to", outDir);
