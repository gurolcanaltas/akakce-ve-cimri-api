import { getProviders } from "../providers/index.js";

export function registerSearchRoute(app) {
  app.get("/api/unofficial/search", async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ error: "`q` query parametresi gerekli." });
    }

    const providers = getProviders();
    const settled = await Promise.allSettled(providers.map((provider) => provider.search(query)));

    const data = [];
    const errors = [];

    settled.forEach((result, index) => {
      const source = providers[index].source;
      if (result.status === "fulfilled") {
        data.push(...result.value);
      } else {
        errors.push({ source, message: result.reason.message });
      }
    });

    res.json({ query, data, errors });
  });
}
