class MemoryTtlStore {
  constructor() {
    this.entries = new Map();
    this.inflight = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  async wrap(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key);
    }

    const pending = Promise.resolve()
      .then(factory)
      .then((value) => this.set(key, value, ttlMs))
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, pending);
    return pending;
  }

  stats() {
    return {
      keys: this.entries.size,
      inflight: this.inflight.size,
    };
  }
}

export const cacheStore = new MemoryTtlStore();
