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

test("classified tasks use current specialist models for both paid and free tiers", () => {
  const { getModelForCategory } = require("../server/router");
  assert.equal(getModelForCategory("coding_python").model, "qwen/qwen3-coder-next");
  assert.equal(getModelForCategory("coding").model, "anthropic/claude-sonnet-5.5");
  assert.equal(getModelForCategory("vision").model, "google/gemini-3.8-flash");
  assert.equal(getModelForCategory("coding", { freeTier: true }).model, "cohere/north-mini-code:free");
  assert.equal(getModelForCategory("vision", { freeTier: true }).model, "nvidia/nemotron-3.5-super-vl:free");
  assert.equal(getModelForCategory("reasoning", { freeTier: true }).model, "nvidia/nemotron-3-ultra-550b-a55b:free");
});

test("consensus mode queries three distinct current specialist models", () => {
  const { FREE_COUNCIL_MODELS, PAID_COUNCIL_MODELS } = require("../server/consensusEngine");
  assert.equal(new Set(FREE_COUNCIL_MODELS.map((m) => m.id)).size, 3);
  assert.equal(new Set(PAID_COUNCIL_MODELS.map((m) => m.id)).size, 3);
});

test("semantic cache never returns another session's answer", () => {
  const { SemanticCache } = require("../server/semanticCache");
  const cache = new SemanticCache();
  cache.set("what is my plan", { answer: "private plan" }, { scope: "session-a" });
  assert.equal(cache.get("what is my plan", { scope: "session-b" }), null);
  assert.equal(cache.get("what is my plan", { scope: "session-a" }).answer, "private plan");
});

test("owner direct mode executes all actions immediately with zero blocking protocols", async () => {
  const { ACTIONS } = require("../server/deviceControl/actionRegistry");
  const { executeAction } = require("../server/deviceControl/executor");
  const original = ACTIONS.write_file.handler;
  let calls = 0;
  ACTIONS.write_file.handler = async () => { calls++; return { success: true }; };
  try {
    const res = await executeAction("write_file", { file: "note.txt", content: "x" });
    assert.equal(res.ok, true);
    assert.equal(res.needsConfirmation, undefined);
    assert.equal(calls, 1);
    for (const [name, def] of Object.entries(ACTIONS)) {
      assert.equal(def.risk, "safe", `${name} should execute without confirmation protocols`);
    }
  } finally {
    ACTIONS.write_file.handler = original;
  }
});

test("owner file handlers support unrestricted paths on host filesystem", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sia-owner-files-"));
  const files = require("../server/deviceControl/handlers/files");
  try {
    const targetFile = path.join(tempDir, "nested", "owner-note.txt");
    const written = await files.writeFile({ file: targetFile, content: "owner-direct-ok" });
    assert.equal(written.success, true);
    assert.equal((await files.readFile({ file: targetFile })).content, "owner-direct-ok");
    const deleted = await files.deleteFile({ file: targetFile });
    assert.equal(deleted.success, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
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

test("goal planner never fakes completion when a sub-step fails", async () => {
  const { GoalPlanner } = require("../server/goalPlanner");
  const agentLoopPath = require.resolve("../server/deviceControl/agentLoop");
  const originalStartTask = require(agentLoopPath).startTask;
  require(agentLoopPath).startTask = async ({ instruction }) => ({
    status: "error",
    finalAnswer: `Blocked: ${instruction}`,
    log: [{ type: "error", content: "simulated failure" }],
  });
  try {
    const planner = new GoalPlanner();
    const dag = planner.decompose("check disk health and verify backup log");
    const report = await planner.executeDAG(dag, { sessionId: "test-session" });
    assert.equal(report.completed, false);
    assert.equal(report.steps[0].status, "failed");
  } finally {
    require(agentLoopPath).startTask = originalStartTask;
  }
});

test("knowledge graph rejects invalid session ids and stores verified fixes", () => {
  const kg = require("../server/memory/knowledgeGraph");
  assert.throws(() => kg.readKnowledge("../escape"), /Invalid sessionId/);
  const updated = kg.addVerifiedFix("unit_test_fix_session", "402 cascade", "Auto-detect free tier", "unit_test");
  assert.ok(updated.verified_fixes.some((f) => f.issue === "402 cascade" && f.resolution === "Auto-detect free tier"));
});

test("universal fast dispatcher executes file, shell, and compound tasks directly", async () => {
  const { tryFastDispatch } = require("../server/fastDispatcher");
  const { classify } = require("../server/classifier");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sia-fast-tasks-"));
  const targetFile = path.join(tempDir, "hello.txt");
  try {
    assert.equal((await classify(`create file ${targetFile} with hello world`)).category, "device_control");
    assert.equal((await classify("run command node -v")).category, "device_control");
    assert.equal((await classify("check git status")).category, "device_control");

    const created = await tryFastDispatch(`create file ${targetFile} with hello world`);
    assert.equal(created.matched, true);
    assert.equal(created.ok, true);

    const read = await tryFastDispatch(`read file ${targetFile}`);
    assert.equal(read.matched, true);
    assert.equal(read.ok, true);
    assert.match(read.answer, /hello world/);

    const cmd = await tryFastDispatch("run command node -v");
    assert.equal(cmd.matched, true);
    assert.equal(cmd.ok, true);
    assert.match(cmd.answer, /v\d+/);

    const del = await tryFastDispatch(`delete file ${targetFile}`);
    assert.equal(del.matched, true);
    assert.equal(del.ok, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
