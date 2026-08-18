const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

/**
 * WAKE WORD + RECORDING
 * ----------------------
 * Always-listening front door for the voice loop. Two stages:
 *
 * 1. Wake-word detection (Porcupine, offline, near-zero CPU) — runs
 *    continuously, does nothing until it hears the wake phrase.
 * 2. Once woken, records your actual command to a WAV file, auto-stopping
 *    after a short pause instead of a fixed duration, and hands the file
 *    off to stt.js.
 *
 * Requires (not bundled, add via npm install — see README voice section):
 *   npm install @picovoice/porcupine-node node-record-lpcm16
 * ...and `sox` (mac/linux: `brew install sox` / `apt install sox`) or
 * `arecord` (linux) on PATH for microphone capture.
 *
 * Free Porcupine access key + a custom "Hey Sia" wake-word file (.ppn):
 * https://console.picovoice.ai — the free tier covers personal use.
 */

const SAMPLE_RATE = 16000;
const SILENCE_RMS_THRESHOLD = 500; // tune for your mic/room
const SILENCE_STOP_MS = 1200;
const MAX_RECORD_MS = 12000;

function rms(buffer) {
  let sum = 0;
  const samples = buffer.length / 2;
  for (let i = 0; i < buffer.length; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += sample * sample;
  }
  return Math.sqrt(sum / Math.max(1, samples));
}

// Records until SILENCE_STOP_MS of quiet follows detected speech, or
// MAX_RECORD_MS is hit — whichever comes first.
function recordUntilSilence() {
  const record = require("node-record-lpcm16");
  const outFile = path.join(os.tmpdir(), `sia-cmd-${Date.now()}.wav`);
  const fileStream = fs.createWriteStream(outFile);

  return new Promise((resolve, reject) => {
    const recording = record.record({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      audioType: "wav",
    });

    let heardSpeech = false;
    let silenceStart = null;
    const startedAt = Date.now();

    const stream = recording.stream();
    stream.on("error", reject);
    stream.pipe(fileStream);

    stream.on("data", (chunk) => {
      const level = rms(chunk);
      const now = Date.now();

      if (level > SILENCE_RMS_THRESHOLD) {
        heardSpeech = true;
        silenceStart = null;
      } else if (heardSpeech) {
        if (!silenceStart) silenceStart = now;
        if (now - silenceStart > SILENCE_STOP_MS) {
          recording.stop();
        }
      }

      if (now - startedAt > MAX_RECORD_MS) recording.stop();
    });

    fileStream.on("finish", () => resolve(outFile));
    recording.stream().on("end", () => fileStream.end());
  });
}

// Starts continuous wake-word listening. Calls onWake() every time the
// phrase is heard, then automatically records the follow-up command and
// calls onCommand(wavFilePath). Runs until the process exits.
function startListening({ onWake, onCommand, onError }) {
  let Porcupine, PvRecorder;
  try {
    ({ Porcupine } = require("@picovoice/porcupine-node"));
    ({ PvRecorder } = require("@picovoice/pvrecorder-node"));
  } catch {
    onError(
      new Error(
        "Wake-word deps not installed. Run: npm install @picovoice/porcupine-node @picovoice/pvrecorder-node node-record-lpcm16"
      )
    );
    return;
  }

  const accessKey = process.env.PICOVOICE_ACCESS_KEY;
  const keywordPath = process.env.PICOVOICE_KEYWORD_PATH; // path to your "Hey Sia" .ppn file
  if (!accessKey || !keywordPath) {
    onError(
      new Error(
        "Set PICOVOICE_ACCESS_KEY and PICOVOICE_KEYWORD_PATH in .env. Get a free key and build a custom " +
          '"Hey Sia" wake word at https://console.picovoice.ai'
      )
    );
    return;
  }

  const porcupine = new Porcupine(accessKey, [keywordPath], [0.5]);
  const recorder = new PvRecorder(porcupine.frameLength, -1);
  recorder.start();

  console.log(`[voice] Listening for wake word (device: ${recorder.getSelectedDevice()})...`);

  (async function loop() {
    while (true) {
      const frame = await recorder.read();
      const keywordIndex = porcupine.process(frame);
      if (keywordIndex >= 0) {
        onWake();
        recorder.stop(); // free the mic for node-record-lpcm16's own capture
        try {
          const wavFile = await recordUntilSilence();
          await onCommand(wavFile);
        } catch (err) {
          onError(err);
        }
        recorder.start(); // resume wake-word listening
      }
    }
  })().catch(onError);
}

module.exports = { startListening, recordUntilSilence };
