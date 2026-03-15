import { cacheStore } from "../cache/store.js";
import { getProviders } from "../providers/index.js";

export function registerHealthRoutes(app) {
  app.get("/api/unofficial/health/providers", async (_req, res) => {
    const providers = getProviders();
    const statuses = await Promise.all(providers.map((provider) => provider.healthCheck()));

    res.json({
      cache: cacheStore.stats(),
      providers: statuses,
    });
  });
}
