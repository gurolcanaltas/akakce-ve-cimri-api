import * as cheerio from "cheerio";

import { cacheStore } from "../cache/store.js";
import { fetchJsonWithBrowser } from "../core/browser.js";
import { fetchDocument } from "../core/http.js";
import {
  buildSummary,
  ensureAbsoluteUrl,
  extractFirstPrice,
  extractOfferCount,
  normalizeWhitespace,
  pathnameToProductKey,
  productKeyToPathname,
} from "../core/normalize.js";
import { createProviderStatus } from "../types/product.js";

const BASE_URL = "https://www.akakce.com";

function buildAkakceClickUrl(value) {
  if (!value) {
    return null;
  }

  if (String(value).startsWith("http")) {
    return value;
  }

  if (String(value).startsWith("#/111/")) {
    return `${BASE_URL}/c/${String(value).slice("#/111/".length)}`;
  }

  return ensureAbsoluteUrl(BASE_URL, value);
}

function normalizeAkakcePgListOffers(items = []) {
  return items
    .map((item) => {
      const merchantPlatform = item?.vdName ? normalizeWhitespace(item.vdName) : null;
      const seller = item?.pgNick || item?.vdName ? normalizeWhitespace(item?.pgNick || item?.vdName) : null;

      return {
        id: item?.pgCode ? String(item.pgCode) : null,
        merchantPlatform:
          item?.hasLogo || (seller && merchantPlatform && seller !== merchantPlatform) ? merchantPlatform : null,
        seller,
        sellerUrl: null,
        price: Number.isFinite(item?.price) ? item.price : null,
        priceCurrency: "TRY",
        availability: Number.isFinite(item?.stock)
          ? item.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock"
          : null,
        condition: "https://schema.org/NewCondition",
        url: buildAkakceClickUrl(item?.url),
        redirectUrl: buildAkakceClickUrl(item?.url),
        targetUrl: null,
        title: normalizeWhitespace(item?.pgName) || null,
        description: normalizeWhitespace(item?.sloganText) || null,
        shipping: Number.isFinite(item?.shipPrice)
          ? item.shipPrice <= 0
            ? "Ucretsiz kargo"
            : `${item.shipPrice} TL kargo`
          : null,
        updatedAt: normalizeWhitespace(item?.lastUpdateTime) || null,
        stockText: Number.isFinite(item?.stock) ? `Stokta ${item.stock} adet` : null,
        deliveryText: normalizeWhitespace(item?.deliveryText) || null,
        sellerRating: item?.vdRating ? Number.parseFloat(String(item.vdRating).replace(",", ".")) || null : null,
        sellerRatingCount: Number.isFinite(item?.vdRatingCount) ? item.vdRatingCount : null,
        badges: [
          normalizeWhitespace(item?.badge),
          ...(Array.isArray(item?.campaigns)
            ? item.campaigns.map((campaign) => normalizeWhitespace(campaign?.text))
            : []),
        ].filter(Boolean),
        isAuthorizedSeller: Boolean(item?.isAVP),
      };
    })
    .filter((offer) => offer.seller || offer.price != null);
}

export class AkakceProvider {
  constructor() {
    this.source = "akakce";
    this.status = createProviderStatus(this.source);
  }

  async search(query) {
    const normalizedQuery = normalizeWhitespace(query);
    if (!normalizedQuery) {
      return [];
    }

    return this.#track("search", async () =>
      cacheStore.wrap(`akakce:search:${normalizedQuery}`, 5 * 60_000, async () => {
        const response = await fetchDocument(`${BASE_URL}/arama/?q=${encodeURIComponent(normalizedQuery)}`, {
          providerName: this.source,
          attempts: 2,
          allowBrowserFallback: true,
        });

        const $ = cheerio.load(response.html);
        return $("li[data-pr]")
          .map((_, element) => {
            const item = $(element);
            const link = item.find('a[href*="/en-ucuz-"]').first();
            const href = link.attr("href");
            const productUrl = ensureAbsoluteUrl(BASE_URL, href);
            if (!productUrl) {
              return null;
            }

            const summaryText = normalizeWhitespace(item.text());
            const brand = normalizeWhitespace(item.attr("data-mk"));

            return buildSummary({
              source: this.source,
              name: link.attr("title") || link.text(),
              brand: brand === "-" ? null : brand,
              price: extractFirstPrice(summaryText),
              offerCount: extractOfferCount(summaryText),
              productUrl,
              productKey: pathnameToProductKey(new URL(productUrl).pathname),
              imageUrl: ensureAbsoluteUrl(BASE_URL, item.find("img").attr("src")),
            });
          })
          .get()
          .filter(Boolean)
          .slice(0, 20);
      }),
    );
  }

  async getProduct(productKey) {
    return this.#track("getProduct", async () => {
      const raw = await this.#getRawProduct(productKey);
      return raw.detail;
    });
  }

  async getOffers(productKey) {
    return this.#track("getOffers", async () => {
      const raw = await this.#getRawProduct(productKey);
      return raw.offers;
    });
  }

  async healthCheck() {
    try {
      await fetchDocument(`${BASE_URL}/robots.txt`, {
        providerName: this.source,
        attempts: 1,
      });

      return {
        ...this.status,
        healthy: true,
      };
    } catch (error) {
      return {
        ...this.status,
        healthy: false,
        lastError: error.message,
      };
    }
  }

  async #getRawProduct(productKey) {
    const pathname = this.#resolvePathname(productKey);
    const url = ensureAbsoluteUrl(BASE_URL, pathname);

    return cacheStore.wrap(`akakce:product:${pathname}`, 10 * 60_000, async () => {
      const response = await fetchDocument(url, {
        providerName: this.source,
        attempts: 2,
        allowBrowserFallback: true,
      });
      const $ = cheerio.load(response.html);

      const jsonLd = $('script[type="application/ld+json"]')
        .map((_, element) => $(element).text().trim())
        .get()
        .map((entry) => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .find((entry) => entry?.["@type"] === "ProductGroup");

      if (!jsonLd) {
        throw new Error("Akakce product payload was not found.");
      }

      const jsonLdOffers = Array.isArray(jsonLd.offers?.offers)
        ? jsonLd.offers.offers.map((offer, index) => ({
            id: `${jsonLd.sku}-${index + 1}`,
            merchantPlatform: offer?.seller?.name ? normalizeWhitespace(offer.seller.name).split("/")[0] || null : null,
            seller: offer?.seller?.name
              ? normalizeWhitespace(offer.seller.name).split("/").slice(1).join("/") || normalizeWhitespace(offer.seller.name)
              : null,
            sellerUrl: offer?.seller?.url ?? null,
            price: Number.parseFloat(offer?.price ?? "0") || null,
            priceCurrency: offer?.priceCurrency ?? "TRY",
            availability: offer?.availability ?? null,
            condition: offer?.itemCondition ?? null,
            url: offer?.url ?? null,
            redirectUrl: null,
            targetUrl: offer?.url ?? null,
          }))
        : [];

      let offers = jsonLdOffers;
      try {
        const pgListResponse = await fetchJsonWithBrowser(
          url,
          `https://api6.akakce.com/product/pgList?prCode=${jsonLd.sku}&sortChar=p&hasVdc=true&flagShippedToday=false&showMore=true&ctMaxInstCount=9`,
          { timeoutMs: 45000, waitAfterLoadMs: 4000 },
        );

        const pgListOffers = normalizeAkakcePgListOffers(pgListResponse?.data?.result?.pgList);
        if (pgListOffers.length > 0) {
          offers = pgListOffers;
        }
      } catch {
        // Fall back to the limited JSON-LD offer list.
      }

      const detail = {
        source: this.source,
        id: jsonLd.sku,
        productKey: pathnameToProductKey(new URL(url).pathname),
        name: jsonLd.name,
        brand: jsonLd.brand?.name ?? null,
        category: jsonLd.category ?? null,
        description: jsonLd.description ?? null,
        url,
        imageUrl: Array.isArray(jsonLd.image) ? jsonLd.image[0]?.contentUrl ?? null : null,
        lowestPrice: Number.parseFloat(jsonLd.offers?.lowPrice ?? "0") || null,
        highestPrice: Number.parseFloat(jsonLd.offers?.highPrice ?? "0") || null,
        offerCount: Number.parseInt(jsonLd.offers?.offerCount ?? "0", 10) || offers.length,
        rating: Number.parseFloat(jsonLd.aggregateRating?.ratingValue ?? "0") || null,
        ratingCount: Number.parseInt(jsonLd.aggregateRating?.ratingCount ?? "0", 10) || null,
        variants: Array.isArray(jsonLd.hasVariant)
          ? jsonLd.hasVariant.map((variant) => ({
              id: variant.sku ?? null,
              name: variant.name ?? null,
              color: variant.color ?? null,
              url: variant.url ?? null,
              imageUrl: variant.image ?? null,
              lowestPrice: Number.parseFloat(variant.offers?.[0]?.price ?? "0") || null,
            }))
          : [],
        specs: Array.isArray(jsonLd.additionalProperty)
          ? jsonLd.additionalProperty.map((property) => ({
              name: property.name,
              value: property.value,
            }))
          : [],
      };

      return { detail, offers };
    });
  }

  #resolvePathname(productKey) {
    if (!productKey) {
      throw new Error("Akakce product key is required.");
    }

    if (String(productKey).startsWith("/")) {
      return productKey;
    }

    if (String(productKey).includes("__")) {
      return productKeyToPathname(productKey);
    }

    if (String(productKey).includes(".html")) {
      return `/${String(productKey).replace(/^\/+/, "")}`;
    }

    throw new Error(
      "Akakce product key must be a summary productKey value like cep-telefonu__en-ucuz-iphone-15-fiyati,1745758198.html",
    );
  }

  async #track(action, task) {
    const startedAt = Date.now();
    this.status.lastAttemptAt = new Date(startedAt).toISOString();

    try {
      const result = await task();
      this.status.healthy = true;
      this.status.lastSuccessAt = new Date().toISOString();
      this.status.lastDurationMs = Date.now() - startedAt;
      this.status.consecutiveFailures = 0;
      this.status.lastError = null;
      return result;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastDurationMs = Date.now() - startedAt;
      this.status.consecutiveFailures += 1;
      this.status.lastError = error.message;
      throw error;
    }
  }
}
