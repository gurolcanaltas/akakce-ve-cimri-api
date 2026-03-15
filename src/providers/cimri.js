import * as cheerio from "cheerio";

import { cacheStore } from "../cache/store.js";
import { fetchHtmlWithBrowser } from "../core/browser.js";
import { fetchDocument } from "../core/http.js";
import {
  buildSummary,
  ensureAbsoluteUrl,
  extractOfferCount,
  normalizeWhitespace,
  parseTurkishPrice,
  pathnameToProductKey,
  productKeyToPathname,
} from "../core/normalize.js";
import { createProviderStatus } from "../types/product.js";

const BASE_URL = "https://www.cimri.com";

function buildCimriOfferRedirectUrl(detailId, offerId) {
  if (!detailId || !offerId) {
    return null;
  }

  return `${BASE_URL}/offer/${offerId}?productId=${detailId}`;
}

function parseNextDataProduct($, nextData) {
  const directProduct = nextData?.props?.pageProps?.data?.product;
  if (directProduct) {
    return directProduct;
  }

  const payload = $('script#__NEXT_DATA__').first().html();
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload)?.props?.pageProps?.data?.product ?? null;
  } catch {
    return null;
  }
}

function mapNextDataOffers(product, detailId) {
  if (!Array.isArray(product?.offers)) {
    return [];
  }

  return product.offers
    .map((offer) => {
      const merchantName = normalizeWhitespace(offer?.merchant?.name) || null;
      const sellerName =
        normalizeWhitespace(offer?.merchant?.sellerNameOrMerchantName) ||
        normalizeWhitespace(offer?.merchant?.seller) ||
        merchantName;

      return {
        id: detailId && offer?.id ? `${detailId}-${offer.id}` : offer?.id ?? null,
        badges: Array.isArray(offer?.badgesData)
          ? offer.badgesData
              .map((badge) => normalizeWhitespace(badge?.label))
              .filter(Boolean)
          : [],
        merchantPlatform: merchantName,
        seller: sellerName,
        sellerRating: Number.isFinite(offer?.ratings?.averageRate) ? offer.ratings.averageRate : null,
        title: normalizeWhitespace(offer?.title) || null,
        description: normalizeWhitespace(offer?.merchant?.slogan) || null,
        price: Number.isFinite(offer?.price) ? offer.price : null,
        previousPrice:
          Number.isFinite(offer?.originalPrice) && offer.originalPrice !== offer.price
            ? offer.originalPrice
            : null,
        shipping: normalizeWhitespace(offer?.shipping?.text) || null,
        updatedAt: normalizeWhitespace(offer?.offerUpdateTime) || null,
        redirectUrl: buildCimriOfferRedirectUrl(detailId, offer?.id),
        targetUrl: null,
        url: null,
      };
    })
    .filter((offer) => offer.title || offer.seller || offer.price != null);
}

export class CimriProvider {
  constructor() {
    this.source = "cimri";
    this.status = createProviderStatus(this.source);
  }

  async search(query) {
    const normalizedQuery = normalizeWhitespace(query);
    if (!normalizedQuery) {
      return [];
    }

    return this.#track("search", async () =>
      cacheStore.wrap(`cimri:search:${normalizedQuery}`, 5 * 60_000, async () => {
        const response = await fetchDocument(`${BASE_URL}/arama?q=${encodeURIComponent(normalizedQuery)}`, {
          providerName: this.source,
          attempts: 2,
          allowBrowserFallback: true,
        });

        const finalPath = new URL(response.url).pathname;
        if (!finalPath.startsWith("/arama")) {
          const detail = await this.#parseProductPage(response.html, response.url, response.nextData);
          return [
            buildSummary({
              source: this.source,
              name: detail.name,
              brand: detail.brand,
              price: detail.lowestPrice,
              offerCount: detail.offerCount,
              productUrl: detail.url,
              productKey: detail.productKey,
              imageUrl: detail.imageUrl,
            }),
          ];
        }

        const $ = cheerio.load(response.html);
        const cards = $("article")
          .map((_, element) => {
            const article = $(element);
            const link = article.find('a[href*=",a"]').first();
            const href = link.attr("href");
            const productUrl = ensureAbsoluteUrl(BASE_URL, href);
            if (!productUrl) {
              return null;
            }

            const title =
              normalizeWhitespace(article.find("[title]").first().attr("title")) ||
              normalizeWhitespace(article.find("img[alt]").first().attr("alt")) ||
              normalizeWhitespace(link.text());

            if (!title) {
              return null;
            }

            const merchant = normalizeWhitespace(article.find(".IHhYD span, .zp61l").first().text());
            const offerText = normalizeWhitespace(article.text());

            return buildSummary({
              source: this.source,
              name: title,
              brand: title.split(" ")[0] || null,
              price: parseTurkishPrice(article.find(".h1Anp, .rTdMX").first().text()),
              offerCount: extractOfferCount(offerText),
              productUrl,
              productKey: pathnameToProductKey(new URL(productUrl).pathname),
              imageUrl: ensureAbsoluteUrl(BASE_URL, article.find("img").first().attr("src")),
              merchant,
            });
          })
          .get()
          .filter(Boolean);

        const seen = new Set();
        return cards
          .filter((item) => {
            if (seen.has(item.productKey)) {
              return false;
            }
            seen.add(item.productKey);
            return true;
          })
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

    return cacheStore.wrap(`cimri:product:${pathname}`, 10 * 60_000, async () => {
      let response;
      try {
        // Product detail pages expose the full offer list in hydrated browser state.
        response = await fetchHtmlWithBrowser(url, {
          timeoutMs: 45000,
          waitAfterLoadMs: 4000,
          readNextData: true,
        });
      } catch {
        response = await fetchDocument(url, {
          providerName: this.source,
          attempts: 2,
          allowBrowserFallback: true,
          browserOptions: {
            waitAfterLoadMs: 4000,
          },
        });
      }

      return this.#parseProductPage(response.html, response.url, response.nextData);
    });
  }

  async #parseProductPage(html, url, nextData) {
    const $ = cheerio.load(html);
    const nextDataProduct = parseNextDataProduct($, nextData);

    const name = normalizeWhitespace($("h1 span").first().text());
    if (!name) {
      throw new Error("Cimri product page could not be parsed.");
    }

    const productKey = pathnameToProductKey(new URL(url).pathname);
    const stickySection = $("section.rbaQu").first();
    const offerCountText = $("#fiyatlar .efKIY").first().text() || $("body").text();

    const detail = {
      source: this.source,
      id: (new URL(url).pathname.match(/a(\d+)/) || [null, null])[1],
      productKey,
      name,
      brand: normalizeWhitespace($("h1 a").first().text()) || name.split(" ")[0] || null,
      category: normalizeWhitespace($("#breadcrumb a").last().text()) || null,
      description: normalizeWhitespace($('meta[name="description"]').attr("content")) || null,
      url,
      imageUrl: ensureAbsoluteUrl(BASE_URL, $(".keen-slider img").first().attr("src")),
      lowestPrice: parseTurkishPrice(stickySection.find(".yEvpr").first().text()),
      offerCount: Math.max(extractOfferCount(offerCountText) ?? 0, nextDataProduct?.offers?.length ?? 0) || null,
      merchant: normalizeWhitespace(stickySection.find(".b1vdn").first().text()) || null,
      merchantRating: parseTurkishPrice(stickySection.find(".kjHjJ").first().text()),
      variants: [
        ...$(".GB4Jy, .UFnf_")
          .map((_, element) => {
            const item = $(element);
            const href = item.attr("href");
            const variantName = normalizeWhitespace(item.attr("title") || item.text());

            if (!variantName || variantName.startsWith("+-")) {
              return null;
            }

            const type = item.attr("data-type") === "main" ? "capacity" : "variant";
            const priceText = type === "variant" ? normalizeWhitespace(item.find("span").last().text()) : null;

            return {
              type,
              name: variantName,
              url: ensureAbsoluteUrl(BASE_URL, href),
              lowestPrice: parseTurkishPrice(priceText),
              selected: item.attr("data-selected") === "true",
            };
          })
          .get()
          .filter(Boolean),
      ],
      specs: $("#teknik-ozellikler h3")
        .map((_, heading) => {
          const title = normalizeWhitespace($(heading).text());
          const rows = $(heading)
            .next("table")
            .find("tbody tr")
            .map((__, row) => {
              const cells = $(row).find("td");
              return {
                name: normalizeWhitespace(cells.first().text()),
                value: normalizeWhitespace(cells.last().text()),
              };
            })
            .get()
            .filter((row) => row.name && row.value);

          return rows.length ? { group: title, rows } : null;
        })
        .get()
        .filter(Boolean),
    };

    const offers =
      mapNextDataOffers(nextDataProduct, detail.id).length > 0
        ? mapNextDataOffers(nextDataProduct, detail.id)
        : $("#fiyatlar .o1fRW[data-offer]")
            .map((_, element) => {
              const item = $(element);
              const shippingAndUpdated = item
                .find(".sS0lR > span")
                .map((__, span) => normalizeWhitespace($(span).text()))
                .get();

              return {
                id: `${detail.id}-${item.attr("data-offer")}`,
                badges: item
                  .find(".C5StE .PeJjP")
                  .map((__, badge) => normalizeWhitespace($(badge).text()))
                  .get()
                  .filter(Boolean),
                merchantPlatform: normalizeWhitespace(item.find(".LUOwR img").attr("alt")) || null,
                seller: normalizeWhitespace(item.find(".zp61l").first().text()) || null,
                sellerRating: parseTurkishPrice(item.find(".kjHjJ").first().text()),
                title: normalizeWhitespace(item.find(".ZTKTN").first().text()) || null,
                description: normalizeWhitespace(item.find(".EKMIN").first().text()) || null,
                price: parseTurkishPrice(item.find(".rTdMX").first().text()),
                previousPrice: parseTurkishPrice(item.find(".s4ype").first().text()),
                shipping: shippingAndUpdated[0] || null,
                updatedAt: shippingAndUpdated[1] || null,
                redirectUrl: null,
                targetUrl: null,
                url: null,
              };
            })
            .get()
            .filter((offer) => offer.title || offer.seller || offer.price != null);

    return { detail, offers };
  }

  #resolvePathname(productKey) {
    if (!productKey) {
      throw new Error("Cimri product key is required.");
    }

    if (String(productKey).startsWith("/")) {
      return productKey;
    }

    if (String(productKey).includes("__")) {
      return productKeyToPathname(productKey);
    }

    throw new Error(
      "Cimri product key must be a summary productKey value like cep-telefonlari__en-ucuz-apple-iphone-15-5g-128gb-akilli-cep-telefonu-fiyatlari,a2231112273",
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
