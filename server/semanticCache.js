/**
 * In-Memory Semantic LRU Response Cache for Sia AI
 * Provides sub-millisecond (<1ms) responses for repeated or high-similarity queries.
 */

class SemanticCache {
  constructor({ maxEntries = 1500, ttlMs = 2 * 60 * 60 * 1000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.cache = new Map(); // key -> { response, routing, steps, timestamp, tokens }
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

  get(rawQuery) {
    if (!rawQuery || this.isNonCacheable(rawQuery)) {
      this.misses++;
      return null;
    }

    const norm = this.normalize(rawQuery);
    if (!norm) return null;

    const now = Date.now();

    // 1. Exact Match (O(1) lookup < 0.02ms)
    if (this.cache.has(norm)) {
      const entry = this.cache.get(norm);
      if (now - entry.timestamp < this.ttlMs) {
        // Refresh LRU position
        this.cache.delete(norm);
        this.cache.set(norm, entry);
        this.hits++;
        return { ...entry, fromCache: true, matchType: "exact" };
      } else {
        this.cache.delete(norm);
      }
    }

    // 2. High-Confidence Fuzzy Token Match (>= 0.88 similarity for queries > 3 words)
    const queryTokens = this.tokenize(norm);
    if (queryTokens.size >= 3) {
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.ttlMs) {
          this.cache.delete(key);
          continue;
        }

        const sim = this.jaccardSimilarity(queryTokens, entry.tokens);
        if (sim >= 0.88) {
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

  set(rawQuery, data) {
    if (!rawQuery || !data || this.isNonCacheable(rawQuery)) return;

    const norm = this.normalize(rawQuery);
    if (!norm) return;

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const tokens = this.tokenize(norm);
    this.cache.set(norm, {
      answer: data.answer || data.reply,
      routing: data.routing || null,
      steps: data.steps || [],
      timestamp: Date.now(),
      tokens,
    });
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : 0;
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }
}

const semanticCache = new SemanticCache();
module.exports = { semanticCache, SemanticCache };
