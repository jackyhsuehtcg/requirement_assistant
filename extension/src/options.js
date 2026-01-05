const DEFAULT_API_BASE_URL = "http://10.80.1.49:8787";
const STORAGE_KEY = "jraApiBaseUrl";
const HEALTH_PATH = "/health";

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function getInputBaseUrl() {
  const input = document.getElementById("api-base-url");
  const rawValue = input.value.trim();
  return normalizeBaseUrl(rawValue || DEFAULT_API_BASE_URL);
}

function setSaveStatus(message, keepVisible = false) {
  const status = document.getElementById("save-status");
  status.textContent = message;
  if (!message || keepVisible) return;
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}

function setTestOutput(message, type, details) {
  const output = document.getElementById("test-output");
  const status = document.getElementById("test-status");
  const detailsEl = document.getElementById("test-details");

  output.hidden = false;
  status.textContent = message;
  status.className = `test-status ${type}`;

  if (details) {
    detailsEl.hidden = false;
    detailsEl.textContent = details;
  } else {
    detailsEl.hidden = true;
    detailsEl.textContent = "";
  }
}

function loadOptions() {
  const input = document.getElementById("api-base-url");

  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_API_BASE_URL }, (result) => {
    if (chrome.runtime?.lastError) {
      setSaveStatus("Failed to load settings.", true);
      return;
    }
    input.value = result[STORAGE_KEY] || DEFAULT_API_BASE_URL;
  });
}

function saveOptions(event) {
  event.preventDefault();
  const input = document.getElementById("api-base-url");
  const normalized = getInputBaseUrl();

  chrome.storage.sync.set({ [STORAGE_KEY]: normalized }, () => {
    if (chrome.runtime?.lastError) {
      setSaveStatus("Failed to save.", true);
      return;
    }
    input.value = normalized;
    setSaveStatus("Saved.");
  });
}

async function testConnection() {
  const baseUrl = getInputBaseUrl();
  const testUrl = `${baseUrl}${HEALTH_PATH}`;
  setTestOutput("Testing connection...", "info", `Requesting ${testUrl}`);

  let response;
  try {
    response = await fetch(testUrl, { method: "GET" });
  } catch (error) {
    const reason = error?.message || String(error);
    setTestOutput("Connection failed.", "error", `Network error: ${reason}`);
    return;
  }

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch (error) {
    bodyText = "";
  }

  if (!response.ok) {
    const details = [`HTTP ${response.status} ${response.statusText}`];
    if (bodyText) {
      details.push("Response:", bodyText);
    }
    setTestOutput("Connection failed.", "error", details.join("\n"));
    return;
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;
  if (bodyText) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(bodyText);
      } catch (error) {
        setTestOutput(
          "Connection failed.",
          "error",
          `Invalid JSON: ${error.message}\nResponse:\n${bodyText}`
        );
        return;
      }
    } else {
      setTestOutput(
        "Connection failed.",
        "error",
        `Unexpected response format: ${contentType || "unknown"}\nResponse:\n${bodyText}`
      );
      return;
    }
  }

  if (!data || data.status !== "ok") {
    const statusValue = data?.status || "missing";
    const details = [`Health status: ${statusValue}`];
    if (bodyText) {
      details.push("Response:", bodyText);
    }
    setTestOutput("Connection failed.", "error", details.join("\n"));
    return;
  }

  const details = bodyText ? `Response:\n${bodyText}` : `Endpoint: ${testUrl}`;
  setTestOutput("Connection successful.", "success", details);
}

document.addEventListener("DOMContentLoaded", () => {
  loadOptions();
  document
    .getElementById("settings-form")
    .addEventListener("submit", saveOptions);
  document
    .getElementById("test-connection")
    .addEventListener("click", testConnection);
});
