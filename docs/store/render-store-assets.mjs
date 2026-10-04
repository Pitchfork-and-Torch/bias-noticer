/**
 * Render Chrome Web Store assets via puppeteer-core + Brave/Chrome.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlDir = path.join(__dirname, "html");
const shotDir = path.join(__dirname, "screenshots");
const promoDir = path.join(__dirname, "promo");
const desktop = path.join(process.env.USERPROFILE || "", "Desktop", "bias-noticer-store-assets");

fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(promoDir, { recursive: true });
fs.mkdirSync(desktop, { recursive: true });

const brave =
  process.env.BRAVE_PATH ||
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const chrome =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const exe = fs.existsSync(brave) ? brave : chrome;

const jobs = [
  { file: "shot-01-popup.html", out: path.join(shotDir, "01-popup-dashboard.jpg"), w: 1280, h: 800 },
  { file: "shot-02-highlights.html", out: path.join(shotDir, "02-highlights-tooltips.jpg"), w: 1280, h: 800 },
  { file: "shot-03-sidepanel.html", out: path.join(shotDir, "03-sidepanel-signals.jpg"), w: 1280, h: 800 },
  { file: "shot-04-research.html", out: path.join(shotDir, "04-research-paste.jpg"), w: 1280, h: 800 },
  { file: "shot-05-privacy.html", out: path.join(shotDir, "05-privacy-themes.jpg"), w: 1280, h: 800 },
  { file: "tile-440x280.html", out: path.join(promoDir, "small-promo-440x280.jpg"), w: 440, h: 280 },
  { file: "marquee-1400x560.html", out: path.join(promoDir, "marquee-1400x560.jpg"), w: 1400, h: 560 },
];

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  defaultViewport: null,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

for (const job of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
  const url = pathToFileURL(path.join(htmlDir, job.file)).href;
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.screenshot({
    path: job.out,
    type: "jpeg",
    quality: 92,
    clip: { x: 0, y: 0, width: job.w, height: job.h },
  });
  const desk = path.join(desktop, path.basename(job.out));
  fs.copyFileSync(job.out, desk);
  console.log("OK", job.out);
  await page.close();
}

await browser.close();
console.log("Desktop folder:", desktop);
