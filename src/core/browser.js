import { chromium } from "playwright";

let browserPromise;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function fetchHtmlWithBrowser(url, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    locale: "tr-TR",
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 45000,
    });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.selectorTimeoutMs ?? 10000,
        state: options.waitForSelectorState ?? "visible",
      });
    }

    if (options.waitAfterLoadMs) {
      await page.waitForTimeout(options.waitAfterLoadMs);
    }

    const html = await page.content();
    const title = await page.title();
    const nextData = options.readNextData ? await page.evaluate(() => window.__NEXT_DATA__ ?? null) : undefined;

    if (/just a moment/i.test(title) || /security verification/i.test(html)) {
      throw new Error("Browser fallback was blocked by anti-bot verification.");
    }

    return {
      ok: true,
      status: 200,
      url: page.url(),
      html,
      nextData,
      via: "browser",
    };
  } finally {
    await page.close();
  }
}

export async function fetchJsonWithBrowser(pageUrl, requestUrl, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    locale: "tr-TR",
  });

  try {
    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 45000,
    });

    if (options.waitAfterLoadMs) {
      await page.waitForTimeout(options.waitAfterLoadMs);
    }

    return await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: "include" });
      const text = await response.text();
      let data = null;

      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        text,
        data,
      };
    }, requestUrl);
  } finally {
    await page.close();
  }
}
