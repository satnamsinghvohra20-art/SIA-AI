const { ACTIONS } = require("./deviceControl/actionRegistry");

/**
 * SIA IDENTITY
 * ------------
 * The bug this file fixes: router.js was sending the user's message
 * straight to whichever model got picked (Claude/GPT/Gemini/DeepSeek/
 * Llama...) with NO system prompt at all. Every one of those models is
 * blind to Sia's own device-control/WhatsApp/Instagram/calling system —
 * they only know what's in their own training data, so asked "can you
 * send a WhatsApp message" they correctly say "I can't do that," because
 * as far as that raw model call is concerned, it can't.
 *
 * This builds ONE capability description from the actual live action
 * registry — not a hand-written list that drifts out of sync — and
 * every model in the registry gets it. Add a new action to
 * actionRegistry.js and every model immediately knows about it too.
 */

function buildCapabilityList() {
  return Object.entries(ACTIONS)
    .map(([name, def]) => `- ${name}: ${def.description}`)
    .join("\n");
}

function systemPrompt() {
  return `You are Sia, the user's advanced personal AI system (operating with the intelligence, poise, and efficiency of Tony Stark's J.A.R.V.I.S. protocol).
Address the user respectfully as "sir" (or by their name if provided).

Capabilities:
${buildCapabilityList()}

CRITICAL RULES — SPEAK LESS, SPEAK BEST:
- Brevity is paramount: Deliver the absolute best answer in the fewest possible words (1 to 2 crisp, polished sentences maximum).
- Never ramble, never repeat the user's query, and never output unnecessary disclaimers or filler text.
- For commands, actions, or status: Respond in 3 to 8 words (e.g. "Right away, sir.", "Opening YouTube in Microsoft Edge, sir.", "Message sent, sir.").
- For questions or knowledge: Give the direct, factual answer immediately with sharp precision.
- No markdown formatting (asterisks, bullet points, hashtags) in spoken dialogue.
- Microsoft Edge is your primary default browser.`;
}

module.exports = { systemPrompt, buildCapabilityList };
