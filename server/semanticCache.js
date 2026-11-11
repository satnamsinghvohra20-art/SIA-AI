/**
 * In-Memory Semantic LRU Response Cache for Sia AI
 * Provides sub-millisecond (<1ms) responses for repeated or high-similarity queries.
 */

class SemanticCache {
  constructor({ maxEntries = 1500, ttlMs = 2 * 60 * 60 * 1000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.cache = new Map(); // key -> { answer, routing, steps, timestamp, tokens }
    this.tokenIndex = new Map(); // token -> Set<key>
    this.hits = 0;
    this.misses = 0;
  }

  normalize(text) {
    if (!text || typeof text !== "string") return "";
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ");
  }

  tokenize(normalized) {
    return new Set(normalized.split(" ").filter((t) => t.length > 1));
  }

  _addTokens(key, tokens) {
    for (const token of tokens) {
      let set = this.tokenIndex.get(token);
      if (!set) {
        set = new Set();
        this.tokenIndex.set(token, set);
      }
      set.add(key);
    }
  }

  _removeTokens(key, tokens) {
    for (const token of tokens) {
      const set = this.tokenIndex.get(token);
      if (set) {
        set.delete(key);
        if (set.size === 0) {
          this.tokenIndex.delete(token);
        }
      }
    }
  }

  _evict(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this._removeTokens(key, entry.tokens);
      this.cache.delete(key);
    }
  }

  jaccardSimilarity(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  isNonCacheable(text) {
    const t = text.toLowerCase();
    const dynamicKeywords = [
      "time", "date", "battery", "screenshot", "weather right now",
      "shutdown", "restart", "delete", "move", "rename",
      "volume", "scroll", "click", "mouse", "type", "press"
    ];
    return dynamicKeywords.some((k) => t.includes(k));
  }

  get(rawQuery, { scope } = {}) {
    if (!scope || !rawQuery || this.isNonCacheable(rawQuery)) {
      this.misses++;
      return null;
    }

    const norm = this.normalize(rawQuery);
    if (!norm) return null;

    const now = Date.now();
    const cacheKey = `${scope}\0${norm}`;

    // 1. Exact Match (O(1) lookup < 0.01ms)
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (now - entry.timestamp < this.ttlMs) {
        // Refresh LRU position
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, entry);
        this.hits++;
        return { ...entry, fromCache: true, matchType: "exact" };
      } else {
        this._evict(cacheKey);
      }
    }

    // 2. High-Confidence Fuzzy Token Match with Inverted Index Pruning (O(k) where k << N)
    const queryTokens = this.tokenize(norm);
    if (queryTokens.size >= 3) {
      const candidateKeys = new Set();
      for (const token of queryTokens) {
        const matching = this.tokenIndex.get(token);
        if (matching) {
          for (const key of matching) {
            candidateKeys.add(key);
          }
        }
      }

      for (const key of candidateKeys) {
        const entry = this.cache.get(key);
        if (!entry || entry.scope !== scope) continue;

        if (now - entry.timestamp > this.ttlMs) {
          this._evict(key);
          continue;
        }

        const sim = this.jaccardSimilarity(queryTokens, entry.tokens);
        if (sim >= 0.75) {
          this.cache.delete(key);
          this.cache.set(key, entry);
          this.hits++;
          return { ...entry, fromCache: true, matchType: "fuzzy", similarity: sim };
        }
      }
    }

    this.misses++;
    return null;
  }

  set(rawQuery, data, { scope } = {}) {
    if (!scope || !rawQuery || !data || this.isNonCacheable(rawQuery)) return;

    const norm = this.normalize(rawQuery);
    if (!norm) return;
    const cacheKey = `${scope}\0${norm}`;

    // If key already exists, clean up old index entries
    if (this.cache.has(cacheKey)) {
      this._evict(cacheKey);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this._evict(oldestKey);
    }

    const tokens = this.tokenize(norm);
    const entry = {
      answer: data.answer || data.reply,
      routing: data.routing || null,
      steps: data.steps || [],
      timestamp: Date.now(),
      tokens,
      scope,
    };

    this.cache.set(cacheKey, entry);
    this._addTokens(cacheKey, tokens);
  }

  clear() {
    this.cache.clear();
    this.tokenIndex.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : 0;
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      indexedTokens: this.tokenIndex.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }
}

const semanticCache = new SemanticCache();
module.exports = { semanticCache, SemanticCache };
