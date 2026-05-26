import express from "express";
import puppeteer from "puppeteer";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function ensureChromeInstalled() {
  try {
    const cacheDir =
      process.env.PUPPETEER_CACHE_DIR ||
      path.join(os.homedir(), ".cache", "puppeteer");
    const marker = path.join(cacheDir, ".chrome-installed");

    if (fs.existsSync(marker)) return;

    execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(marker, "ok");
  } catch (e) {
    console.error("chrome install failed:", e?.message || e);
  }
}

ensureChromeInstalled();

const app = express();
app.use(express.json({ limit: "10mb" }));

const TOKEN = process.env.RENDER_TOKEN || "";

app.get("/", (_req, res) => {
  res.send("renderer ok");
});

app.post("/render", async (req, res) => {
  let browser;
  try {
    const auth = req.headers.authorization || "";
    if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const html = String(req.body.html || "");
    if (!html) {
      return res.status(400).json({ ok: false, error: "missing html" });
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    await page.setViewport({
      width: 1789,
      height: 936,
      deviceScaleFactor: 1
    });

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const u = req.url();
      if (
        u.includes("google-analytics") ||
        u.includes("googletagmanager") ||
        u.includes("doubleclick") ||
        u.includes("facebook.net")
      ) {
        return req.abort();
      }
      req.continue();
    });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    await new Promise((r) => setTimeout(r, 1200));

    const pngBuffer = await page.screenshot({ type: "png" });
    const jpgBuffer = await page.screenshot({ type: "jpeg", quality: 92 });

    return res.json({
      ok: true,
      png_base64: pngBuffer.toString("base64"),
      jpg_base64: jpgBuffer.toString("base64")
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "render error" });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("renderer up");
});
