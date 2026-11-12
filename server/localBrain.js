/**
 * Local Ollama bridge with a small deterministic fallback for supported tasks.
 */

const http = require("http");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "127.0.0.1";
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT) || 11434;

async function checkOllamaAvailable() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: "/api/tags",
        method: "GET",
        timeout: 800,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function callOllama({ prompt, system, model = "llama3.2:1b" }) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      prompt,
      system: system || "You are Sia. Be accurate, and say when you cannot complete a request.",
      stream: false,
    });

    const req = http.request(
      {
        host: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: "/api/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data.response || "");
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama request timed out"));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Small deterministic fallback for tasks that can be answered from local state.
 */
function solveSovereignHeuristic(message) {
  const text = message.trim();
  const lower = text.toLowerCase();

  // 1. Safe Mathematical Evaluation
  const mathMatch = lower.match(/^(?:calculate|what is|compute|solve)?\s*([0-9\s+\-*/().^%]+)$/);
  if (mathMatch && mathMatch[1].trim().length > 1 && /[0-9]/.test(mathMatch[1])) {
    const expr = mathMatch[1].replace(/\^/g, "**").replace(/%/g, "* 0.01");
    // Ensure only safe math characters
    if (/^[0-9+\-*/().\s*]+$/.test(expr)) {
      try {
        const val = Function(`"use strict"; return (${expr})`)();
        if (typeof val === "number" && !isNaN(val)) {
          return `The calculated result is **${Number(val.toFixed(8)).toString()}**.`;
        }
      } catch (_) {}
    }
  }

  // 2. Identity
  if (lower.includes("who are you") || lower.includes("what is your name") || lower.includes("introduce yourself")) {
    return "I am Sia. In offline fallback mode, I can answer basic arithmetic and local date/time questions; cloud AI and device-control tasks may be unavailable.";
  }

  if (lower.includes("what can you do") || lower.includes("your capabilities") || lower.includes("help me")) {
    return "Offline fallback supports basic arithmetic and local date/time questions. Other requests need a connected AI model, and device actions require the device-control service.";
  }

  // 3. Time, Date, and System
  if (lower === "time" || lower.includes("what time is it") || lower.includes("current time")) {
    return `Current system time is **${new Date().toLocaleTimeString()}**.`;
  }

  if (lower === "date" || lower.includes("what date is it") || lower.includes("today's date")) {
    return `Today's date is **${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**.`;
  }

  return null;
}

/**
 * Main Entry Point for Local Intelligence
 */
async function generateLocalFallback({ message, history = [] }) {
  const isOllamaUp = await checkOllamaAvailable();

  if (isOllamaUp) {
    try {
      const response = await callOllama({ prompt: message });
      if (response && response.trim().length > 0) {
        return {
          answer: response.trim(),
          routing: {
            category: "offline_ollama",
            model: "ollama/local",
            modelLabel: "🦙 Ollama Local SLM (Offline)",
            why: "Executed via local hardware SLM with 0ms network latency and $0 token cost.",
          },
        };
      }
    } catch (err) {
      console.warn("[LocalBrain] Ollama query failed; checking deterministic offline support:", err.message);
    }
  }

  // Use deterministic answers only for tasks this fallback can actually handle.
  const answer = solveSovereignHeuristic(message);
  if (answer === null) {
    throw new Error(
      "Cloud AI models are unavailable and no local Ollama model is responding. This request cannot be completed in offline fallback mode."
    );
  }

  return {
    answer,
    routing: {
      category: "offline_sovereign",
      model: "sovereign-heuristic",
      modelLabel: "Offline deterministic fallback",
      why: "Answered locally using a limited set of deterministic capabilities.",
    },
  };
}

module.exports = {
  checkOllamaAvailable,
  callOllama,
  generateLocalFallback,
  solveSovereignHeuristic,
};
