export function createProviderStatus(source) {
  return {
    source,
    healthy: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastDurationMs: null,
    consecutiveFailures: 0,
    lastError: null,
  };
}
