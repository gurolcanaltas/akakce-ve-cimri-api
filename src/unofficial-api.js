import { registerByUrlRoutes } from "./routes/by-url.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerSearchRoute } from "./routes/search.js";

export function registerUnofficialApi(app) {
  registerSearchRoute(app);
  registerProductRoutes(app);
  registerByUrlRoutes(app);
  registerHealthRoutes(app);
}
