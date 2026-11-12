const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

test("offline fallback does not fabricate answers for unsupported tasks", async () => {
  const modulePath = require.resolve("../server/localBrain");
  const originalModule = require.cache[modulePath];
  const originalHost = process.env.OLLAMA_HOST;
  const originalPort = process.env.OLLAMA_PORT;
  delete require.cache[modulePath];
  process.env.OLLAMA_HOST = "127.0.0.1";
  process.env.OLLAMA_PORT = "1";

  try {
    const localBrain = require(modulePath);
    assert.equal(localBrain.solveSovereignHeuristic("write a Python web server"), null);
    assert.match(
      localBrain.solveSovereignHeuristic("what can you do"),
      /Offline fallback supports basic arithmetic/
    );
    await assert.rejects(
      localBrain.generateLocalFallback({ message: "write a Python web server" }),
      /cannot be completed in offline fallback mode/
    );
  } finally {
    delete require.cache[modulePath];
    if (originalModule) require.cache[modulePath] = originalModule;
    if (originalHost === undefined) delete process.env.OLLAMA_HOST;
    else process.env.OLLAMA_HOST = originalHost;
    if (originalPort === undefined) delete process.env.OLLAMA_PORT;
    else process.env.OLLAMA_PORT = originalPort;
  }
});

test("classified tasks use their current specialist model instead of catalog order", () => {
  const { getModelForCategory } = require("../server/router");
  assert.equal(getModelForCategory("coding_python").model, "anthropic/claude-sonnet-5.5");
  assert.equal(getModelForCategory("vision").model, "google/gemini-4-carbon");
  assert.equal(getModelForCategory("unknown").model, "openai/gpt-6.1-terra");
});

test("consensus mode queries three distinct current specialist models", () => {
  const { COUNCIL_MODELS } = require("../server/consensusEngine");
  const { MODEL_REGISTRY } = require("../server/modelRegistry");
  const modelIds = COUNCIL_MODELS.map((model) => model.id);
  assert.equal(new Set(modelIds).size, 3);
  assert.deepEqual(modelIds, [
    MODEL_REGISTRY.coding.model,
    MODEL_REGISTRY.vision.model,
    MODEL_REGISTRY.fast_reasoning.model,
  ]);
});

test("semantic cache never returns another session's answer", () => {
  const { SemanticCache } = require("../server/semanticCache");
  const cache = new SemanticCache();
  cache.set("what is my plan", { answer: "private plan" }, { scope: "session-a" });
  assert.equal(cache.get("what is my plan", { scope: "session-b" }), null);
  assert.equal(cache.get("what is my plan", { scope: "session-a" }).answer, "private plan");
});

test("risky actions require confirmation before handler execution", async () => {
  const { ACTIONS } = require("../server/deviceControl/actionRegistry");
  const { executeAction } = require("../server/deviceControl/executor");
  const original = ACTIONS.write_file.handler;
  let calls = 0;
  ACTIONS.write_file.handler = async () => { calls++; return { success: true }; };
  try {
    const pending = await executeAction("write_file", { file: "note.txt", content: "x" });
    assert.equal(pending.needsConfirmation, true);
    assert.equal(calls, 0);
    const approved = await executeAction("write_file", { file: "note.txt", content: "x" }, { confirmed: true });
    assert.equal(approved.ok, true);
    assert.equal(calls, 1);
  } finally {
    ACTIONS.write_file.handler = original;
  }
});

test("device file handlers reject paths outside their configured root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sia-device-root-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "sia-outside-"));
  process.env.SIA_DEVICE_ROOT = root;
  const filesPath = require.resolve("../server/deviceControl/handlers/files");
  delete require.cache[filesPath];
  const files = require(filesPath);
  try {
    const written = await files.writeFile({ file: "nested/note.txt", content: "hello" });
    assert.equal(written.success, true);
    assert.equal((await files.readFile({ file: "nested/note.txt" })).content, "hello");
    assert.ok((await files.readFile({ file: path.join(outside, "private.txt") })).error);
    assert.ok((await files.writeFile({ file: "../escape.txt", content: "no" })).error);
  } finally {
    delete require.cache[filesPath];
    delete process.env.SIA_DEVICE_ROOT;
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test("fast dispatcher leaves messaging and risky compound tasks to the approval flow", async () => {
  const { tryFastDispatch } = require("../server/fastDispatcher");
  assert.equal((await tryFastDispatch("send WhatsApp to Alex hello")).matched, false);
  assert.equal((await tryFastDispatch("open spotify and call Mom")).matched, false);
});

test("agent loop reports its iteration limit instead of claiming success", async () => {
  const { stepLoop } = require("../server/deviceControl/agentLoop");
  const task = {
    id: "test-task", sessionId: "test-session", status: "running", messages: [], log: [],
  };
  const result = await stepLoop(task, {
    maxIterations: 1,
    invokeModel: async () => ({
      content: null,
      tool_calls: [{ id: "test-call", function: { name: "get_system_info", arguments: "{}" } }],
    }),
  });
  assert.equal(result.status, "error");
  assert.match(result.finalAnswer, /Stopped after 1 steps/);
});
