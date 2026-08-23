const fs = require("fs");

/**
 * SPEECH-TO-TEXT
 * --------------
 * Transcribes a recorded WAV file. Prefers Groq's whisper-large-v3-turbo
 * (very fast — matters for a voice loop that should feel responsive)
 * and falls back to OpenAI's whisper-1 if only that key is set.
 */

async function transcribe(wavFilePath) {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey) {
    throw new Error(
      "No speech-to-text provider configured. Set GROQ_API_KEY (fast, recommended) or OPENAI_API_KEY in .env."
    );
  }

  const useGroq = Boolean(groqKey);
  const url = useGroq
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const key = useGroq ? groqKey : openaiKey;
  const model = useGroq ? "whisper-large-v3-turbo" : "whisper-1";

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(wavFilePath)]), "audio.wav");
  form.append("model", model);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.text || "").trim();
}

module.exports = { transcribe };
