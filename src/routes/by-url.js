import { parseProviderProductUrl } from "../core/normalize.js";
import { normalizeSalesOffers } from "../core/sales.js";
import { getProvider } from "../providers/index.js";

export function registerByUrlRoutes(app) {
  app.get("/api/unofficial/by-url", async (req, res) => {
    try {
      const { source, productKey, url } = parseProviderProductUrl(req.query.url);
      const provider = getProvider(source);
      const detail = await provider.getProduct(productKey);

      res.json({
        requestedUrl: url,
        source,
        productKey,
        detail,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/unofficial/by-url/offers", async (req, res) => {
    try {
      const { source, productKey, url } = parseProviderProductUrl(req.query.url);
      const provider = getProvider(source);
      const offers = await provider.getOffers(productKey);

      res.json({
        requestedUrl: url,
        source,
        productKey,
        offers,
        sales: normalizeSalesOffers(source, offers),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/unofficial/by-url/sales", async (req, res) => {
    try {
      const { source, productKey, url } = parseProviderProductUrl(req.query.url);
      const provider = getProvider(source);
      const offers = await provider.getOffers(productKey);

      res.json({
        requestedUrl: url,
        source,
        productKey,
        sales: normalizeSalesOffers(source, offers),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
}
