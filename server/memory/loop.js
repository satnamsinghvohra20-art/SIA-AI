require("dotenv").config();
const brain = require("./brainStore");
const { route } = require("../router");

const MAX_ITERATIONS = 200; // hard ceiling so a bad loop can't run forever unattended
const SLEEP_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Breaks a goal into a checklist plan by asking Sia's own reasoning route
 * to produce numbered steps. Falls back to a single-step plan if parsing
 * fails — a bad plan should never crash the loop before it even starts.
 */
async function planTask(goal) {
  try {
    const result = await route({
      message: `Break this goal into 3-8 concrete, ordered, actionable steps. Reply with ONLY a numbered list, one step per line, nothing else.\n\nGoal: ${goal}`,
      forceCategory: "reasoning",
    });
    const lines = result.answer
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [goal];
  } catch (err) {
    console.error("loop: planning failed, falling back to single-step plan:", err.message);
    return [goal];
  }
}

/**
 * Executes exactly one plan step through Sia's router, using accumulated
 * chat/task context so each step knows what came before.
 */
async function executeStep(sessionId, stepText, state) {
  const context = brain.getContextForModel(sessionId);
  const contextPreamble = state.current_task.goal
    ? [{ role: "system", content: `Overall goal: ${state.current_task.goal}` }]
    : [];

  const result = await route({
    message: stepText,
    history: [...contextPreamble, ...context],
  });

  return result;
}

/**
 * Runs the loop. Resumes an existing in_progress task if one exists,
 * otherwise starts a new one from `goal`. Uses brain.DEFAULT_SESSION
 * ("cli") so CLI-driven loop runs never collide with any web session's
 * memory — they're isolated the same way two different web users are.
 */
async function runLoop(goal) {
  const sessionId = brain.DEFAULT_SESSION;
  let state = brain.readState(sessionId);

  if (state.current_task.status !== "in_progress" || !state.plan.length) {
    console.log(`Starting new task: ${goal}`);
    const planSteps = await planTask(goal);
    state = brain.startTask(sessionId, goal, planSteps);
  } else {
    console.log(`Resuming task: ${state.current_task.goal}`);
  }

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    state = brain.readState(sessionId);

    const nextStepIndex = state.plan.findIndex((s) => !s.done);
    if (nextStepIndex === -1) {
      console.log("All steps complete. Task done.");
      break;
    }

    const step = state.plan[nextStepIndex];
    console.log(`\n[step ${nextStepIndex + 1}/${state.plan.length}] ${step.text}`);

    try {
      const result = await executeStep(sessionId, step.text, state);
      brain.logDecision(sessionId, `Completed step "${step.text}" via ${result.routing.modelLabel}`);
      await brain.appendMessage(sessionId, "assistant", result.answer);
      brain.markStepDone(sessionId, nextStepIndex);
      console.log(`  ✓ done (routed to ${result.routing.modelLabel})`);
    } catch (err) {
      // A failed step becomes a logged blocker, NOT a crashed process.
      // The loop moves on so one bad step doesn't kill the whole run.
      console.error(`  ✗ step failed: ${err.message}`);
      brain.logBlocker(sessionId, `Step "${step.text}" failed: ${err.message}`);
      brain.markStepDone(sessionId, nextStepIndex); // mark done so the loop doesn't spin forever on the same failure
    }

    iterations++;
    await sleep(SLEEP_MS);
  }

  if (iterations >= MAX_ITERATIONS) {
    brain.logBlocker(sessionId, `Hit MAX_ITERATIONS (${MAX_ITERATIONS}) — task may be incomplete, review plan.`);
    console.warn(`\nStopped: hit the ${MAX_ITERATIONS}-iteration safety ceiling.`);
  }

  return brain.readState(sessionId);
}

if (require.main === module) {
  const goal = process.argv.slice(2).join(" ");
  if (!goal) {
    console.error('Usage: node server/memory/loop.js "your goal here"');
    process.exit(1);
  }
  runLoop(goal)
    .then(() => console.log("\nLoop finished. See brain.md for the full result."))
    .catch((err) => {
      // Even a top-level unexpected failure gets logged into brain, not just stderr
      brain.logBlocker(brain.DEFAULT_SESSION, `Loop crashed: ${err.message}`);
      console.error("Loop crashed:", err);
      process.exit(1);
    });
}

module.exports = { runLoop, planTask, executeStep };
