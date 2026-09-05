const API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const MAX_INPUT_LENGTH = 2000;
const CONVERSATION_KEY = "open-ai-chat-conversation";
const SYSTEM_PROMPT_KEY = "open-ai-chat-system-prompt";
const API_KEY_KEY = "open-ai-chat-api-key";

function safeParseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function loadConversation() {
  const stored = safeParseJson(localStorage.getItem(CONVERSATION_KEY), []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim());
}

function saveConversation(history) {
  try { localStorage.setItem(CONVERSATION_KEY, JSON.stringify(history)); } catch { setStatus("error", "Storage unavailable"); }
}

function sanitizeHistory(history) {
  return history.filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim()).map((message) => ({ role: message.role, content: message.content }));
}

function parseSseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("event:")) return null;
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return { done: true };
  const parsed = safeParseJson(data);
  if (!parsed) return { invalid: true };
  if (parsed.error) {
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error.message || JSON.stringify(parsed.error);
    return { error: message };
  }
  const content = parsed.choices?.[0]?.delta?.content;
  return typeof content === "string" ? { content } : null;
}

function parseErrorMessage(statusCode, body) {
  const parsed = safeParseJson(body);
  let message = body;
  if (typeof parsed === "string") message = parsed;
  else if (parsed?.error) message = typeof parsed.error === "string" ? parsed.error : parsed.error.message || JSON.stringify(parsed.error);
  else if (parsed?.message) message = parsed.message;
  message = String(message || "Unknown API error.").trim();
  if (statusCode === 401) return `Authentication failed. Check your Pollinations API key.\n\n${message}`;
  if (statusCode === 402) return `Pollinations rejected the request because payment or available Pollen is required.\n\n${message}`;
  if (statusCode === 403) return `The API key is not permitted to make this request.\n\n${message}`;
  if (statusCode === 429) return `Rate limit reached. Please wait and try again.\n\n${message}`;
  return `HTTP ${statusCode}: ${message}`;
}

function setStatus(type, text) {
  if (!status) return;
  status.classList.remove("connected", "error");
  if (type) status.classList.add(type);
  statusText.textContent = text;
}

function logDebug(text) {
  const line = String(text);
  debugEl.textContent = debugEl.textContent === "Ready." ? line : `${debugEl.textContent}\n\n${line}`;
  debugEl.parentElement.scrollTop = debugEl.parentElement.scrollHeight;
}

function scrollChat() { chat.scrollTop = chat.scrollHeight; }

function appendMessage(role, text, scroll = true) {
  welcome.hidden = true;
  const message = document.createElement("div");
  message.className = role === "error" ? "message error" : `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : role === "assistant" ? "AI" : "!";
  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text;
  message.append(label, content);
  chat.insertBefore(message, typing);
  if (scroll) scrollChat();
  return message;
}

function updateAssistantMessage(element, text) {
  const content = element.querySelector(".message-content");
  if (content) content.textContent = text;
  scrollChat();
}

function updateComposerState() {
  const length = input.value.length;
  charCounter.textContent = `${length} / ${MAX_INPUT_LENGTH}`;
  sendBtn.hidden = requestInProgress;
  stopBtn.hidden = !requestInProgress;
  sendBtn.disabled = requestInProgress || !input.value.trim() || length > MAX_INPUT_LENGTH || !apiKeyInput.value.trim();
  clearBtn.disabled = requestInProgress;
}

function persistSettings() {
  try {
    localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt.value);
    sessionStorage.setItem(API_KEY_KEY, apiKeyInput.value);
  } catch { setStatus("error", "Storage unavailable"); }
}

function restoreSettings() {
  try {
    systemPrompt.value = localStorage.getItem(SYSTEM_PROMPT_KEY) || "";
    apiKeyInput.value = sessionStorage.getItem(API_KEY_KEY) || "";
  } catch { setStatus("error", "Storage unavailable"); }
}

function renderHistory() {
  chat.querySelectorAll(".message").forEach((message) => message.remove());
  if (!conversationHistory.length) { welcome.hidden = false; return; }
  welcome.hidden = true;
  conversationHistory.forEach((message) => appendMessage(message.role, message.content, false));
  scrollChat();
}

function clearConversation() {
  if (requestInProgress) return;
  conversationHistory = [];
  saveConversation(conversationHistory);
  renderHistory();
  logDebug("Conversation cleared.");
  input.focus();
}

function resetConversation() {
  if (requestInProgress) return;
  if (conversationHistory.length && !window.confirm("Start a new conversation and clear the current chat?")) return;
  clearConversation();
}

async function readErrorResponse(response) {
  try { return await response.text(); } catch { return ""; }
}

async function sendToAI(message) {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || "openai";
  const systemValue = systemPrompt.value.trim();
  if (!apiKey) {
    appendMessage("error", "Enter your Pollinations API key before sending a message.");
    settings.classList.add("open");
    input.focus();
    return;
  }
  if (!message || message.length > MAX_INPUT_LENGTH) return;
  const userMessage = { role: "user", content: message };
  conversationHistory.push(userMessage);
  saveConversation(conversationHistory);
  appendMessage("user", message);
  requestInProgress = true;
  activeController = new AbortController();
  updateComposerState();
  input.disabled = true;
  typing.classList.add("visible");
  setStatus("", "Connecting");
  const messages = [];
  if (systemValue) messages.push({ role: "system", content: systemValue });
  messages.push(...sanitizeHistory(conversationHistory));
  try {
    logDebug(`POST ${API_URL}`);
    logDebug(`Model: ${model}`);
    logDebug(`Messages: ${messages.length}`);
    const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, stream: true }), signal: activeController.signal });
    if (!response.ok) {
      const errorMessage = parseErrorMessage(response.status, await readErrorResponse(response));
      logDebug(`API error: ${response.status}`);
      appendMessage("error", errorMessage);
      conversationHistory.pop();
      saveConversation(conversationHistory);
      setStatus("error", `HTTP ${response.status}`);
      return;
    }
    if (!response.body) throw new Error("The API returned no response body.");
    setStatus("connected", "Connected");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let accumulatedText = "";
    let assistantMessage = null;
    let streamFinished = false;
    while (!streamFinished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const result = parseSseLine(line);
        if (!result) continue;
        if (result.invalid) { logDebug("Ignored malformed stream event."); continue; }
        if (result.error) throw new Error(result.error);
        if (result.done) { streamFinished = true; break; }
        if (result.content) {
          if (!assistantMessage) { typing.classList.remove("visible"); assistantMessage = appendMessage("assistant", ""); }
          accumulatedText += result.content;
          updateAssistantMessage(assistantMessage, accumulatedText);
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim() && !streamFinished) {
      const result = parseSseLine(buffer);
      if (result?.content) {
        if (!assistantMessage) assistantMessage = appendMessage("assistant", "");
        accumulatedText += result.content;
        updateAssistantMessage(assistantMessage, accumulatedText);
      } else if (result?.invalid) logDebug("Ignored malformed final stream event.");
    }
    if (!accumulatedText) {
      appendMessage("error", "The API returned an empty response.");
      conversationHistory.pop();
      saveConversation(conversationHistory);
    } else {
      conversationHistory.push({ role: "assistant", content: accumulatedText });
      saveConversation(conversationHistory);
      logDebug("Response completed.");
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      logDebug("Response stopped.");
      if (conversationHistory.at(-1)?.role === "user") conversationHistory.pop();
      saveConversation(conversationHistory);
      setStatus("", "Stopped");
      if (assistantMessage) {
        const content = assistantMessage.querySelector(".message-content");
        if (content && accumulatedText) content.textContent = `${accumulatedText}\n\n[Stopped]`;
      } else appendMessage("error", "Response stopped.");
    } else {
      const messageText = error instanceof Error ? error.message : String(error);
      logDebug(`Request failed: ${messageText}`);
      appendMessage("error", `Request failed: ${messageText}`);
      if (conversationHistory.at(-1)?.role === "user") conversationHistory.pop();
      saveConversation(conversationHistory);
      setStatus("error", "Request failed");
    }
  } finally {
    requestInProgress = false;
    activeController = null;
    input.disabled = false;
    typing.classList.remove("visible");
    updateComposerState();
    input.focus();
  }
}

function stopResponse() { if (activeController) activeController.abort(); }

function validateMessage(value) {
  const message = value.trim();
  if (!message) return { valid: false, message: "Message cannot be empty." };
  if (message.length > MAX_INPUT_LENGTH) return { valid: false, message: `Message must be ${MAX_INPUT_LENGTH} characters or fewer.` };
  return { valid: true, message };
}

const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const apiKeyInput = document.getElementById("api-key");
const modelInput = document.getElementById("model");
const systemPrompt = document.getElementById("system-prompt");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const clearBtn = document.getElementById("clear-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const charCounter = document.getElementById("char-counter");
const typing = document.getElementById("typing");
const welcome = document.getElementById("welcome");
const settings = document.getElementById("settings");
const settingsToggle = document.getElementById("settings-toggle");
const debugContainer = document.getElementById("debug-container");
const debugToggle = document.getElementById("debug-toggle");
const debugArrow = document.getElementById("debug-arrow");
const debugEl = document.getElementById("debug");
const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
let conversationHistory = loadConversation();
let requestInProgress = false;
let activeController = null;

window.__openAIChat = { parseSseLine, parseErrorMessage, sanitizeHistory, validateMessage };

settingsToggle.addEventListener("click", () => {
  const open = settings.classList.toggle("open");
  settingsToggle.setAttribute("aria-expanded", String(open));
});

debugToggle.addEventListener("click", () => {
  const open = debugContainer.classList.toggle("open");
  debugToggle.setAttribute("aria-expanded", String(open));
  debugArrow.textContent = open ? "▲" : "▼";
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  updateComposerState();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
});

apiKeyInput.addEventListener("input", () => { persistSettings(); setStatus("", apiKeyInput.value.trim() ? "Ready" : "Not connected"); updateComposerState(); });
systemPrompt.addEventListener("input", persistSettings);
modelInput.addEventListener("input", updateComposerState);
clearBtn.addEventListener("click", clearConversation);
newChatBtn.addEventListener("click", resetConversation);
stopBtn.addEventListener("click", stopResponse);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (requestInProgress) return;
  const validation = validateMessage(input.value);
  if (!validation.valid) { appendMessage("error", validation.message); updateComposerState(); return; }
  input.value = "";
  input.style.height = "auto";
  updateComposerState();
  await sendToAI(validation.message);
});

restoreSettings();
renderHistory();
updateComposerState();
setStatus("", apiKeyInput.value.trim() ? "Ready" : "Not connected");
input.focus();
