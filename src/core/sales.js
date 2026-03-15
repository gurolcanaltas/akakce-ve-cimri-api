import { normalizeWhitespace } from "./normalize.js";

function splitAkakceSeller(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return {
      merchantPlatform: null,
      seller: null,
      sellerDisplayName: null,
    };
  }

  const [platform, ...rest] = normalized.split("/").map((part) => normalizeWhitespace(part));
  const seller = rest.join(" / ") || null;

  return {
    merchantPlatform: seller ? platform : null,
    seller: seller || platform,
    sellerDisplayName: seller ? `${platform} / ${seller}` : platform,
  };
}

function buildSellerIdentity(source, offer) {
  if (source === "akakce") {
    const explicitPlatform = offer?.merchantPlatform ? normalizeWhitespace(offer.merchantPlatform) : null;
    const explicitSeller = offer?.seller ? normalizeWhitespace(offer.seller) : null;
    if (explicitPlatform || explicitSeller) {
      return {
        merchantPlatform: explicitPlatform || null,
        seller: explicitSeller || null,
        sellerDisplayName:
          explicitPlatform && explicitSeller && explicitPlatform !== explicitSeller
            ? `${explicitPlatform} / ${explicitSeller}`
            : explicitPlatform || explicitSeller || null,
      };
    }

    return splitAkakceSeller(offer?.seller);
  }

  const merchantPlatform = normalizeWhitespace(offer?.merchantPlatform);
  const seller = normalizeWhitespace(offer?.seller);
  const sellerDisplayName =
    merchantPlatform && seller && merchantPlatform !== seller
      ? `${merchantPlatform} / ${seller}`
      : merchantPlatform || seller || null;

  return {
    merchantPlatform: merchantPlatform || null,
    seller: seller || null,
    sellerDisplayName,
  };
}

function mapAvailabilityUrl(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes("instock")) {
    return { stockStatus: "in_stock", stockText: String(value), inStock: true };
  }

  if (normalized.includes("outofstock") || normalized.includes("soldout")) {
    return { stockStatus: "out_of_stock", stockText: String(value), inStock: false };
  }

  if (normalized.includes("limitedavailability")) {
    return { stockStatus: "limited_stock", stockText: String(value), inStock: true };
  }

  return null;
}

function mapStockFromText(...values) {
  const rawText = values
    .flat()
    .filter(Boolean)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(" | ");

  const normalized = rawText.toLocaleLowerCase("tr-TR");
  if (!normalized) {
    return {
      stockStatus: "unknown",
      stockText: null,
      inStock: null,
    };
  }

  if (
    /stokta yok|tukendi|tükendi|out of stock|gelince haber ver|mevcut degil|mevcut değil/.test(normalized)
  ) {
    return {
      stockStatus: "out_of_stock",
      stockText: rawText,
      inStock: false,
    };
  }

  if (/sinirli stok|sınırlı stok|son \d+ urun|son \d+ ürün|son urun|son ürün|limited/.test(normalized)) {
    return {
      stockStatus: "limited_stock",
      stockText: rawText,
      inStock: true,
    };
  }

  if (/stokta|hazir|hazır|mevcut|aynı gün kargo|ayni gun kargo|yarin kargoda|yarın kargoda/.test(normalized)) {
    return {
      stockStatus: "in_stock",
      stockText: rawText,
      inStock: true,
    };
  }

  return {
    stockStatus: "unknown",
    stockText: rawText,
    inStock: null,
  };
}

function buildStockInfo(offer) {
  const textBased = mapStockFromText(
    offer?.stockText,
    offer?.deliveryText,
    offer?.shipping,
    offer?.description,
    offer?.title,
    offer?.badges,
  );
  const availabilityBased = mapAvailabilityUrl(offer?.availability);

  if (textBased.stockText) {
    return {
      stockStatus:
        textBased.stockStatus !== "unknown" ? textBased.stockStatus : availabilityBased?.stockStatus ?? "unknown",
      stockText: textBased.stockText,
      inStock: textBased.inStock ?? availabilityBased?.inStock ?? null,
    };
  }

  return availabilityBased || textBased;
}

export function normalizeSalesOffers(source, offers = []) {
  return offers.map((offer) => {
    const sellerIdentity = buildSellerIdentity(source, offer);
    const stockInfo = buildStockInfo(offer);

    return {
      id: offer?.id ?? null,
      merchantPlatform: sellerIdentity.merchantPlatform,
      seller: sellerIdentity.seller,
      sellerDisplayName: sellerIdentity.sellerDisplayName,
      price: offer?.price ?? null,
      priceCurrency: offer?.priceCurrency ?? "TRY",
      stockStatus: stockInfo.stockStatus,
      stockText: stockInfo.stockText,
      inStock: stockInfo.inStock,
      sellerUrl: offer?.sellerUrl ?? null,
      offerUrl: offer?.url ?? null,
      redirectUrl: offer?.redirectUrl ?? offer?.url ?? null,
      targetUrl: offer?.targetUrl ?? null,
    };
  });
}
