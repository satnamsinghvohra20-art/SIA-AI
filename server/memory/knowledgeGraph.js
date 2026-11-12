const fs = require("fs");
const path = require("path");
const { callOpenRouter, isFreeTierAccount } = require("../openrouterClient");
const { getModelForCategory } = require("../modelRegistry");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const GLOBAL_KNOWLEDGE_PATH = path.join(DATA_DIR, "knowledge.json");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sessionKnowledgePath(sessionId) {
  const dir = path.join(SESSIONS_DIR, sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "knowledge.json");
}

function defaultKnowledge() {
  return {
    user: {
      name: "Sir",
      preferences: {},
      interests: [],
    },
    contacts: {},
    projects: {},
    facts: [],
    last_updated: new Date().toISOString(),
  };
}

function readKnowledge(sessionId) {
  ensureDataDir();
  const sessionPath = sessionId ? sessionKnowledgePath(sessionId) : null;
  const targetPath = (sessionPath && fs.existsSync(sessionPath)) ? sessionPath : GLOBAL_KNOWLEDGE_PATH;

  if (!fs.existsSync(targetPath)) {
    const initial = defaultKnowledge();
    try {
      fs.writeFileSync(targetPath, JSON.stringify(initial, null, 2));
    } catch (_) {}
    return initial;
  }

  try {
    const raw = fs.readFileSync(targetPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[KnowledgeGraph] Read error from ${targetPath}:`, err.message);
    return defaultKnowledge();
  }
}

function writeKnowledge(sessionId, data) {
  ensureDataDir();
  data.last_updated = new Date().toISOString();
  const serialized = JSON.stringify(data, null, 2);

  if (sessionId) {
    try {
      fs.writeFileSync(sessionKnowledgePath(sessionId), serialized);
    } catch (e) {
      console.error(`[KnowledgeGraph] Failed writing session knowledge:`, e.message);
    }
  }

  // Also persist to global shared knowledge store
  try {
    fs.writeFileSync(GLOBAL_KNOWLEDGE_PATH, serialized);
  } catch (e) {
    console.error(`[KnowledgeGraph] Failed writing global knowledge:`, e.message);
  }

  return data;
}

function addFact(sessionId, category, key, value) {
  const k = readKnowledge(sessionId);
  if (category === "user_preference" && key) {
    k.user.preferences[key] = value;
  } else if (category === "contact" && key) {
    k.contacts[key] = value;
  } else if (category === "project" && key) {
    k.projects[key] = value;
  } else {
    k.facts.push({
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: category || "general",
      text: typeof value === "string" ? value : JSON.stringify(value),
      created_at: new Date().toISOString(),
    });
  }
  return writeKnowledge(sessionId, k);
}

function deleteFact(sessionId, factId) {
  const k = readKnowledge(sessionId);
  k.facts = k.facts.filter((f) => f.id !== factId);
  return writeKnowledge(sessionId, k);
}

/**
 * Non-blocking background worker that analyzes conversation turns
 * and extracts new persistent facts into the knowledge graph.
 */
async function extractAndSyncKnowledge(sessionId, userMessage, assistantReply) {
  if (!userMessage || userMessage.length < 5) return;

  const currentKnowledge = readKnowledge(sessionId);

  const extractionPrompt = `You are Sia's long-term memory extraction agent.
Analyze the following conversation turn between User and Sia. Extract any NEW persistent facts, user preferences, projects, contact info, tools, or recurring objectives.

Current Knowledge Graph:
${JSON.stringify(currentKnowledge, null, 2)}

User Message: "${userMessage}"
Assistant Reply: "${assistantReply ? assistantReply.slice(0, 300) : ""}"

Return a JSON object ONLY with any NEW updates to merge (do not duplicate existing knowledge). Schema:
{
  "user_name": string | null,
  "new_preferences": { [key: string]: string },
  "new_contacts": { [nameOrRole: string]: string },
  "new_projects": { [projectName: string]: string },
  "new_facts": [ string ]
}
If no new persistent information was shared, return:
{
  "user_name": null,
  "new_preferences": {},
  "new_contacts": {},
  "new_projects": {},
  "new_facts": []
}`;

  try {
    const rawResult = await callOpenRouter({
      model: getModelForCategory("fast_general", { freeTier: isFreeTierAccount() }).model,
      messages: [{ role: "user", content: extractionPrompt }],
      max_tokens: 400,
      temperature: 0.1,
    });

    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const updates = JSON.parse(jsonMatch[0]);
    let hasChanges = false;

    if (updates.user_name && updates.user_name !== "Sir" && updates.user_name !== currentKnowledge.user.name) {
      currentKnowledge.user.name = updates.user_name;
      hasChanges = true;
    }

    if (updates.new_preferences && Object.keys(updates.new_preferences).length > 0) {
      currentKnowledge.user.preferences = { ...currentKnowledge.user.preferences, ...updates.new_preferences };
      hasChanges = true;
    }

    if (updates.new_contacts && Object.keys(updates.new_contacts).length > 0) {
      currentKnowledge.contacts = { ...currentKnowledge.contacts, ...updates.new_contacts };
      hasChanges = true;
    }

    if (updates.new_projects && Object.keys(updates.new_projects).length > 0) {
      currentKnowledge.projects = { ...currentKnowledge.projects, ...updates.new_projects };
      hasChanges = true;
    }

    if (Array.isArray(updates.new_facts) && updates.new_facts.length > 0) {
      for (const factText of updates.new_facts) {
        if (typeof factText === "string" && factText.trim().length > 3) {
          const isDup = currentKnowledge.facts.some((f) => f.text.toLowerCase() === factText.toLowerCase());
          if (!isDup) {
            currentKnowledge.facts.push({
              id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              category: "extracted",
              text: factText.trim(),
              created_at: new Date().toISOString(),
            });
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      console.log(`[KnowledgeGraph] Updated knowledge graph for session ${sessionId}`);
      writeKnowledge(sessionId, currentKnowledge);
    }
  } catch (err) {
    // Extraction is a silent background enhancement; never throw or interrupt conversation
    console.warn(`[KnowledgeGraph] Background extraction error:`, err.message);
  }
}

/**
 * Formats knowledge graph into a concise context block for Sia's system prompt.
 */
function formatKnowledgeForPrompt(sessionId) {
  const k = readKnowledge(sessionId);
  const sections = [];

  if (k.user.name && k.user.name !== "Sir") {
    sections.push(`User Name: ${k.user.name}`);
  }

  const prefs = Object.entries(k.user.preferences);
  if (prefs.length > 0) {
    sections.push(`User Preferences: ${prefs.map(([k, v]) => `${k} = ${v}`).join(", ")}`);
  }

  const contacts = Object.entries(k.contacts);
  if (contacts.length > 0) {
    sections.push(`Known Contacts: ${contacts.map(([k, v]) => `${k} (${v})`).join(", ")}`);
  }

  const projects = Object.entries(k.projects);
  if (projects.length > 0) {
    sections.push(`Active Projects: ${projects.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
  }

  if (k.facts.length > 0) {
    const recentFacts = k.facts.slice(-8).map((f) => `- ${f.text}`);
    sections.push(`Key User Facts:\n${recentFacts.join("\n")}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

module.exports = {
  readKnowledge,
  writeKnowledge,
  addFact,
  deleteFact,
  extractAndSyncKnowledge,
  formatKnowledgeForPrompt,
};
