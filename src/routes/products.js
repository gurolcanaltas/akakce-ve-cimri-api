import { normalizeSalesOffers } from "../core/sales.js";
import { getProvider } from "../providers/index.js";

export function registerProductRoutes(app) {
  app.get("/api/unofficial/products/:source/:idOrSlug", async (req, res) => {
    try {
      const provider = getProvider(req.params.source);
      const detail = await provider.getProduct(req.params.idOrSlug);
      res.json(detail);
    } catch (error) {
      const statusCode = /unsupported provider/i.test(error.message) ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  });

  app.get("/api/unofficial/products/:source/:idOrSlug/offers", async (req, res) => {
    try {
      const provider = getProvider(req.params.source);
      const offers = await provider.getOffers(req.params.idOrSlug);
      res.json({
        source: provider.source,
        productKey: req.params.idOrSlug,
        offers,
        sales: normalizeSalesOffers(provider.source, offers),
      });
    } catch (error) {
      const statusCode = /unsupported provider/i.test(error.message) ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  });

  app.get("/api/unofficial/products/:source/:idOrSlug/sales", async (req, res) => {
    try {
      const provider = getProvider(req.params.source);
      const offers = await provider.getOffers(req.params.idOrSlug);
      res.json({
        source: provider.source,
        productKey: req.params.idOrSlug,
        sales: normalizeSalesOffers(provider.source, offers),
      });
    } catch (error) {
      const statusCode = /unsupported provider/i.test(error.message) ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    }
  });
}
