const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

/**
 * SPEAK
 * -----
 * Turns text into audio (ElevenLabs, same voice bank already wired into
 * the web client's /api/tts) and plays it out loud on THIS machine's
 * speakers. This is what makes the loop talk back — both mid-task
 * narration ("opening WhatsApp... typing your message...") and the final
 * "done" — not just the desktop chat UI.
 */

const PLATFORM = os.platform();

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
  });
}

async function playFile(filePath) {
  if (PLATFORM === "darwin") {
    await run("afplay", [filePath]);
  } else if (PLATFORM === "win32") {
<<<<<<< HEAD
    const escapedPath = filePath.replace(/'/g, "''");
    const script = `
Add-Type -AssemblyName presentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([System.Uri]'${escapedPath}')
$player.Play()
$timeout = 0
while (!$player.NaturalDuration.HasTimeSpan -and $timeout -lt 30) {
  Start-Sleep -Milliseconds 100
  $timeout++
}
if ($player.NaturalDuration.HasTimeSpan) {
  $duration = [int]($player.NaturalDuration.TimeSpan.TotalMilliseconds + 300)
  Start-Sleep -Milliseconds $duration
} else {
  Start-Sleep -Seconds 3
}
$player.Close()`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]).catch(async () => {
      const fallbackScript = `$wmp = New-Object -ComObject WMPlayer.OCX; $m = $wmp.newMedia('${escapedPath}'); $wmp.currentPlaylist.appendItem($m); $wmp.controls.play(); Start-Sleep -Seconds 3`;
      await run("powershell.exe", ["-NoProfile", "-Command", fallbackScript]).catch(() => {});
    });
=======
    await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(New-Object Media.SoundPlayer '${filePath}').PlaySync();`,
    ]);
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
  } else {
    // Linux: try a few common players, first one that exists wins
    for (const player of ["ffplay", "mpg123", "paplay", "aplay"]) {
      try {
        const args = player === "ffplay" ? ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath] : [filePath];
        await run(player, args);
        return;
      } catch {
        // try next player
      }
    }
    throw new Error("No audio player found (tried ffplay, mpg123, paplay, aplay). Install one of these.");
  }
}

<<<<<<< HEAD
function speakWithWindowsSapi(text) {
  if (PLATFORM !== "win32") return Promise.resolve();
  const escaped = text.replace(/'/g, "''").replace(/\r?\n/g, " ");
  const script = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 1
$synth.Speak('${escaped}')
`;
  return run("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => {});
}

async function speak(text) {
  if (!text) return;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (apiKey) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2";
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.slice(0, 1000),
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const tmpFile = path.join(os.tmpdir(), `sia-tts-${Date.now()}.mp3`);
        await fs.writeFile(tmpFile, buf);
        await playFile(tmpFile);
        await fs.unlink(tmpFile).catch(() => {});
        return;
      }
    } catch (err) {
      console.warn("[voice] ElevenLabs TTS unavailable, using system voice:", err.message);
    }
  }

  // Fallback to native Windows SAPI Voice
  await speakWithWindowsSapi(text);
=======
async function speak(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !text) return; // voice output is optional — fail silently, not fatal to the task

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2";
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 1000),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    const tmpFile = path.join(os.tmpdir(), `sia-tts-${Date.now()}.mp3`);
    await fs.writeFile(tmpFile, buf);
    await playFile(tmpFile);
    await fs.unlink(tmpFile).catch(() => {});
  } catch (err) {
    console.error("[voice] speak() failed:", err.message);
  }
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
}

module.exports = { speak };
