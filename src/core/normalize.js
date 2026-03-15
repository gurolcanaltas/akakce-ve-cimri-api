export function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function parseTurkishPrice(value) {
  if (value == null) {
    return null;
  }

  const normalized = normalizeWhitespace(String(value))
    .replace(/TL/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized) {
    return null;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function extractFirstPrice(value) {
  const match = normalizeWhitespace(value).match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*TL/i);
  return match ? parseTurkishPrice(match[1]) : null;
}

export function extractOfferCount(value) {
  const match =
    normalizeWhitespace(value).match(/\+?\s*(\d+)\s*(?:adet\s+)?fiyat/i) ||
    normalizeWhitespace(value).match(/(\d+)\s*adet\s+fiyat/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function ensureAbsoluteUrl(baseUrl, href) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function pathnameToProductKey(pathname = "") {
  return pathname.replace(/^\/+/, "").replace(/\/+/g, "__");
}

export function productKeyToPathname(key = "") {
  return `/${String(key).replace(/^\/+/, "").split("__").join("/")}`;
}

export function parseProviderProductUrl(value) {
  if (!value) {
    throw new Error("url query parameter is required.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(String(value));
  } catch {
    throw new Error("A valid absolute URL is required.");
  }

  const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
  let source = null;

  if (hostname === "akakce.com") {
    source = "akakce";
  } else if (hostname === "cimri.com") {
    source = "cimri";
  }

  if (!source) {
    throw new Error("URL must belong to Akakce or Cimri.");
  }

  if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
    throw new Error("Product URL path could not be resolved.");
  }

  return {
    source,
    productKey: pathnameToProductKey(parsedUrl.pathname),
    url: parsedUrl.toString(),
  };
}

export function extractNumericId(value = "") {
  const match = String(value).match(/(?:,|a)(\d+)(?:\.html)?$/) || String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

export function buildSummary({
  source,
  name,
  brand = null,
  price = null,
  offerCount = null,
  productUrl,
  imageUrl = null,
  productKey,
}) {
  return {
    source,
    id: extractNumericId(productUrl || productKey || name),
    productKey,
    name: normalizeWhitespace(name),
    brand: brand ? normalizeWhitespace(brand) : null,
    lowestPrice: price,
    offerCount,
    url: productUrl,
    imageUrl,
  };
}
