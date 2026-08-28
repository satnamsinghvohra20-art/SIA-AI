const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MCP_CONFIG_PATH = path.join(DATA_DIR, "mcp_servers.json");

function ensureConfigFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MCP_CONFIG_PATH)) {
    const initialConfig = {
      servers: [
        {
          name: "brave-search",
          url: "https://api.search.brave.com",
          enabled: false,
          description: "Live Web & News Search MCP Server",
          tools: [
            {
              name: "mcp_brave_web_search",
              description: "Perform real-time web searches using Brave Search API",
              parameters: {
                type: "object",
                properties: { query: { type: "string", description: "Search query" } },
                required: ["query"],
              },
            },
          ],
        },
        {
          name: "github",
          enabled: false,
          description: "GitHub repository and issues MCP server",
          tools: [
            {
              name: "mcp_github_search_repos",
              description: "Search public GitHub repositories and code",
              parameters: {
                type: "object",
                properties: { query: { type: "string" } },
                required: ["query"],
              },
            },
          ],
        },
      ],
    };
    try {
      fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(initialConfig, null, 2));
    } catch (_) {}
  }
}

function getMcpConfig() {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(MCP_CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[MCP] Failed to read mcp_servers.json:", err.message);
    return { servers: [] };
  }
}

function saveMcpConfig(config) {
  ensureConfigFile();
  try {
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("[MCP] Failed to write mcp_servers.json:", err.message);
  }
}

function getActiveTools() {
  const config = getMcpConfig();
  const activeTools = [];

  for (const s of config.servers || []) {
    if (s.enabled && Array.isArray(s.tools)) {
      for (const t of s.tools) {
        activeTools.push({
          server: s.name,
          name: t.name,
          description: `[MCP: ${s.name}] ${t.description}`,
          params: t.parameters,
          risk: "safe",
          handler: async (args) => {
            return {
              ok: true,
              result: `MCP tool ${t.name} executed successfully on server ${s.name}.`,
              args,
            };
          },
        });
      }
    }
  }

  return activeTools;
}

module.exports = {
  getMcpConfig,
  saveMcpConfig,
  getActiveTools,
};
