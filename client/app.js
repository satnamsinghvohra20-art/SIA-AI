const chatWindow = document.getElementById("chat-window");
const emptyState = document.getElementById("empty-state");
const composer = document.getElementById("composer");
const input = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const voiceToggleBtn = document.getElementById("voice-toggle-btn");
const liveVoiceBtn = document.getElementById("live-voice-btn");
const overrideSelect = document.getElementById("override-select");
const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

// 300+ Models Catalog Elements
const modelsCatalogBtn = document.getElementById("models-catalog-btn");
const modelsOverlay = document.getElementById("models-overlay");
const modelsCloseBtn = document.getElementById("models-close-btn");
const modelsSearchInput = document.getElementById("models-search-input");
const modelsClearBtn = document.getElementById("models-clear-btn");
const modelsFilterTabs = document.getElementById("models-filter-tabs");
const modelsGrid = document.getElementById("models-grid");
const modelsCountBadge = document.getElementById("models-count-badge");
const modelsBtnLabel = document.getElementById("models-btn-label");

// Council of AI & Knowledge Graph Elements
const consensusToggleBtn = document.getElementById("consensus-toggle-btn");
const knowledgeBtn = document.getElementById("knowledge-btn");
const knowledgeOverlay = document.getElementById("knowledge-overlay");
const knowledgeCloseBtn = document.getElementById("knowledge-close-btn");
const knowledgeCountBadge = document.getElementById("knowledge-count-badge");
const knowledgeUserCard = document.getElementById("knowledge-user-card");
const knowledgeProjectsCard = document.getElementById("knowledge-projects-card");
const knowledgeContactsCard = document.getElementById("knowledge-contacts-card");
const knowledgeFactsList = document.getElementById("knowledge-facts-list");
const addFactBtn = document.getElementById("add-fact-btn");

// Multimodal File Upload Elements
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const filePreviewBar = document.getElementById("file-preview-bar");
const dropZoneOverlay = document.getElementById("drop-zone-overlay");

let isConsensusModeActive = false;
let pendingAttachedFiles = [];

// Live Voice Elements
const liveVoiceOverlay = document.getElementById("live-voice-overlay");
const liveStatusText = document.getElementById("live-status-text");
const liveModelBadge = document.getElementById("live-model-badge");
const liveModelName = document.getElementById("live-model-name");
const liveCloseBtn = document.getElementById("live-close-btn");
const liveOrb = document.getElementById("live-orb");
const orbCore = document.getElementById("orb-core");
const orbAura = document.getElementById("orb-aura");
const orbHint = document.getElementById("orb-hint");
const orbAudioBars = document.getElementById("orb-audio-bars");
const liveUserCaption = document.getElementById("live-user-caption");
const liveAssistantCaption = document.getElementById("live-assistant-caption");
const liveMuteBtn = document.getElementById("live-mute-btn");
const liveMuteLabel = document.getElementById("live-mute-label");
const liveInterruptBtn = document.getElementById("live-interrupt-btn");
const liveEndBtn = document.getElementById("live-end-btn");
const liveSpeedBtn = document.getElementById("live-speed-btn");
const liveAgentSelect = document.getElementById("live-agent-select");
const voiceEngineSelect = document.getElementById("voice-engine-select");
const neuralVoiceSelect = document.getElementById("neural-voice-select");

// Global Speech Settings
let currentSpeechRate = 1.0;
const SPEECH_RATES = [1.0, 1.2, 1.5, 0.85];
let currentVoiceEngine = localStorage.getItem("sia_voice_engine") || "browser";
let currentNeuralVoiceId = localStorage.getItem("sia_neural_voice_id") || "Xb7hH8MSUJpSbSDYk0k2";

if (voiceEngineSelect) {
  voiceEngineSelect.value = currentVoiceEngine;
  if (neuralVoiceSelect) {
    neuralVoiceSelect.hidden = currentVoiceEngine !== "elevenlabs";
    neuralVoiceSelect.value = currentNeuralVoiceId;
  }
  voiceEngineSelect.addEventListener("change", (e) => {
    currentVoiceEngine = e.target.value;
    localStorage.setItem("sia_voice_engine", currentVoiceEngine);
    if (neuralVoiceSelect) {
      neuralVoiceSelect.hidden = currentVoiceEngine !== "elevenlabs";
    }
  });
}

if (neuralVoiceSelect) {
  neuralVoiceSelect.addEventListener("change", (e) => {
    currentNeuralVoiceId = e.target.value;
    localStorage.setItem("sia_neural_voice_id", currentNeuralVoiceId);
  });
}

function showLogin() {
  loginOverlay.hidden = false;
  loginError.hidden = true;
  loginError.textContent = "";
  loginPassword.value = "";
  setTimeout(() => loginPassword.focus(), 50);
}

function hideLogin() {
  loginOverlay.hidden = true;
  loginError.hidden = true;
  loginError.textContent = "";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginPassword.value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      loginError.textContent = data.error || "Login failed.";
      loginError.hidden = false;
      return;
    }
    loginPassword.value = "";
    hideLogin();
    loadHistory();
    loadModels();
  } catch (err) {
    loginError.textContent = "Network error: " + err.message;
    loginError.hidden = false;
  }
});

// Check whether this deployment requires a password.
fetch("/api/auth-status")
  .then(() => {
    loadHistory();
    loadModels();
  })
  .catch(() => {
    loadHistory();
    loadModels();
  });

function loadHistory() {
  fetch("/api/history", {
    credentials: "same-origin",
  })
    .then((r) => {
      if (r.status === 401) {
        showLogin();
        return null;
      }
      return r.json();
    })
    .then((data) => {
      if (!data) return;
      const { messages } = data;
      if (!messages || messages.length === 0) return;
      emptyState.remove();
      for (const m of messages) {
        if (m.role === "user") {
          addUserMessage(m.content);
        } else {
          addAssistantMessage(m.content, { modelLabel: "restored", category: "history" }, false);
        }
      }
    })
    .catch(() => {});
}

const CATEGORY_ICONS = {
  coding: "💻",
  coding_fast: "⚡",
  coding_python: "🐍",
  reasoning: "🧠",
  deep_thinking: "🔬",
  fast_reasoning: "🎯",
  creative: "✍️",
  creative_fast: "💡",
  research: "🌐",
  research_fast: "📰",
  vision: "👁️",
  vision_fast: "📸",
  long_context: "📚",
  fast_general: "⚡",
  ultra_fast_chat: "🚀",
  flagship_omni: "👑",
  gpt_fast: "🤖",
  data: "📊",
  device_control: "⚙️",
  open_source: "🦙",
  open_source_giant: "🗿",
  multilingual: "🌍",
  cybersecurity: "🛡️",
  witty_unfiltered: "🔥",
  math_science: "⚛️",
  finance_business: "📈",
};

let allModelsList = [];
let allCategoriesMap = {};
let activeCategoryFilter = "all";
let selectedCustomModelId = null;

function loadModels() {
  fetch("/api/models", { credentials: "same-origin" })
    .then((r) => (r.status === 401 ? null : r.json()))
    .then((data) => {
      if (!data) return;
      allCategoriesMap = data.categories || data;
      allModelsList = data.models || [];

      const totalCount = data.total || allModelsList.length || Object.keys(allCategoriesMap).length;
      if (modelsCountBadge) {
        modelsCountBadge.textContent = `${totalCount} Models Online`;
      }

      // Populate overrideSelect with categories + all 300+ models
      if (overrideSelect) {
        overrideSelect.innerHTML = `<option value="">🤖 Auto-Route (Intelligent)</option>`;
        
        const catGroup = document.createElement("optgroup");
        catGroup.label = "⚡ Specialized Superpowers (Auto)";
        Object.entries(allCategoriesMap).forEach(([category, entry]) => {
          if (category === "default") return;
          const icon = CATEGORY_ICONS[category] || "🤖";
          const opt = document.createElement("option");
          opt.value = category;
          opt.textContent = `${icon} ${entry.label}`;
          opt.title = entry.why;
          catGroup.appendChild(opt);
        });
        overrideSelect.appendChild(catGroup);

        if (allModelsList.length > 0) {
          const modelGroup = document.createElement("optgroup");
          modelGroup.label = `🌐 All ${allModelsList.length}+ AI Models`;
          allModelsList.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = `model:${m.id}`;
            opt.textContent = `${m.icon || "🤖"} ${m.name} (${m.context || "128k"})`;
            opt.title = m.description || m.id;
            modelGroup.appendChild(opt);
          });
          overrideSelect.appendChild(modelGroup);
        }
      }

      // Populate liveAgentSelect with categories + all models
      if (liveAgentSelect) {
        liveAgentSelect.innerHTML = `<option value="">🤖 Auto-Route (All Protocols)</option>`;
        const catGroup = document.createElement("optgroup");
        catGroup.label = "⚡ Specialized Superpowers";
        Object.entries(allCategoriesMap).forEach(([category, entry]) => {
          if (category === "default") return;
          const icon = CATEGORY_ICONS[category] || "🤖";
          const opt = document.createElement("option");
          opt.value = category;
          opt.textContent = `${icon} ${entry.label}`;
          catGroup.appendChild(opt);
        });
        liveAgentSelect.appendChild(catGroup);

        if (allModelsList.length > 0) {
          const modelGroup = document.createElement("optgroup");
          modelGroup.label = `🌐 All ${allModelsList.length}+ Models`;
          allModelsList.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = `model:${m.id}`;
            opt.textContent = `${m.icon || "🤖"} ${m.name}`;
            modelGroup.appendChild(opt);
          });
          liveAgentSelect.appendChild(modelGroup);
        }
      }

      renderModelCards();
    })
    .catch(() => {});
}

function renderModelCards() {
  if (!modelsGrid) return;
  modelsGrid.innerHTML = "";

  const query = (modelsSearchInput ? modelsSearchInput.value : "").trim().toLowerCase();
  
  const filtered = allModelsList.filter((m) => {
    if (activeCategoryFilter === "featured") {
      if (!m.featured) return false;
    } else if (activeCategoryFilter !== "all") {
      if (m.category !== activeCategoryFilter && m.provider !== activeCategoryFilter) {
        return false;
      }
    }

    if (query) {
      const matchText = `${m.name} ${m.id} ${m.provider} ${m.category} ${m.description || ""}`.toLowerCase();
      if (!matchText.includes(query)) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    modelsGrid.innerHTML = `
      <div class="models-empty-search">
        <p>No AI models found matching "${query}".</p>
        <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 6px;">Try searching for Claude, OpenAI, DeepSeek, Llama, Mistral, Qwen, Gemini, or Grok.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((m) => {
    const card = document.createElement("div");
    card.className = `model-card ${selectedCustomModelId === m.id ? "selected" : ""}`;
    card.innerHTML = `
      <div class="model-card-top">
        <div class="model-card-header">
          <span class="model-card-icon">${m.icon || "🤖"}</span>
          <span class="model-card-name" title="${m.name}">${m.name}</span>
        </div>
        <span class="model-context-badge">${m.context || "128k"}</span>
      </div>
      <div class="model-card-id" title="${m.id}">${m.id}</div>
      <p class="model-card-desc">${m.description || `${m.name} by ${m.provider} for advanced AI intelligence.`}</p>
      <div class="model-card-footer">
        <span class="model-category-pill">${m.category || "General"}</span>
        <button class="model-select-btn" type="button">
          ${selectedCustomModelId === m.id ? "✓ Active" : "Select"}
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      selectModel(m);
    });

    modelsGrid.appendChild(card);
  });
}

function selectModel(model) {
  selectedCustomModelId = model ? model.id : null;
  
  if (overrideSelect) {
    overrideSelect.value = model ? `model:${model.id}` : "";
  }
  if (liveAgentSelect) {
    liveAgentSelect.value = model ? `model:${model.id}` : "";
  }

  if (modelsBtnLabel) {
    modelsBtnLabel.textContent = model ? `${model.icon || "⚡"} ${model.name.split(" ")[0]}` : "🌐 300+ AI Models";
  }

  renderModelCards();
  closeModelsModal();
}

function openModelsModal() {
  if (!modelsOverlay) return;
  modelsOverlay.hidden = false;
  if (modelsSearchInput) {
    modelsSearchInput.value = "";
    if (modelsClearBtn) modelsClearBtn.hidden = true;
    setTimeout(() => modelsSearchInput.focus(), 80);
  }
  renderModelCards();
}

function closeModelsModal() {
  if (!modelsOverlay) return;
  modelsOverlay.hidden = true;
}

if (modelsCatalogBtn) {
  modelsCatalogBtn.addEventListener("click", openModelsModal);
}
if (modelsCloseBtn) {
  modelsCloseBtn.addEventListener("click", closeModelsModal);
}
if (modelsOverlay) {
  modelsOverlay.addEventListener("click", (e) => {
    if (e.target === modelsOverlay) closeModelsModal();
  });
}

if (modelsSearchInput) {
  modelsSearchInput.addEventListener("input", () => {
    if (modelsClearBtn) modelsClearBtn.hidden = !modelsSearchInput.value;
    renderModelCards();
  });
}

if (modelsClearBtn) {
  modelsClearBtn.addEventListener("click", () => {
    modelsSearchInput.value = "";
    modelsClearBtn.hidden = true;
    modelsSearchInput.focus();
    renderModelCards();
  });
}

if (modelsFilterTabs) {
  modelsFilterTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    modelsFilterTabs.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeCategoryFilter = tab.dataset.category || "all";
    renderModelCards();
  });
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addUserMessage(text) {
  if (emptyState && emptyState.parentElement) {
    emptyState.remove();
  }
  const el = document.createElement("div");
  el.className = "msg user";
  el.innerHTML = `<div class="bubble"></div>`;
  el.querySelector(".bubble").textContent = text;
  chatWindow.appendChild(el);
  scrollToBottom();
}

function addThinking() {
  const el = document.createElement("div");
  el.className = "msg assistant thinking-wrap";
  el.innerHTML = `<div class="thinking"><span>routing</span><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatWindow.appendChild(el);
  scrollToBottom();
  return el;
}

// -------------------------------------------------------------
// Interactive Sound FX (Synthesized with Web Audio API)
// -------------------------------------------------------------
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playChime(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "start") {
      // Futuristic J.A.R.V.I.S. Arc Reactor dual harmonic power-up chord
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18); // C6
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.18); // E6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    } else if (type === "send") {
      // J.A.R.V.I.S. Compute Processing sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "ready") {
      // J.A.R.V.I.S. Ready Chord
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === "interrupt") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (_) {}
}

// -------------------------------------------------------------
// Real-time Mic Audio Analyser & Visualizer
// -------------------------------------------------------------
let micMediaStream = null;
let micAnalyser = null;
let micAnimFrame = null;

async function startMicVisualizer() {
  if (micMediaStream) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micMediaStream = stream;
    const ctx = getAudioContext();
    if (!ctx) return;

    const source = ctx.createMediaStreamSource(stream);
    micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 64;
    micAnalyser.smoothingTimeConstant = 0.7;
    source.connect(micAnalyser);

    const barEls = orbAudioBars ? orbAudioBars.querySelectorAll("span") : [];
    const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);

    function updateBars() {
      if (!isLiveModeActive || liveState !== "LISTENING" || isLiveMuted) {
        if (orbCore) orbCore.style.transform = "";
        barEls.forEach((b) => (b.style.height = "6px"));
        micAnimFrame = requestAnimationFrame(updateBars);
        return;
      }

      micAnalyser.getByteFrequencyData(dataArray);
      let avg = 0;
      for (let i = 0; i < dataArray.length; i++) {
        avg += dataArray[i];
      }
      avg = avg / dataArray.length; // 0 - 255

      // Scale central orb slightly with real voice volume
      const scale = 1.0 + Math.min(avg / 180, 0.25);
      if (orbCore) {
        orbCore.style.transform = `scale(${scale})`;
      }
      if (orbAura) {
        orbAura.style.opacity = `${0.5 + Math.min(avg / 200, 0.5)}`;
      }

      // Deform equalizer bars inside orb
      barEls.forEach((bar, idx) => {
        const val = dataArray[idx * 3] || avg;
        const h = Math.max(4, Math.min(24, (val / 255) * 26));
        bar.style.height = `${h}px`;
      });

      micAnimFrame = requestAnimationFrame(updateBars);
    }

    micAnimFrame = requestAnimationFrame(updateBars);
  } catch (err) {
    console.warn("Mic visualizer error:", err);
  }
}

function stopMicVisualizer() {
  if (micAnimFrame) {
    cancelAnimationFrame(micAnimFrame);
    micAnimFrame = null;
  }
  if (micMediaStream) {
    micMediaStream.getTracks().forEach((track) => track.stop());
    micMediaStream = null;
  }
  if (orbCore) orbCore.style.transform = "";
}

// -------------------------------------------------------------
// Voice Output Engine (Browser TTS + ElevenLabs Neural AI)
// -------------------------------------------------------------
let autoVoiceEnabled = localStorage.getItem("sia_voice_mode") === "true";
let activeSpeakerBtn = null;
let speechQueue = [];
let isPlayingQueue = false;
let ttsHeartbeat = null;
let onSpeechFinishedCallback = null;
let currentAudioElement = null;

function updateVoiceToggleUI() {
  if (!voiceToggleBtn) return;
  if (autoVoiceEnabled) {
    voiceToggleBtn.classList.add("active");
    voiceToggleBtn.querySelector(".voice-toggle-label").textContent = "Voice Output: ON";
  } else {
    voiceToggleBtn.classList.remove("active");
    voiceToggleBtn.querySelector(".voice-toggle-label").textContent = "Voice Output";
  }
}
updateVoiceToggleUI();

if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener("click", () => {
    autoVoiceEnabled = !autoVoiceEnabled;
    localStorage.setItem("sia_voice_mode", autoVoiceEnabled);
    updateVoiceToggleUI();
    if (!autoVoiceEnabled) {
      stopSpeaking(false);
    }
  });
}

// Speed button click handler
if (liveSpeedBtn) {
  liveSpeedBtn.addEventListener("click", () => {
    const idx = SPEECH_RATES.indexOf(currentSpeechRate);
    const nextIdx = (idx + 1) % SPEECH_RATES.length;
    currentSpeechRate = SPEECH_RATES[nextIdx];
    liveSpeedBtn.textContent = `${currentSpeechRate}x`;
    playChime("start");
  });
}

function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, " [Code block omitted] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~`>]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text, maxLen = 140) {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const chunks = [];

  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;
    if (sentence.length <= maxLen) {
      chunks.push(sentence);
    } else {
      const parts = sentence.split(/([,;:]|\s{2,})/);
      let cur = "";
      for (let part of parts) {
        if ((cur + part).length > maxLen && cur.length > 0) {
          chunks.push(cur.trim());
          cur = part;
        } else {
          cur += part;
        }
      }
      if (cur.trim()) chunks.push(cur.trim());
    }
  }
  return chunks.length > 0 ? chunks : [text];
}

function getSpeakerIcon(isSpeaking) {
  if (isSpeaking) {
    return `
      <div class="audio-bars">
        <span></span><span></span><span></span>
      </div>
      <span>Stop</span>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
    <span>Listen</span>
  `;
}

function stopSpeaking(triggerCallback = false) {
  speechQueue = [];
  isPlayingQueue = false;
  if (ttsHeartbeat) {
    clearInterval(ttsHeartbeat);
    ttsHeartbeat = null;
  }
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement = null;
  }
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
  if (activeSpeakerBtn) {
    activeSpeakerBtn.classList.remove("speaking");
    activeSpeakerBtn.innerHTML = getSpeakerIcon(false);
    activeSpeakerBtn.title = "Read aloud";
    activeSpeakerBtn = null;
  }
  const cb = onSpeechFinishedCallback;
  onSpeechFinishedCallback = null;
  if (triggerCallback && cb) {
    cb();
  }
}

function playNextChunk(btnElement) {
  if (!isPlayingQueue || speechQueue.length === 0) {
    stopSpeaking(true);
    return;
  }

  const chunk = speechQueue.shift();
  const utterance = new SpeechSynthesisUtterance(chunk);

  const voices = window.speechSynthesis.getVoices();
  const naturalVoice =
    voices.find(
      (v) =>
        (v.lang === "en-GB" || v.lang === "en_GB" || v.name.includes("UK") || v.name.includes("British") || v.name.includes("George") || v.name.includes("Oliver") || v.name.includes("Daniel")) &&
        (v.name.includes("Natural") || v.name.includes("Online") || v.name.includes("Google") || v.name.includes("Premium") || true)
    ) ||
    voices.find(
      (v) =>
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Daniel") ||
          v.name.includes("Premium") ||
          v.name.includes("David")) &&
        v.lang.startsWith("en")
    ) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }
  utterance.rate = currentSpeechRate;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    if (isPlayingQueue) {
      playNextChunk(btnElement);
    }
  };

  utterance.onerror = (e) => {
    if (e.error !== "canceled" && e.error !== "interrupted") {
      if (isPlayingQueue) {
        playNextChunk(btnElement);
      }
    }
  };

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  window.speechSynthesis.speak(utterance);
}

// Speak text using either ElevenLabs Neural Voice or Browser TTS
async function speakText(text, btnElement = null, onFinish = null) {
  stopSpeaking(false);
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    if (onFinish) onFinish();
    return;
  }

  onSpeechFinishedCallback = onFinish;
  isPlayingQueue = true;

  if (btnElement) {
    activeSpeakerBtn = btnElement;
    btnElement.classList.add("speaking");
    btnElement.innerHTML = getSpeakerIcon(true);
    btnElement.title = "Stop reading";
  }

  // 1. Try ElevenLabs Neural Voice if enabled
  if (currentVoiceEngine === "elevenlabs") {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleaned,
          voiceId: currentNeuralVoiceId,
        }),
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioElement = audio;
        audio.playbackRate = currentSpeechRate;

        audio.onended = () => {
          stopSpeaking(true);
        };
        audio.onerror = () => {
          fallbackToBrowserSpeech(cleaned, btnElement);
        };

        await audio.play();
        return;
      } else {
        console.warn("ElevenLabs quota exceeded or unavailable. Instantly switching to natural browser voice.");
        currentVoiceEngine = "browser";
      }
    } catch (err) {
      console.warn("ElevenLabs request failed, switching to browser voice:", err);
      currentVoiceEngine = "browser";
    }
  }

  // 2. Fallback to Browser Speech Synthesis
  fallbackToBrowserSpeech(cleaned, btnElement);
}

function fallbackToBrowserSpeech(cleaned, btnElement) {
  if (!("speechSynthesis" in window)) {
    stopSpeaking(true);
    return;
  }

  speechQueue = splitIntoChunks(cleaned);

  if (!ttsHeartbeat) {
    ttsHeartbeat = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 8000);
  }

  playNextChunk(btnElement);
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

// -------------------------------------------------------------
// Voice Recognition (Speech-to-Text / Continuous Mic Input)
// -------------------------------------------------------------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let shouldBeListening = false;
let accumulatedTranscript = "";
let silenceTimer = null;
let lastSpokenText = "";

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    if (micBtn) {
      micBtn.classList.add("listening");
      micBtn.title = "Listening... (Click to stop)";
    }
    if (isLiveModeActive) {
      setLiveState("LISTENING");
    }
  };

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    if (final) {
      accumulatedTranscript = (accumulatedTranscript ? accumulatedTranscript + " " : "") + final.trim();
    }
    const currentText = (accumulatedTranscript + (interim ? " " + interim : "")).trim();
    lastSpokenText = currentText;

    if (isLiveModeActive) {
      handleLiveSpeechResult(currentText, Boolean(final));
    } else {
      input.value = currentText;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (final && currentText.trim().length > 0) {
        silenceTimer = setTimeout(() => {
          if (!isLiveModeActive && shouldBeListening && input.value.trim().length > 0) {
            stopListening();
            composer.dispatchEvent(new Event("submit", { cancelable: true }));
          }
        }, 800);
      }
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech") {
      return;
    }
    console.warn("Speech recognition error:", event.error);
    if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "network" || event.error === "audio-capture") {
      shouldBeListening = false;
      isListening = false;
      if (isLiveModeActive) {
        setLiveState("ERROR", "Microphone / Browser Notice");
        liveAssistantCaption.textContent = "Voice recognition is blocked in the VS Code embedded browser. Please open http://localhost:3000 in Google Chrome or Microsoft Edge to talk live.";
      }
    }
  };

  recognition.onend = () => {
    isListening = false;
    if (shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening && !isListening) {
          try {
            recognition.start();
          } catch (_) {}
        }
      }, 100);
    } else {
      if (micBtn) {
        micBtn.classList.remove("listening");
        micBtn.title = "Speak to Sia (Voice recognition)";
      }
    }
  };
} else if (micBtn) {
  micBtn.style.display = "none";
}

function startListening() {
  if (!recognition) return;
  shouldBeListening = true;
  accumulatedTranscript = isLiveModeActive ? "" : input.value.trim();
  lastSpokenText = "";
  if (isListening) return;
  try {
    recognition.start();
  } catch (_) {
    setTimeout(() => {
      if (shouldBeListening && !isListening) {
        try { recognition.start(); } catch (_) {}
      }
    }, 150);
  }
}

function stopListening() {
  shouldBeListening = false;
  isListening = false;
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (micBtn) {
    micBtn.classList.remove("listening");
    micBtn.title = "Speak to Sia (Voice recognition)";
  }
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {}
  }
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (shouldBeListening) {
      stopListening();
      if (input.value.trim().length > 0) {
        composer.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    } else {
      stopSpeaking(false);
      startListening();
    }
  });
}

// -------------------------------------------------------------
// Live Voice Mode (Full-Duplex Interactive Conversational Engine)
// -------------------------------------------------------------
let isLiveModeActive = false;
let liveState = "IDLE"; // "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "MUTED"
let isLiveMuted = false;
let liveAudioCtx = null;
let liveAnalyser = null;
let liveMicStream = null;
let liveAnimFrame = null;
let isUserActivelySpeaking = false;

function getAudioContext() {
  if (!liveAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) liveAudioCtx = new AudioCtx();
  }
  if (liveAudioCtx && liveAudioCtx.state === "suspended") {
    liveAudioCtx.resume().catch(() => {});
  }
  return liveAudioCtx;
}

function playChime(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "start") {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "send") {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "ready") {
      osc.frequency.setValueAtTime(659, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "interrupt") {
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (_) {}
}

async function startMicVisualizer() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return;
    if (liveMicStream) return;

    liveMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = ctx.createMediaStreamSource(liveMicStream);
    liveAnalyser = ctx.createAnalyser();
    liveAnalyser.fftSize = 256;
    source.connect(liveAnalyser);

    const bufferLength = liveAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function checkEnergy() {
      if (!isLiveModeActive) return;
      liveAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      isUserActivelySpeaking = avg > 20;

      // Instant Barge-In: if user speaks loudly while assistant is speaking, cut audio immediately
      if (isUserActivelySpeaking && liveState === "SPEAKING") {
        playChime("interrupt");
        stopSpeaking(false);
        setLiveState("LISTENING");
        liveAssistantCaption.textContent = "Listening to you, sir...";
      }

      liveAnimFrame = requestAnimationFrame(checkEnergy);
    }
    checkEnergy();
  } catch (_) {}
}

function stopMicVisualizer() {
  if (liveAnimFrame) {
    cancelAnimationFrame(liveAnimFrame);
    liveAnimFrame = null;
  }
  if (liveMicStream) {
    liveMicStream.getTracks().forEach((t) => t.stop());
    liveMicStream = null;
  }
}

function setLiveState(state, message = "") {
  liveState = state;
  liveVoiceOverlay.classList.remove("state-listening", "state-thinking", "state-speaking");

  if (state === "LISTENING") {
    liveVoiceOverlay.classList.add("state-listening");
    liveStatusText.textContent = "Listening...";
    liveModelBadge.hidden = true;
  } else if (state === "THINKING") {
    liveVoiceOverlay.classList.add("state-thinking");
    liveStatusText.textContent = "Sia is thinking...";
  } else if (state === "SPEAKING") {
    liveVoiceOverlay.classList.add("state-speaking");
    liveStatusText.textContent = message || "Sia is speaking...";
  } else if (state === "MUTED") {
    liveStatusText.textContent = "Mic Muted";
  } else if (state === "ERROR") {
    liveStatusText.textContent = message || "Microphone Error";
  }
}

function handleLiveSpeechResult(text, isFinal = false) {
  if (!text || text.trim().length === 0) return;
  liveUserCaption.textContent = `"${text}"`;

  // Natural voice interruption: if assistant is currently speaking when user starts talking, stop audio immediately
  if (liveState === "SPEAKING") {
    playChime("interrupt");
    stopSpeaking(false);
    setLiveState("LISTENING");
  }

  // Clear previous timer
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  // Snappy pause detection: 700ms after final sentence or 1000ms after interim speech
  const pauseDuration = isFinal ? 700 : 1000;
  silenceTimer = setTimeout(() => {
    if (isLiveModeActive && !isLiveMuted && text.trim().length > 0 && liveState === "LISTENING") {
      dispatchLiveConversation(text.trim());
    }
  }, pauseDuration);
}

function cleanWakePrefix(raw) {
  if (!raw) return "";
  return raw
    .replace(/^(hey\s+sia|hi\s+sia|ok\s+sia|sia|see\s+ya|seeya|shia|sierra|hey\s+jarvis|jarvis)[,\s:]*/i, "")
    .trim();
}

async function dispatchLiveConversation(spokenText) {
  if (!spokenText || spokenText.trim().length === 0) return;

  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  playChime("send");

  // Pause speech recognition while Sia thinks and talks back
  shouldBeListening = false;
  accumulatedTranscript = "";
  lastSpokenText = "";
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }

  const cleanedCommand = cleanWakePrefix(spokenText) || spokenText;

  setLiveState("THINKING");
  liveUserCaption.textContent = `"${spokenText}"`;
  liveAssistantCaption.textContent = "Executing instruction, sir...";

  // Add to background chat window history
  addUserMessage(spokenText);

  try {
    let forceCategory = null;
    let forceModel = null;
    const selectedVal = (liveAgentSelect && liveAgentSelect.value) || (overrideSelect && overrideSelect.value) || null;
    if (selectedVal) {
      if (selectedVal.startsWith("model:")) {
        forceModel = selectedVal.slice(6);
      } else {
        forceCategory = selectedVal;
      }
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanedCommand, forceCategory, forceModel }),
    });
    const data = await res.json();

    if (!res.ok) {
      const err = data.error || "An error occurred.";
      liveAssistantCaption.textContent = err;
      addErrorMessage(err);
      if (isLiveModeActive && !isLiveMuted) {
        setTimeout(() => startListening(), 1200);
      }
      return;
    }

    // Action steps handled directly on host system by Sia orchestrator

    // Update model badge with routed agent info
    if (data.routing) {
      liveModelName.textContent = `${data.routing.modelLabel} · ${data.routing.category}`;
      liveModelBadge.title = `${data.routing.why} (Classified via ${data.routing.classifiedBy})`;
      liveModelBadge.hidden = false;
    }

    // Add to chat history in background
    addAssistantMessage(data.answer, data.routing, false, data.steps);

    // Show response in live subtitle
    liveAssistantCaption.textContent = data.answer;
    setLiveState("SPEAKING", `Sia Speaking (${data.routing ? data.routing.modelLabel : "AI"})`);

    // Speak response out loud, then IMMEDIATELY resume listening for next turn without any buttons!
    speakText(data.answer, null, () => {
      if (isLiveModeActive && !isLiveMuted) {
        playChime("ready");
        liveUserCaption.textContent = "";
        liveAssistantCaption.textContent = "Sia online. Ready for your command, sir.";
        startListening();
      }
    });
  } catch (err) {
    liveAssistantCaption.textContent = "Network error: " + err.message;
    addErrorMessage("Network error: " + err.message);
    if (isLiveModeActive && !isLiveMuted) {
      setTimeout(() => startListening(), 1500);
    }
  }
}

function openLiveMode() {
  getAudioContext();
  playChime("start");
  isLiveModeActive = true;
  isLiveMuted = false;
  liveMuteBtn.classList.remove("muted");
  liveMuteLabel.textContent = "Mute";
  liveVoiceOverlay.hidden = false;
  liveUserCaption.textContent = "";
  liveAssistantCaption.textContent = "Sia voice protocol active. Speak your command, sir...";
  stopSpeaking(false);
  startListening();
  startMicVisualizer();
}

function closeLiveMode() {
  playChime("interrupt");
  isLiveModeActive = false;
  liveVoiceOverlay.hidden = true;
  stopSpeaking(false);
  stopListening();
  stopMicVisualizer();
}

if (liveVoiceBtn) {
  liveVoiceBtn.addEventListener("click", openLiveMode);
}
if (liveCloseBtn) {
  liveCloseBtn.addEventListener("click", closeLiveMode);
}
if (liveEndBtn) {
  liveEndBtn.addEventListener("click", closeLiveMode);
}

// Live Orb Touch / Interruption
if (liveOrb) {
  liveOrb.addEventListener("click", () => {
    if (liveState === "SPEAKING") {
      playChime("interrupt");
      stopSpeaking(false);
      liveAssistantCaption.textContent = "Listening to you...";
      startListening();
    } else if (liveState !== "LISTENING" && !isLiveMuted) {
      playChime("start");
      startListening();
    }
  });
}

if (liveInterruptBtn) {
  liveInterruptBtn.addEventListener("click", () => {
    playChime("interrupt");
    stopSpeaking(false);
    liveAssistantCaption.textContent = "Interrupted. Listening...";
    startListening();
  });
}

if (liveMuteBtn) {
  liveMuteBtn.addEventListener("click", () => {
    isLiveMuted = !isLiveMuted;
    if (isLiveMuted) {
      playChime("interrupt");
      stopListening();
      stopSpeaking(false);
      liveMuteBtn.classList.add("muted");
      liveMuteLabel.textContent = "Unmute";
      setLiveState("MUTED");
    } else {
      playChime("start");
      liveMuteBtn.classList.remove("muted");
      liveMuteLabel.textContent = "Mute";
      startListening();
    }
  });
}

// Keyboard shortcut: Spacebar in Live Mode
window.addEventListener("keydown", (e) => {
  if (!isLiveModeActive) return;
  if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
    e.preventDefault();
    if (liveState === "SPEAKING") {
      playChime("interrupt");
      stopSpeaking(false);
      liveAssistantCaption.textContent = "Interrupted. Listening...";
      startListening();
    } else if (lastSpokenText && lastSpokenText.trim().length > 0) {
      dispatchLiveConversation(lastSpokenText.trim());
    } else {
      liveMuteBtn.click();
    }
  } else if (e.code === "Escape") {
    closeLiveMode();
  }
});

// ============================================================
// Markdown Formatter & Code Copy Utilities
// ============================================================
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMarkdown(text) {
  if (!text) return "";
  let safe = text;

  // 1. Code blocks ```lang\ncode\n```
  safe = safe.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const cleanLang = lang.trim() || "code";
    const escapedCode = escapeHtml(code.trim());
    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang-tag">${cleanLang}</span>
        <button class="copy-code-btn" type="button" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy', 1500);">Copy</button>
      </div>
      <pre><code>${escapedCode}</code></pre>
    </div>`;
  });

  // 2. Inline code `code`
  safe = safe.replace(/`([^`]+)`/g, (m, c) => `<code>${escapeHtml(c)}</code>`);

  // 3. Bold **text**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 4. Italic *text*
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 5. Links [text](url)
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');

  // 6. Convert newlines to breaks (outside pre blocks)
  const parts = safe.split(/(<div class="code-block-wrapper">[\s\S]*?<\/div>)/g);
  return parts.map((part) => {
    if (part.startsWith('<div class="code-block-wrapper">')) return part;
    return part.replace(/\n/g, "<br/>");
  }).join("");
}

// ============================================================
// Multimodal File Studio & Drag-and-Drop
// ============================================================
function renderFileChips() {
  if (!filePreviewBar) return;
  if (pendingAttachedFiles.length === 0) {
    filePreviewBar.hidden = true;
    filePreviewBar.innerHTML = "";
    return;
  }

  filePreviewBar.hidden = false;
  filePreviewBar.innerHTML = "";

  pendingAttachedFiles.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";

    if (file.kind === "image" && file.dataUrl) {
      chip.innerHTML = `
        <img class="file-chip-thumb" src="${file.dataUrl}" alt="${escapeHtml(file.name)}" />
        <span class="file-chip-name">${escapeHtml(file.name)}</span>
        <button type="button" class="file-chip-remove" title="Remove">&times;</button>
      `;
    } else {
      const icon = file.kind === "tabular" ? "📊" : "📄";
      chip.innerHTML = `
        <span>${icon}</span>
        <span class="file-chip-name">${escapeHtml(file.name)}</span>
        <button type="button" class="file-chip-remove" title="Remove">&times;</button>
      `;
    }

    chip.querySelector(".file-chip-remove").addEventListener("click", () => {
      pendingAttachedFiles.splice(index, 1);
      renderFileChips();
    });

    filePreviewBar.appendChild(chip);
  });
}

async function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  for (const f of Array.from(fileList)) {
    const reader = new FileReader();

    if (f.type.startsWith("image/")) {
      reader.onload = async (e) => {
        try {
          const res = await fetch("/api/files/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: f.name,
              type: f.type,
              dataUrl: e.target.result,
            }),
          });
          const data = await res.json();
          if (data.ok && data.file) {
            pendingAttachedFiles.push(data.file);
            renderFileChips();
          }
        } catch (err) {
          console.error("File upload error:", err);
        }
      };
      reader.readAsDataURL(f);
    } else {
      reader.onload = async (e) => {
        try {
          const res = await fetch("/api/files/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: f.name,
              type: f.type,
              textContent: e.target.result,
            }),
          });
          const data = await res.json();
          if (data.ok && data.file) {
            pendingAttachedFiles.push(data.file);
            renderFileChips();
          }
        } catch (err) {
          console.error("File processing error:", err);
        }
      };
      reader.readAsText(f);
    }
  }
}

if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    fileInput.value = "";
  });
}

// Window Drag & Drop Overlay
let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dropZoneOverlay) dropZoneOverlay.hidden = false;
});
window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0 && dropZoneOverlay) {
    dropZoneOverlay.hidden = true;
    dragCounter = 0;
  }
});
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dropZoneOverlay) dropZoneOverlay.hidden = true;
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFiles(e.dataTransfer.files);
  }
});

// ============================================================
// Council of AI & Consensus Mode
// ============================================================
function updateConsensusUI() {
  if (!consensusToggleBtn) return;
  if (isConsensusModeActive) {
    consensusToggleBtn.classList.add("active");
    consensusToggleBtn.style.borderColor = "#a78bfa";
    consensusToggleBtn.style.background = "rgba(167, 139, 250, 0.15)";
    input.placeholder = "🏛️ Ask the Council of 3 Flagship AI Models (Claude, DeepSeek, GPT-4o)...";
  } else {
    consensusToggleBtn.classList.remove("active");
    consensusToggleBtn.style.borderColor = "";
    consensusToggleBtn.style.background = "";
    input.placeholder = "Type or speak your task... (or drag & drop files)";
  }
}

if (consensusToggleBtn) {
  consensusToggleBtn.addEventListener("click", () => {
    isConsensusModeActive = !isConsensusModeActive;
    updateConsensusUI();
  });
}

function renderConsensusPerspectives(perspectives) {
  if (!Array.isArray(perspectives) || perspectives.length === 0) return "";

  const cardsHtml = perspectives
    .filter((p) => p.success)
    .map((p) => `
      <div class="consensus-card">
        <div class="consensus-card-header">
          <span>${escapeHtml(p.label)}</span>
        </div>
        <div class="consensus-card-specialty">${escapeHtml(p.specialty)}</div>
        <div style="margin-top:8px; line-height:1.45; font-size:12.5px; opacity:0.9;">
          ${formatMarkdown(p.response.slice(0, 450))}...
        </div>
      </div>
    `)
    .join("");

  return `
    <div class="consensus-container">
      <div style="font-size:12px; font-family:var(--mono); color:#a78bfa; font-weight:700;">
        🏛️ COUNCIL OF 3 DELIBERATION PERSPECTIVES
      </div>
      <div class="consensus-perspectives-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
}

// ============================================================
// Knowledge Graph Memory Modal Handlers
// ============================================================
function renderKnowledgeData(k) {
  if (!k) return;

  // User Profile
  if (knowledgeUserCard) {
    const prefs = Object.entries(k.user.preferences || {});
    knowledgeUserCard.innerHTML = `
      <div><strong>Name:</strong> ${escapeHtml(k.user.name || "Sir")}</div>
      <div style="margin-top:6px;"><strong>Preferences:</strong></div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">
        ${prefs.length > 0 ? prefs.map(([key, val]) => `• ${escapeHtml(key)}: ${escapeHtml(val)}`).join("<br/>") : "<em>(learning as you chat)</em>"}
      </div>
    `;
  }

  // Active Projects
  if (knowledgeProjectsCard) {
    const projs = Object.entries(k.projects || {});
    knowledgeProjectsCard.innerHTML = projs.length > 0
      ? projs.map(([pName, pDesc]) => `<div><strong>${escapeHtml(pName)}:</strong> ${escapeHtml(pDesc)}</div>`).join("<div style='margin:4px 0;'></div>")
      : "<em style='color:var(--text-dim);'>No projects indexed yet.</em>";
  }

  // Contacts
  if (knowledgeContactsCard) {
    const conts = Object.entries(k.contacts || {});
    knowledgeContactsCard.innerHTML = conts.length > 0
      ? conts.map(([cName, cInfo]) => `<div><strong>${escapeHtml(cName)}:</strong> ${escapeHtml(cInfo)}</div>`).join("<div style='margin:4px 0;'></div>")
      : "<em style='color:var(--text-dim);'>No contacts indexed yet.</em>";
  }

  // Facts List
  if (knowledgeFactsList) {
    knowledgeFactsList.innerHTML = "";
    if (!k.facts || k.facts.length === 0) {
      knowledgeFactsList.innerHTML = "<div style='color:var(--text-dim); font-size:13px;'>No custom facts saved yet. Sia automatically extracts personal facts during conversation.</div>";
    } else {
      k.facts.slice().reverse().forEach((fact) => {
        const item = document.createElement("div");
        item.className = "knowledge-fact-item";
        item.innerHTML = `
          <span>${escapeHtml(fact.text)}</span>
          <button type="button" class="delete-fact-btn" title="Delete Fact">&times;</button>
        `;
        item.querySelector(".delete-fact-btn").addEventListener("click", async () => {
          try {
            const res = await fetch(`/api/memory/knowledge/${fact.id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) renderKnowledgeData(data.knowledge);
          } catch (e) {
            console.error("Delete fact error:", e);
          }
        });
        knowledgeFactsList.appendChild(item);
      });
    }
  }
}

async function loadKnowledgeGraph() {
  try {
    const res = await fetch("/api/memory/knowledge");
    const data = await res.json();
    if (data.ok && data.knowledge) {
      renderKnowledgeData(data.knowledge);
    }
  } catch (err) {
    console.error("Failed to load knowledge graph:", err);
  }
}

if (knowledgeBtn && knowledgeOverlay) {
  knowledgeBtn.addEventListener("click", () => {
    knowledgeOverlay.hidden = false;
    loadKnowledgeGraph();
  });
}
if (knowledgeCloseBtn && knowledgeOverlay) {
  knowledgeCloseBtn.addEventListener("click", () => {
    knowledgeOverlay.hidden = true;
  });
}

if (addFactBtn) {
  addFactBtn.addEventListener("click", async () => {
    const factText = prompt("Enter a persistent fact or preference for Sia to remember:");
    if (!factText || !factText.trim()) return;

    try {
      const res = await fetch("/api/memory/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: factText.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.knowledge) {
        renderKnowledgeData(data.knowledge);
      }
    } catch (err) {
      alert("Failed to save fact: " + err.message);
    }
  });
}

function addAssistantMessage(answer, routing, shouldSpeak = true, steps = []) {
  const el = document.createElement("div");
  el.className = "msg assistant";
  const category = (routing && routing.category) || "general";
  const color = `var(--route-${category}, var(--accent))`;
  const isAuto300 = routing && routing.classifiedBy === "300_model_matcher";
  const modelLabel = (routing && routing.modelLabel) || "Sia Assistant";
  const titleText = routing && routing.why ? `${routing.why} (Evaluated & Ranked among 300+ AI Models)` : `Model: ${modelLabel}`;

  // Extract action URLs for client launching and interactive preview cards
  let actionUrls = [];
  if (Array.isArray(steps)) {
    for (const step of steps) {
      const res = step.result?.result || step.result;
      const url = res?.url || res?.openedUrl || (typeof res === "string" && res.startsWith("http") ? res : null);
      if (url) {
        actionUrls.push({
          action: step.action || "open_url",
          name: res.opened || res.to || "Web Application",
          url: url,
        });
        // Action URL recorded for UI card preview without duplicate opening
      }
    }
  }

  el.innerHTML = `
    <div class="msg-meta">
      <div class="route-chip" style="--route-color:${color}" title="${titleText}">
        <span class="dot"></span>
        ${isAuto300 ? `<span class="auto-300-badge" style="font-size:10px; font-weight:700; color:#38bdf8; margin-right:4px; letter-spacing:0.4px;">✨ 300+ AUTO</span>` : ""}
        <span class="model-name">${modelLabel}</span>
        <span>· ${category.replace(/_/g, " ")}</span>
      </div>
      <button class="speak-btn" type="button" title="Read aloud">
        ${getSpeakerIcon(false)}
      </button>
    </div>
    <div class="bubble" style="--route-color:${color}">
      <div class="bubble-text">${formatMarkdown(answer)}</div>
    </div>
  `;

  const bubble = el.querySelector(".bubble");

  if (actionUrls.length > 0) {
    const actionContainer = document.createElement("div");
    actionContainer.style.cssText = "margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;";
    for (const item of actionUrls) {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "action-chip-link";
      link.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.2s ease;";
      link.innerHTML = `<span>🚀</span><span>Open ${item.name}</span><span style="opacity:0.75;">↗</span>`;
      actionContainer.appendChild(link);
    }
    bubble.appendChild(actionContainer);
  }

  const speakBtn = el.querySelector(".speak-btn");
  speakBtn.addEventListener("click", () => {
    if (speakBtn.classList.contains("speaking")) {
      stopSpeaking(false);
    } else {
      speakText(answer, speakBtn);
    }
  });

  chatWindow.appendChild(el);
  scrollToBottom();

  if (shouldSpeak && autoVoiceEnabled && !isLiveModeActive) {
    speakText(answer, speakBtn);
  }
}

function addErrorMessage(text) {
  const el = document.createElement("div");
  el.className = "msg assistant error";
  el.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatWindow.appendChild(el);
  scrollToBottom();
}

// ============================================================
// Real-Time SSE Streaming Form Submission Handler
// ============================================================
composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  stopListening();
  stopSpeaking(false);

  const message = input.value.trim();
  const attachedFiles = [...pendingAttachedFiles];
  if (!message && attachedFiles.length === 0) return;

  // Clear input and files
  addUserMessage(message || `[Attached ${attachedFiles.length} file(s)]`);
  input.value = "";
  pendingAttachedFiles = [];
  renderFileChips();
  sendBtn.disabled = true;

  // 1. Council of AI Consensus Path
  if (isConsensusModeActive) {
    const thinkingEl = addThinking();
    try {
      const res = await fetch("/api/chat/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      thinkingEl.remove();

      if (!res.ok) {
        addErrorMessage(data.error || "Consensus deliberation failed.");
        return;
      }

      // Render Consensus Master Answer + Perspective Cards
      const consensusCardHtml = renderConsensusPerspectives(data.perspectives);
      const combinedAnswer = `${data.answer}\n\n${consensusCardHtml}`;
      addAssistantMessage(data.answer, data.routing, true);

      // Append perspectives below the message
      const lastMsgBubble = chatWindow.lastElementChild?.querySelector(".bubble");
      if (lastMsgBubble && data.perspectives) {
        const persContainer = document.createElement("div");
        persContainer.innerHTML = renderConsensusPerspectives(data.perspectives);
        lastMsgBubble.appendChild(persContainer);
      }
    } catch (err) {
      thinkingEl.remove();
      addErrorMessage("Consensus error: " + err.message);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
    return;
  }

  // 2. Real-Time SSE Token & Reasoning Streaming Path
  let forceCategory = null;
  let forceModel = null;
  const selectedVal = overrideSelect.value || null;
  if (selectedVal) {
    if (selectedVal.startsWith("model:")) {
      forceModel = selectedVal.slice(6);
    } else {
      forceCategory = selectedVal;
    }
  }

  // Create stream placeholder element in chatWindow
  const streamMsgEl = document.createElement("div");
  streamMsgEl.className = "msg assistant streaming-msg";
  streamMsgEl.innerHTML = `
    <div class="msg-meta">
      <div class="route-chip stream-route-chip" style="--route-color:var(--accent)">
        <span class="dot"></span>
        <span class="model-name">Sia Orchestrating...</span>
      </div>
      <button class="speak-btn" type="button" title="Read aloud" style="display:none;">
        ${getSpeakerIcon(false)}
      </button>
    </div>
    <div class="bubble" style="--route-color:var(--accent)">
      <div class="reasoning-accordion" hidden>
        <div class="reasoning-header">
          <span>🧠 Neural Reasoning Process</span>
          <span class="reasoning-toggle">▼</span>
        </div>
        <div class="reasoning-body"></div>
      </div>
      <div class="bubble-text"><span class="streaming-cursor"></span></div>
    </div>
  `;

  chatWindow.appendChild(streamMsgEl);
  scrollToBottom();

  const bubbleText = streamMsgEl.querySelector(".bubble-text");
  const reasoningAcc = streamMsgEl.querySelector(".reasoning-accordion");
  const reasoningBody = streamMsgEl.querySelector(".reasoning-body");
  const reasoningHeader = streamMsgEl.querySelector(".reasoning-header");
  const routeChip = streamMsgEl.querySelector(".stream-route-chip");
  const modelNameSpan = streamMsgEl.querySelector(".model-name");
  const speakBtn = streamMsgEl.querySelector(".speak-btn");

  if (reasoningHeader) {
    reasoningHeader.addEventListener("click", () => {
      reasoningBody.hidden = !reasoningBody.hidden;
      const toggle = reasoningHeader.querySelector(".reasoning-toggle");
      if (toggle) toggle.textContent = reasoningBody.hidden ? "▶" : "▼";
    });
  }

  let accumulatedContent = "";
  let accumulatedReasoning = "";
  let currentRouting = { modelLabel: "Sia", category: "general" };

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        files: attachedFiles,
        forceCategory,
        forceModel,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      streamMsgEl.remove();
      addErrorMessage(errJson.error || "Streaming request failed.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event:\s*([^\n]+)/);
        const dataMatch = block.match(/data:\s*([\s\S]+)/);

        if (!eventMatch || !dataMatch) continue;
        const eventName = eventMatch[1].trim();
        let eventData = {};
        try {
          eventData = JSON.parse(dataMatch[1].trim());
        } catch (_) {}

        if (eventName === "routing") {
          currentRouting = eventData;
          modelNameSpan.textContent = `${eventData.modelLabel} · ${eventData.category.replace(/_/g, " ")}`;
          const col = `var(--route-${eventData.category}, var(--accent))`;
          routeChip.style.setProperty("--route-color", col);
          streamMsgEl.querySelector(".bubble").style.setProperty("--route-color", col);
        } else if (eventName === "reasoning") {
          accumulatedReasoning += eventData.text || "";
          reasoningAcc.hidden = false;
          reasoningBody.textContent = accumulatedReasoning;
          scrollToBottom();
        } else if (eventName === "token") {
          accumulatedContent += eventData.content || "";
          bubbleText.innerHTML = `${formatMarkdown(accumulatedContent)}<span class="streaming-cursor"></span>`;
          scrollToBottom();
        } else if (eventName === "steps") {
          // Action steps logged
        } else if (eventName === "done") {
          accumulatedContent = eventData.answer || accumulatedContent;
          bubbleText.innerHTML = formatMarkdown(accumulatedContent);
          speakBtn.style.display = "inline-flex";
          speakBtn.addEventListener("click", () => {
            if (speakBtn.classList.contains("speaking")) stopSpeaking(false);
            else speakText(accumulatedContent, speakBtn);
          });
          if (autoVoiceEnabled && !isLiveModeActive) {
            speakText(accumulatedContent, speakBtn);
          }
        } else if (eventName === "error") {
          addErrorMessage(eventData.error || "Streaming error.");
        }
      }
    }

    bubbleText.innerHTML = formatMarkdown(accumulatedContent || "Done, sir.");
    const cur = bubbleText.querySelector(".streaming-cursor");
    if (cur) cur.remove();
  } catch (err) {
    streamMsgEl.remove();
    addErrorMessage("Network connection error: " + err.message);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

// ============================================================
// Device Control
// ============================================================
const deviceControlBtn = document.getElementById("device-control-btn");
const deviceOverlay = document.getElementById("device-overlay");
const deviceCloseBtn = document.getElementById("device-close-btn");
const deviceForm = document.getElementById("device-form");
const deviceInstruction = document.getElementById("device-instruction");
const deviceRunBtn = document.getElementById("device-run-btn");
const deviceLog = document.getElementById("device-log");
const deviceConfirmCard = document.getElementById("device-confirm-card");
const deviceConfirmText = document.getElementById("device-confirm-text");
const deviceApproveBtn = document.getElementById("device-approve-btn");
const deviceDenyBtn = document.getElementById("device-deny-btn");

let deviceCurrentTask = null; // { taskId, pendingConfirmation }

function openDevicePanel() {
  if (!deviceOverlay) return;
  deviceOverlay.hidden = false;
  deviceInstruction.focus();
}

function closeDevicePanel() {
  if (!deviceOverlay) return;
  deviceOverlay.hidden = true;
}

function deviceLogLine(text, kind = "info") {
  const line = document.createElement("div");
  line.className = `device-log-line device-log-${kind}`;
  line.textContent = text;
  deviceLog.appendChild(line);
  deviceLog.scrollTop = deviceLog.scrollHeight;
}

function describeStep(step) {
  switch (step.type) {
    case "action": {
      const ok = step.result && step.result.ok;
      const suffix = ok ? "✓" : `✗ ${step.result?.error || "failed"}`;
      const paramsStr = step.params && Object.keys(step.params).length ? ` ${JSON.stringify(step.params)}` : "";
      return { text: `${step.action}${paramsStr} ${suffix}`, kind: ok ? "ok" : "error" };
    }
    case "action_denied":
      return { text: `${step.action} — denied by you, skipped`, kind: "denied" };
    case "confirmation_needed":
      return { text: `${step.action} needs your approval…`, kind: "pending" };
    case "final":
      return { text: step.content, kind: "final" };
    case "error":
      return { text: step.content, kind: "error" };
    default:
      return { text: JSON.stringify(step), kind: "info" };
  }
}

// Renders only the log entries the panel hasn't already shown, so calling
// this after every command/confirm response never duplicates lines.
function renderNewLogEntries(log) {
  const alreadyShown = Number(deviceLog.dataset.shown || 0);
  for (let i = alreadyShown; i < log.length; i++) {
    const { text, kind } = describeStep(log[i]);
    deviceLogLine(text, kind);
  }
  deviceLog.dataset.shown = String(log.length);
}

function showConfirmCard(pending) {
  const paramsStr = pending.params && Object.keys(pending.params).length ? ` — ${JSON.stringify(pending.params)}` : "";
  deviceConfirmText.textContent = `Approve "${pending.action}"${paramsStr}?`;
  deviceConfirmCard.hidden = false;
}

function hideConfirmCard() {
  deviceConfirmCard.hidden = true;
}

function applyTaskSnapshot(snapshot) {
  deviceCurrentTask = snapshot;
  renderNewLogEntries(snapshot.log || []);

  if (snapshot.status === "awaiting_confirmation" && snapshot.pendingConfirmation) {
    showConfirmCard(snapshot.pendingConfirmation);
    const p = snapshot.pendingConfirmation;
    const paramsStr = p.params && Object.keys(p.params).length ? ` — ${JSON.stringify(p.params)}` : "";
    speakDeviceReply(`I need your approval to ${p.action.replace(/_/g, " ")}${paramsStr}.`);
  } else {
    hideConfirmCard();
    if (snapshot.status === "done" && snapshot.finalAnswer) {
      speakDeviceReply(snapshot.finalAnswer);
    } else if (snapshot.status === "error" && snapshot.finalAnswer) {
      speakDeviceReply(snapshot.finalAnswer);
    }
  }

  const running = snapshot.status === "running" || snapshot.status === "awaiting_confirmation";
  deviceRunBtn.disabled = running;
  deviceInstruction.disabled = running;
}

// Speaks a device-agent reply out loud. Reuses the app's existing TTS
// pipeline (speakText — ElevenLabs if configured, free browser
// speechSynthesis otherwise) so device replies sound consistent with the
// rest of the app, but always speaks regardless of the general "Voice
// Output" auto-speak toggle — you asked for this out loud, you should
// hear the answer.
function speakDeviceReply(text) {
  if (!text) return;
  try {
    speakText(text);
  } catch (err) {
    console.warn("Couldn't speak device reply:", err);
  }
}

if (deviceControlBtn) {
  deviceControlBtn.addEventListener("click", openDevicePanel);
}
if (deviceCloseBtn) {
  deviceCloseBtn.addEventListener("click", closeDevicePanel);
}

if (deviceForm) {
  deviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const instruction = deviceInstruction.value.trim();
    if (!instruction) return;

    deviceLog.innerHTML = "";
    deviceLog.dataset.shown = "0";
    hideConfirmCard();
    deviceLogLine(`> ${instruction}`, "user");
    deviceRunBtn.disabled = true;
    deviceInstruction.disabled = true;

    try {
      const res = await fetch("/api/device/command", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();

      if (res.status === 401) {
        showLogin();
        return;
      }
      if (!res.ok) {
        deviceLogLine(data.error || "Something went wrong.", "error");
        deviceRunBtn.disabled = false;
        deviceInstruction.disabled = false;
        return;
      }

      applyTaskSnapshot(data);
      if (data.status !== "awaiting_confirmation") {
        deviceInstruction.value = "";
      }
    } catch (err) {
      deviceLogLine("Network error: " + err.message, "error");
      deviceRunBtn.disabled = false;
      deviceInstruction.disabled = false;
    }
  });
}

async function respondToConfirmation(approved) {
  if (!deviceCurrentTask || !deviceCurrentTask.pendingConfirmation) return;
  deviceApproveBtn.disabled = true;
  deviceDenyBtn.disabled = true;

  try {
    const res = await fetch("/api/device/confirm", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: deviceCurrentTask.taskId,
        confirmationId: deviceCurrentTask.pendingConfirmation.confirmationId,
        approved,
      }),
    });
    const data = await res.json();

    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) {
      deviceLogLine(data.error || "Couldn't resume that task.", "error");
      return;
    }

    applyTaskSnapshot(data);
    if (data.status !== "awaiting_confirmation") {
      deviceInstruction.value = "";
    }
  } catch (err) {
    deviceLogLine("Network error: " + err.message, "error");
  } finally {
    deviceApproveBtn.disabled = false;
    deviceDenyBtn.disabled = false;
  }
}

if (deviceApproveBtn) {
  deviceApproveBtn.addEventListener("click", () => respondToConfirmation(true));
}
if (deviceDenyBtn) {
  deviceDenyBtn.addEventListener("click", () => respondToConfirmation(false));
}

// -------------------------------------------------------------
// Device Control — Voice Input
// -------------------------------------------------------------
// A dedicated recognition instance (separate from the main chat mic above)
// so the two don't fight over listening state. Same free, continuous,
// no-word-limit Web Speech API — it keeps listening and appending final
// results until you stop it or go quiet for a moment, instead of cutting
// you off after one short utterance.
const deviceMicBtn = document.getElementById("device-mic-btn");
let deviceRecognition = null;
let deviceShouldListen = false;
let deviceIsListening = false;
let deviceAccumulatedTranscript = "";
let deviceSilenceTimer = null;
const DEVICE_SILENCE_AUTOSUBMIT_MS = 1600;

function setDeviceMicUI(listening) {
  if (!deviceMicBtn) return;
  deviceMicBtn.classList.toggle("listening", listening);
  deviceMicBtn.title = listening ? "Listening... (click to stop)" : "Speak your instruction";
}

if (SpeechRecognition && deviceMicBtn) {
  deviceRecognition = new SpeechRecognition();
  deviceRecognition.continuous = true;
  deviceRecognition.interimResults = true;
  deviceRecognition.lang = "en-US";

  deviceRecognition.onstart = () => {
    deviceIsListening = true;
    setDeviceMicUI(true);
  };

  deviceRecognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    if (final) {
      deviceAccumulatedTranscript = (deviceAccumulatedTranscript ? deviceAccumulatedTranscript + " " : "") + final.trim();
    }
    deviceInstruction.value = (deviceAccumulatedTranscript + (interim ? " " + interim : "")).trim();

    // Auto-run once you've gone quiet for a bit after saying something —
    // "voice command and it just does the task" instead of needing a
    // manual tap on Run every time.
    if (deviceSilenceTimer) clearTimeout(deviceSilenceTimer);
    if (deviceAccumulatedTranscript) {
      deviceSilenceTimer = setTimeout(() => {
        if (deviceAccumulatedTranscript.trim()) {
          stopDeviceListening();
          deviceForm.requestSubmit();
        }
      }, DEVICE_SILENCE_AUTOSUBMIT_MS);
    }
  };

  deviceRecognition.onerror = (event) => {
    if (event.error === "no-speech") return;
    console.warn("Device speech recognition error:", event.error);
    if (["not-allowed", "service-not-allowed", "network", "audio-capture"].includes(event.error)) {
      deviceShouldListen = false;
      deviceIsListening = false;
      setDeviceMicUI(false);
      deviceLogLine("Microphone unavailable — check browser permissions.", "error");
    }
  };

  deviceRecognition.onend = () => {
    deviceIsListening = false;
    if (deviceShouldListen) {
      setTimeout(() => {
        if (deviceShouldListen && !deviceIsListening) {
          try { deviceRecognition.start(); } catch (_) {}
        }
      }, 100);
    } else {
      setDeviceMicUI(false);
    }
  };
} else if (deviceMicBtn) {
  deviceMicBtn.style.display = "none";
}

function startDeviceListening() {
  if (!deviceRecognition) return;
  deviceShouldListen = true;
  deviceAccumulatedTranscript = "";
  deviceInstruction.value = "";
  if (deviceIsListening) return;
  try {
    deviceRecognition.start();
  } catch (_) {
    setTimeout(() => {
      if (deviceShouldListen && !deviceIsListening) {
        try { deviceRecognition.start(); } catch (_) {}
      }
    }, 150);
  }
}

function stopDeviceListening() {
  deviceShouldListen = false;
  deviceIsListening = false;
  if (deviceSilenceTimer) {
    clearTimeout(deviceSilenceTimer);
    deviceSilenceTimer = null;
  }
  setDeviceMicUI(false);
  if (deviceRecognition) {
    try { deviceRecognition.stop(); } catch (_) {}
  }
}

if (deviceMicBtn) {
  deviceMicBtn.addEventListener("click", () => {
    if (deviceShouldListen) {
      stopDeviceListening();
    } else {
      startDeviceListening();
    }
  });
}

// Stop listening (but don't lose whatever's already been said) whenever a
// task starts running, and stop entirely when the panel closes.
if (deviceForm) {
  deviceForm.addEventListener("submit", () => stopDeviceListening());
}
if (deviceCloseBtn) {
  deviceCloseBtn.addEventListener("click", () => stopDeviceListening());
}

// ============================================================
// Starter Action Chips Handler
// ============================================================
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".starter-chip");
  if (!chip) return;
  const promptText = chip.dataset.prompt;
  if (!promptText || !input) return;
  input.value = promptText;
  input.focus();
  if (composer) {
    if (typeof composer.requestSubmit === "function") {
      composer.requestSubmit();
    } else {
      composer.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  }
});

// ============================================================
// Global Keyboard Shortcuts (Ctrl+K, Ctrl+M, Escape, Ctrl+Enter)
// ============================================================
window.addEventListener("keydown", (e) => {
  // Ctrl+K / Cmd+K / /: Focus chat input
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (input) input.focus();
  }
  // Ctrl+M / Cmd+M: Toggle Sia Live Voice
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
    e.preventDefault();
    if (isLiveModeActive) closeLiveMode();
    else openLiveMode();
  }
  // Escape: Close all open modals & stop speech
  else if (e.key === "Escape") {
    stopSpeaking(false);
    if (isLiveModeActive) closeLiveMode();
    if (knowledgeOverlay) knowledgeOverlay.hidden = true;
    if (modelsOverlay) modelsOverlay.hidden = true;
    if (deviceOverlay) deviceOverlay.hidden = true;
  }
});

// ============================================================
// Code Block Copy Button Delegation
// ============================================================
document.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest(".copy-code-btn");
  if (!copyBtn) return;
  const codeWrapper = copyBtn.closest(".code-block-wrapper");
  const codeEl = codeWrapper ? codeWrapper.querySelector("pre code") : null;
  if (!codeEl) return;

  try {
    await navigator.clipboard.writeText(codeEl.innerText);
    copyBtn.textContent = "Copied! ✅";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy";
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch (err) {
    console.warn("Clipboard write failed:", err);
  }
});

// ============================================================
// Hiltron Real-Time Telemetry Polling
// ============================================================
async function updateHiltronTelemetry() {
  const hudMemory = document.getElementById("hud-memory");
  const hudLatency = document.getElementById("hud-latency");
  const hudModels = document.getElementById("hud-models");
  if (!hudMemory) return;

  const t0 = performance.now();
  try {
    const res = await fetch("/api/health");
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      hudMemory.textContent = `${data.memoryUsageMB || 12} MB`;
      if (hudLatency) hudLatency.textContent = `${latency}ms`;
      if (hudModels && data.modelsCatalogTotal) {
        hudModels.textContent = `${data.modelsCatalogTotal}+ QUANTUM AGENTS`;
      }
    }
  } catch (_) {
    if (hudLatency) hudLatency.textContent = "Offline";
  }
}

setInterval(updateHiltronTelemetry, 12000);
setTimeout(updateHiltronTelemetry, 1000);

