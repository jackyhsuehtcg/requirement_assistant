const DEFAULT_API_BASE_URL = "http://10.80.1.49:8000";
const STORAGE_KEY = "jraApiBaseUrl";

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function loadOptions() {
  const input = document.getElementById("api-base-url");
  const status = document.getElementById("status");

  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_API_BASE_URL }, (result) => {
    if (chrome.runtime?.lastError) {
      status.textContent = "Failed to load settings.";
      return;
    }
    input.value = result[STORAGE_KEY] || DEFAULT_API_BASE_URL;
  });
}

function saveOptions(event) {
  event.preventDefault();
  const input = document.getElementById("api-base-url");
  const status = document.getElementById("status");

  const rawValue = input.value.trim();
  const normalized = normalizeBaseUrl(rawValue || DEFAULT_API_BASE_URL);

  chrome.storage.sync.set({ [STORAGE_KEY]: normalized }, () => {
    if (chrome.runtime?.lastError) {
      status.textContent = "Failed to save.";
      return;
    }
    input.value = normalized;
    status.textContent = "Saved.";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadOptions();
  document
    .getElementById("settings-form")
    .addEventListener("submit", saveOptions);
});
