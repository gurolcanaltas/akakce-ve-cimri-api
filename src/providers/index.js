import { AkakceProvider } from "./akakce.js";
import { CimriProvider } from "./cimri.js";

const providers = {
  akakce: new AkakceProvider(),
  cimri: new CimriProvider(),
};

export function getProvider(source) {
  const provider = providers[source];
  if (!provider) {
    throw new Error(`Unsupported provider: ${source}`);
  }

  return provider;
}

export function getProviders() {
  return Object.values(providers);
}
