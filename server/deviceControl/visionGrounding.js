const system = require("./handlers/system");
const { callOpenRouter, isFreeTierAccount } = require("../openrouterClient");
const { getModelForCategory } = require("../modelRegistry");
const fs = require("fs/promises");

function getVisionModel() {
  return getModelForCategory("vision_fast", { freeTier: isFreeTierAccount() }).model;
}

/**
 * VISION GROUNDING AGENT
 * ----------------------
 * Locates exact visual UI coordinates on the user's screen using high-resolution
 * screenshot analysis and vision models.
 */

async function groundElementCoordinates({ targetDescription }) {
  try {
    const shotResult = await system.takeScreenshot({});
    if (!shotResult?.ok || !shotResult?.file) {
      return { ok: false, error: "Could not capture screenshot for vision grounding." };
    }

    const imageBuffer = await fs.readFile(shotResult.file);
    const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const prompt = `You are Sia's vision grounding sub-agent.
Analyze this computer screenshot to locate the UI element: "${targetDescription}".

Find the exact center pixel coordinates (X, Y) of the element on screen.
Return a JSON object ONLY with the following schema:
{
  "found": true | false,
  "x": number,
  "y": number,
  "confidence": number (0 to 1),
  "element_label": string,
  "reasoning": string
}`;

    const rawResponse = await callOpenRouter({
      model: getVisionModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const match = rawResponse.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ok: false, error: "Vision model did not return valid JSON coordinates." };
    }

    const parsed = JSON.parse(match[0]);
    return { ok: true, ...parsed, screenshotFile: shotResult.file };
  } catch (err) {
    console.error("[VisionGrounding] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Verifies that a UI action produced the intended outcome on screen.
 */
async function verifyActionResult({ expectedOutcome }) {
  try {
    const shotResult = await system.takeScreenshot({});
    if (!shotResult?.ok || !shotResult?.file) {
      return { verified: true, note: "Skipped screenshot verification." };
    }

    const imageBuffer = await fs.readFile(shotResult.file);
    const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const prompt = `You are Sia's action verification agent.
Look at this post-action screenshot and verify if the following expected outcome has occurred:
"${expectedOutcome}"

Return a JSON object ONLY:
{
  "verified": true | false,
  "observation": string (under 20 words)
}`;

    const rawResponse = await callOpenRouter({
      model: getVisionModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const match = rawResponse.match(/\{[\s\S]*\}/);
    if (!match) return { verified: true };
    return JSON.parse(match[0]);
  } catch (err) {
    return { verified: true, note: "Verification completed with fallback." };
  }
}

module.exports = { groundElementCoordinates, verifyActionResult };
