import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "5mb" }));

const TOKEN = process.env.RENDER_TOKEN || "";

app.post("/render", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const html = String(req.body.html || "");
    if (!html) return res.status(400).json({ ok: false, error: "missing html" });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1789, height: 936, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pngBuffer = await page.screenshot({ type: "png" });
    const jpgBuffer = await page.screenshot({ type: "jpeg", quality: 92 });

    await browser.close();

    res.json({
      ok: true,
      png_base64: pngBuffer.toString("base64"),
      jpg_base64: jpgBuffer.toString("base64")
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "render error" });
  }
});

app.get("/", (_req, res) => res.send("renderer ok"));
app.listen(process.env.PORT || 3000, () => console.log("renderer up"));
