import { spawn } from "node:child_process";

const port = process.env.SMOKE_PORT || "3457";
const baseUrl = `http://localhost:${port}`;
const sampleAkakceKey = "cep-telefonu__en-ucuz-iphone-15-fiyati,1745758198.html";
const sampleCimriKey =
  "cep-telefonlari__en-ucuz-apple-iphone-15-5g-128gb-akilli-cep-telefonu-fiyatlari,a2231112273";
const sampleAkakceUrl =
  "https://www.akakce.com/turk-kahve-makinesi/en-ucuz-arcelik-tkm-9961-s-telve-siyah-ikili-fiyati,490406523.html";
const sampleCimriUrl =
  "https://www.cimri.com/cep-telefonlari/en-ucuz-apple-iphone-15-5g-128gb-akilli-cep-telefonu-fiyatlari,a2231112273";

async function main() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: port,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHealth();

    const health = await getJson("/api/unofficial/health/providers");
    const search = await getJson("/api/unofficial/search?q=iphone 15");

    if (!Array.isArray(search.data) || search.data.length === 0) {
      throw new Error("Arama endpointi bos sonuc dondu.");
    }

    const akakceDetail = await getJson(
      `/api/unofficial/products/akakce/${encodeURIComponent(sampleAkakceKey)}`,
    );
    const akakceOffers = await getJson(
      `/api/unofficial/products/akakce/${encodeURIComponent(sampleAkakceKey)}/offers`,
    );
    const akakceSales = await getJson(`/api/unofficial/products/akakce/${encodeURIComponent(sampleAkakceKey)}/sales`);
    const cimriDetail = await getJson(`/api/unofficial/products/cimri/${encodeURIComponent(sampleCimriKey)}`);
    const cimriOffers = await getJson(
      `/api/unofficial/products/cimri/${encodeURIComponent(sampleCimriKey)}/offers`,
    );
    const cimriSales = await getJson(`/api/unofficial/products/cimri/${encodeURIComponent(sampleCimriKey)}/sales`);
    const akakceByUrlOffers = await getJson(`/api/unofficial/by-url/offers?url=${encodeURIComponent(sampleAkakceUrl)}`);
    const cimriByUrlOffers = await getJson(`/api/unofficial/by-url/offers?url=${encodeURIComponent(sampleCimriUrl)}`);

    assert(Array.isArray(akakceOffers.offers) && akakceOffers.offers.length > 0, "Akakce offers bos dondu.");
    assert(Array.isArray(cimriOffers.offers) && cimriOffers.offers.length > 0, "Cimri offers bos dondu.");
    assert(Array.isArray(akakceSales.sales) && akakceSales.sales.length > 0, "Akakce sales bos dondu.");
    assert(Array.isArray(cimriSales.sales) && cimriSales.sales.length > 0, "Cimri sales bos dondu.");
    assert(typeof akakceByUrlOffers.requestedUrl === "string", "Akakce by-url requestedUrl eksik.");
    assert(typeof cimriByUrlOffers.requestedUrl === "string", "Cimri by-url requestedUrl eksik.");
    assert(
      Object.prototype.hasOwnProperty.call(akakceOffers.offers[0], "redirectUrl"),
      "Akakce offer icinde redirectUrl yok.",
    );
    assert(
      Object.prototype.hasOwnProperty.call(cimriOffers.offers[0], "redirectUrl"),
      "Cimri offer icinde redirectUrl yok.",
    );
    assert(
      Object.prototype.hasOwnProperty.call(akakceSales.sales[0], "redirectUrl"),
      "Akakce sales icinde redirectUrl yok.",
    );
    assert(
      Object.prototype.hasOwnProperty.call(cimriSales.sales[0], "redirectUrl"),
      "Cimri sales icinde redirectUrl yok.",
    );

    console.log("Smoke test basarili.");
    console.log(
      JSON.stringify(
        {
          baseUrl,
          searchResultCount: search.data.length,
          healthProviders: health.providers.map((provider) => ({
            source: provider.source,
            healthy: provider.healthy,
          })),
          akakce: {
            productKey: sampleAkakceKey,
            name: akakceDetail.name,
            offerCount: akakceOffers.offers.length,
            salesCount: akakceSales.sales.length,
            sampleRedirectUrl: akakceOffers.offers[0]?.redirectUrl ?? null,
          },
          cimri: {
            productKey: sampleCimriKey,
            name: cimriDetail.name,
            offerCount: cimriOffers.offers.length,
            salesCount: cimriSales.sales.length,
            sampleRedirectUrl: cimriOffers.offers[0]?.redirectUrl ?? null,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    server.kill("SIGTERM");
  }
}

async function waitForHealth() {
  let lastError;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/unofficial/health/providers`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Health endpoint ${response.status} dondu.`);
    } catch (error) {
      lastError = error;
    }

    await sleep(1000);
  }

  throw new Error(`Sunucu hazir olmadi. Son hata: ${lastError?.message || "bilinmiyor"}`);
}

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${pathname} istegi basarisiz oldu: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
