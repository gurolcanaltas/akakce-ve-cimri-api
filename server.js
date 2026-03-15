import express from "express";
import { registerUnofficialApi } from "./src/unofficial-api.js";

const app = express();
const port = process.env.PORT || 3456;

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Unofficial API Denemesi",
    endpoints: [
      "/api/unofficial/search?q=iphone 15",
      "/api/unofficial/products/akakce/:productKey",
      "/api/unofficial/products/akakce/:productKey/offers",
      "/api/unofficial/products/akakce/:productKey/sales",
      "/api/unofficial/products/cimri/:productKey",
      "/api/unofficial/products/cimri/:productKey/offers",
      "/api/unofficial/products/cimri/:productKey/sales",
      "/api/unofficial/by-url?url=https://www.akakce.com/...",
      "/api/unofficial/by-url/offers?url=https://www.akakce.com/...",
      "/api/unofficial/by-url/sales?url=https://www.akakce.com/...",
      "/api/unofficial/health/providers",
    ],
  });
});

registerUnofficialApi(app);

const server = app.listen(port, () => {
  console.log(`Unofficial API listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
