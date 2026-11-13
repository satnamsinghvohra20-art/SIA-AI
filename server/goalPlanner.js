/**
 * Autonomous Multi-Step Goal Planner (Auto-DAG) for Sia AI
 * Decomposes compound instructions into a Directed Acyclic Graph (DAG)
 * and executes each sub-task through real verified engines (never faking completion).
 */

const { tryFastDispatch } = require("./fastDispatcher");

class GoalPlanner {
  constructor() {
    this.compoundSplitters = [
      /\s+(?:and\s+then|then\s+also|then|after\s+that|and\s+also|and)\s+/i,
      /\s*;\s*/,
      /\s*,\s*(?:then|and\s+then|and)\s+/i,
    ];
  }

  isCompoundGoal(text) {
    if (!text || typeof text !== "string") return false;
    const t = text.trim();
    if (t.length < 10) return false;

    const hasConnector = this.compoundSplitters.some((regex) => regex.test(t));
    if (!hasConnector) return false;

    const actionVerbs = [
      "open", "launch", "play", "search", "order", "buy", "send", "message",
      "volume", "mute", "calculate", "write", "read", "screenshot", "find",
      "close", "lock", "minimize", "maximize", "run", "execute", "call",
    ];

    const regex = new RegExp(`\\b(?:${actionVerbs.join("|")})\\b`, "gi");
    const matches = t.match(regex);
    return Boolean(matches && matches.length >= 2);
  }

  decompose(text) {
    const rawSegments = text
      .split(/\s+(?:and\s+then|then\s+also|then|after\s+that|and\s+also|and)\s+|\s*;\s*|\s*,\s*(?:then|and\s+then|and)\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const steps = rawSegments.map((segment, index) => ({
      id: index + 1,
      title: segment.charAt(0).toUpperCase() + segment.slice(1),
      command: segment,
      status: "pending", // pending | running | completed | failed
      result: null,
      timestamp: null,
    }));

    return {
      id: `dag_${Date.now()}`,
      goal: text,
      totalSteps: steps.length,
      steps,
    };
  }

  async decomposeIntoDAG(text) {
    return this.decompose(text);
  }

  async executeDAG(dag, { onStepUpdate = null, sessionId = "default" } = {}) {
    const deviceAgent = require("./deviceControl/agentLoop");
    const executedSteps = [];
    const executedNodes = [];
    let allSuccess = true;

    for (const step of dag.steps) {
      step.status = "running";
      step.timestamp = Date.now();
      if (onStepUpdate) onStepUpdate(step);

      try {
        // 1. Check Fast Dispatcher for deterministic action (<50ms)
        const fastResult = await tryFastDispatch(step.command);
        if (fastResult.matched) {
          const stepOk = fastResult.ok !== false;
          step.status = stepOk ? "completed" : "failed";
          if (!stepOk) allSuccess = false;
          step.result = { answer: fastResult.answer, steps: fastResult.steps, ok: stepOk };
          executedSteps.push(step);
          for (const s of (fastResult.steps || [])) {
            executedNodes.push(s);
          }
          if (onStepUpdate) onStepUpdate(step);
          continue;
        }

        // 2. Execute genuinely via the Device Agent Loop (never fake-complete)
        const snapshot = await deviceAgent.startTask({
          sessionId,
          instruction: step.command,
        });
        const agentOk = snapshot.status === "done";
        step.status = agentOk ? "completed" : "failed";
        if (!agentOk) allSuccess = false;
        step.result = {
          answer: snapshot.finalAnswer || (agentOk ? "Completed." : "Failed."),
          steps: snapshot.log,
          ok: agentOk,
        };
        executedSteps.push(step);
        executedNodes.push({
          action: "device_agent",
          params: { command: step.command },
          result: { ok: agentOk, answer: step.result.answer },
        });
        if (onStepUpdate) onStepUpdate(step);
      } catch (err) {
        step.status = "failed";
        step.result = { error: err.message, ok: false };
        allSuccess = false;
        executedSteps.push(step);
        executedNodes.push({
          action: "error",
          params: { command: step.command },
          result: { ok: false, error: err.message },
        });
        if (onStepUpdate) onStepUpdate(step);
      }
    }

    const completedCount = executedSteps.filter((s) => s.status === "completed").length;
    const failedCount = executedSteps.length - completedCount;
    const summary = failedCount === 0
      ? `Autonomous Goal Planner executed and verified ${completedCount} of ${dag.totalSteps} sub-tasks successfully.`
      : `Autonomous Goal Planner completed ${completedCount}/${dag.totalSteps} sub-tasks (${failedCount} failed).`;

    return {
      goal: dag.goal,
      completed: allSuccess,
      progress: `${completedCount}/${dag.totalSteps} steps completed`,
      steps: executedSteps,
      executedNodes,
      summary,
    };
  }

  async executePlan(dag, opts = {}) {
    return this.executeDAG(dag, opts);
  }
}

const goalPlanner = new GoalPlanner();
module.exports = { goalPlanner, GoalPlanner };
