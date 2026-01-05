// JIRA Requirement Assistant - Content Script (Manual Mode)

const DEFAULT_API_BASE_URL = "http://10.80.1.49:8000";
const STORAGE_KEY = "jraApiBaseUrl";
let isFabInjected = false;
let modalOverlay = null;
let lastReferences = [];

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function getApiBaseUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_API_BASE_URL }, (result) => {
      if (chrome.runtime?.lastError) {
        resolve(DEFAULT_API_BASE_URL);
        return;
      }
      resolve(result[STORAGE_KEY] || DEFAULT_API_BASE_URL);
    });
  });
}

async function getApiUrl() {
  const baseUrl = await getApiBaseUrl();
  return `${normalizeBaseUrl(baseUrl)}/api/v1/refine`;
}

// Initialization
function init() {
  console.log("JRA: Extension loaded (Manual Mode).");
  const observer = new MutationObserver(() => checkForDescriptionModule());
  observer.observe(document.body, { childList: true, subtree: true });
  checkForDescriptionModule();
}

function checkForDescriptionModule() {
  const descModule = document.getElementById('descriptionmodule');
  if (descModule && !isFabInjected) {
    injectFloatingButton();
    isFabInjected = true;
  }
}

function injectFloatingButton() {
  if (document.querySelector('.jra-fab')) return;
  const fab = document.createElement('button');
  fab.className = 'jra-fab';
  fab.innerHTML = '✨';
  fab.title = "Open AI Assistant";
  fab.addEventListener('click', (e) => {
    e.preventDefault();
    handleFabClick();
  });
  document.body.appendChild(fab);
}

// --- Main Logic ---

function handleFabClick() {
  // 1. Scrape Content
  const descVal = document.getElementById('description-val');
  let currentText = "";

  if (descVal) {
      // Try to get structured content block first
      const contentBlock = descVal.querySelector('.user-content-block');
      if (contentBlock) {
          // Attempt to restore Wiki Markup from HTML
          currentText = htmlToWiki(contentBlock);
      } else {
          // Fallback to raw text
          currentText = descVal.innerText;
      }
  }

  // Handle placeholders
  if (!currentText || currentText.trim() === "Click to add description") {
      const editor = document.getElementById('description');
      if (editor && editor.value) currentText = editor.value;
      else currentText = ""; 
  }

  // 2. Open Modal immediately
  showModal(currentText);
}

// ... existing code ...

// --- Utility: HTML to Wiki Markup Converter ---

function htmlToWiki(root) {
  if (!root) return "";
  
  function detectBlockMacro(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
      const macroName = (node.getAttribute && node.getAttribute('data-macro-name')) || "";
      if (macroName) {
          const normalized = macroName.trim().toLowerCase();
          if (["note", "info", "warning", "tip", "quote"].includes(normalized)) {
              return normalized;
          }
      }
      const className = (node.className || "").toString().toLowerCase();
      if (className.includes("confluence-information-macro-note") || className.includes("aui-message") || className.includes("note")) {
          return "note";
      }
      if (className.includes("warning")) return "warning";
      if (className.includes("tip")) return "tip";
      if (className.includes("info") || className.includes("information")) return "info";
      return null;
  }

  function normalizeTableCell(text) {
      return text.replace(/\s*\n\s*/g, " ").trim();
  }

  function tableToWiki(tableNode) {
      if (!tableNode) return "";
      let rows = Array.from(tableNode.querySelectorAll("tr"));
      if (!rows.length) {
          rows = Array.from(tableNode.querySelectorAll(".confluenceTr"));
      }
      if (!rows.length && tableNode.classList && tableNode.classList.contains("confluenceTable")) {
          rows = Array.from(tableNode.children).filter(child => {
              const tag = child.tagName ? child.tagName.toLowerCase() : "";
              return tag === "tr" || (child.classList && child.classList.contains("confluenceTr"));
          });
      }
      if (!rows.length) return "";

      let wiki = "";
      rows.forEach(row => {
          let cellElements = Array.from(row.children).filter(el => {
              const tag = el.tagName ? el.tagName.toLowerCase() : "";
              if (tag === "th" || tag === "td") return true;
              if (el.classList && (el.classList.contains("confluenceTh") || el.classList.contains("confluenceTd"))) return true;
              return false;
          });
          if (!cellElements.length) {
              cellElements = Array.from(row.querySelectorAll("th, td, .confluenceTh, .confluenceTd"));
          }
          if (!cellElements.length) return;

          const isHeader = cellElements.some(el => {
              const tag = el.tagName ? el.tagName.toLowerCase() : "";
              if (tag === "th") return true;
              if (el.classList && el.classList.contains("confluenceTh")) return true;
              return false;
          })
              || (row.parentElement && row.parentElement.tagName && row.parentElement.tagName.toLowerCase() === "thead");

          const cells = cellElements.map(cell => {
              let cellText = "";
              cell.childNodes.forEach(child => {
                  cellText += traverse(child);
              });
              return normalizeTableCell(cellText);
          });

          const delimiter = isHeader ? "||" : "|";
          wiki += `${delimiter}${cells.join(delimiter)}${delimiter}\n`;
      });

      return wiki;
  }

  function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();
      let content = "";
      
      // Recursively process children
      node.childNodes.forEach(child => {
          content += traverse(child);
      });

      const macro = detectBlockMacro(node);
      if (macro) {
          const trimmed = content.trim();
          if (!trimmed) return "";
          return `{${macro}}\n${trimmed}\n{${macro}}\n`;
      }

      if (node.classList && node.classList.contains("confluenceTable")) {
          const tableText = tableToWiki(node);
          if (tableText) return `\n${tableText}\n`;
      }

      // Map HTML tags to JIRA Wiki Markup
      switch (tag) {
          case 'h1': return `h1. ${content}\n`;
          case 'h2': return `h2. ${content}\n`;
          case 'h3': return `h3. ${content}\n`;
          case 'h4': return `h4. ${content}\n`;
          case 'h5': return `h5. ${content}\n`;
          case 'h6': return `h6. ${content}\n`;
          
          case 'b':
          case 'strong': return `*${content}*`;
          
          case 'i':
          case 'em': return `_${content}_`;
          
          case 'u': return `+${content}+`;
          case 's':
          case 'del': return `-${content}-`;
          
          case 'br': return '\n';
          case 'p': return `${content}\n\n`;
          case 'div': return `${content}\n`; // divs often act as line breaks
          
          case 'ul': return `${content}\n`;
          case 'ol': return `${content}\n`;
          case 'li':
              // Determine depth or type? For simplicity, assume bullet *
              // Ideally check parent for ol/ul, but * works for most JIRA lists
              return `* ${content.trim()}\n`; 
              
          case 'pre':
          case 'code': return `{code}${content}{code}`;
          case 'blockquote': return `{quote}\n${content.trim()}\n{quote}\n`;
          case 'cite': return `??${content}??`;
          case 'table': return `\n${tableToWiki(node)}\n`;
          
          case 'a':
               // Try to preserve links: [Text|URL]
               if (node.href && content) return `[${content}|${node.href}]`;
               if (node.href) return `[${node.href}|${node.href}]`;
               return content;

          default: return content;
      }
  }

  // Post-processing to clean up excessive newlines and indentation
  let wikiText = traverse(root);
  
  // 1. Remove excessive newlines
  wikiText = wikiText.replace(/\n{3,}/g, '\n\n');
  
  // 2. Remove leading whitespace from each line (Fix for HTML source indentation)
  // This ensures "* Item" starts at the beginning of the line, not "       * Item"
  wikiText = wikiText.split('\n').map(line => line.trimStart()).join('\n');
  
  return wikiText.trim();
}

// ... existing simpleWikiParser ...

function showModal(initialText) {
  if (modalOverlay) modalOverlay.remove();

  modalOverlay = document.createElement('div');
  modalOverlay.className = 'jra-modal-overlay';
  
  // Skeleton Layout
  const modalHTML = `
    <div class="jra-modal">
      <div class="jra-modal-header">
        <span class="jra-modal-title">AI Requirement Assistant</span>
        <button class="jra-close-btn">&times;</button>
      </div>
      <div class="jra-modal-body">
        
        <!-- Col 1: Input -->
        <div class="jra-col-input">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <label style="font-weight:600;">Original Draft (Editable)</label>
              <div class="jra-tabs">
                 <button class="jra-tab-btn active" data-target="input" data-mode="text">Text</button>
                 <button class="jra-tab-btn" data-target="input" data-mode="visual">Visual</button>
              </div>
           </div>
          
          <textarea class="jra-textarea" id="jra-input-text">${escapeHtml(initialText)}</textarea>
          <div class="jra-visual-view" id="jra-input-visual" style="display:none;"></div>
          
          <div style="margin-top: 10px; display:flex; align-items:center; gap:8px;">
             <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#42526e;">
                <input type="checkbox" id="jra-restrict-team" checked />
                只搜尋同團隊 reference
             </label>
          </div>

          <div class="jra-input-options">
             <label class="jra-input-label" for="jra-output-language">輸出語言</label>
             <select id="jra-output-language" class="jra-select">
                <option value="zh-TW" selected>繁體中文</option>
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
             </select>
          </div>

          <div style="margin-top: 15px;">
             <button class="jra-btn jra-btn-primary" id="jra-submit-ai" style="width: 100%;">
                <span>Submit to AI</span>
             </button>
          </div>
        </div>

        <!-- Col 2: Output -->
        <div class="jra-col-output">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <label style="font-weight:600;">AI Suggestion</label>
              <div class="jra-tabs">
                 <button class="jra-tab-btn active" data-target="output" data-mode="text">Text</button>
                 <button class="jra-tab-btn" data-target="output" data-mode="visual">Visual</button>
              </div>
           </div>
           
           <div id="jra-output-container" style="flex:1; display:flex; flex-direction:column; position:relative; min-height:0; overflow:hidden;">
              <div id="jra-output-placeholder" style="margin:auto; color:#999; text-align:center;">
                 Click "Submit to AI" to generate suggestions.
              </div>
              <textarea class="jra-textarea" id="jra-output-text" style="display:none;"></textarea>
              <div class="jra-visual-view" id="jra-output-visual" style="display:none;"></div>
              <div id="jra-loading" style="display:none; position:absolute; inset:0; background:rgba(255,255,255,0.8); align-items:center; justify-content:center;">
                 <div class="jra-spinner"></div>
              </div>
           </div>
        </div>

        <!-- Col 3: Refs -->
        <div class="jra-col-ref">
           <div class="jra-ref-top">
              <label class="jra-ref-label">References</label>
              <button class="jra-btn jra-btn-secondary" id="jra-resuggest" type="button" disabled>
                 重新建議
              </button>
           </div>
           <div id="jra-ref-list">
              <p style="color:#999">References will appear here after AI processing.</p>
           </div>
        </div>

      </div>
      
      <div class="jra-modal-footer">
        <button class="jra-btn jra-btn-secondary" id="jra-close">Close</button>
        <button class="jra-btn jra-btn-primary" id="jra-copy">Copy Result</button>
      </div>
    </div>
  `;
  
  modalOverlay.innerHTML = modalHTML;
  document.body.appendChild(modalOverlay);

  // Bind Events
  const inputTextarea = document.getElementById('jra-input-text');
  inputTextarea.value = initialText; 
  
  // Init Left Visual View
  document.getElementById('jra-input-visual').innerHTML = simpleWikiParser(initialText);
  
  // Real-time Visual Update
  inputTextarea.addEventListener('input', () => {
      document.getElementById('jra-input-visual').innerHTML = simpleWikiParser(inputTextarea.value);
  });

  modalOverlay.querySelector('.jra-close-btn').addEventListener('click', closeModal);
  document.getElementById('jra-close').addEventListener('click', closeModal);
  document.getElementById('jra-submit-ai').addEventListener('click', submitToAI);
  document.getElementById('jra-resuggest').addEventListener('click', handleResuggest);
  document.getElementById('jra-copy').addEventListener('click', copyResult);
  document.getElementById('jra-ref-list').addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('.jra-ref-toggle');
    if (!toggleBtn) return;
    const item = toggleBtn.closest('.jra-ref-item');
    const content = item?.querySelector('.jra-ref-content');
    if (!content) return;
    const isCollapsed = content.classList.contains('collapsed');
    content.classList.toggle('collapsed');
    toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', isCollapsed ? '收起內容' : '展開內容');
    toggleBtn.setAttribute('title', isCollapsed ? '收起' : '展開');
  });

  // Tab Switching (Generic)
  const tabs = modalOverlay.querySelectorAll('.jra-tab-btn');
  tabs.forEach(tab => {
     tab.addEventListener('click', () => {
        const target = tab.dataset.target; // 'input' or 'output'
        // Deactivate siblings
        tab.parentElement.querySelectorAll('.jra-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        toggleViewMode(target, tab.dataset.mode);
     });
  });
}

function closeModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
}

// --- Logic: Submit to AI ---

let cooldownTimer = null;
let cooldownRemaining = 0;

function getComponentName() {
  const selectors = [
    '#components-val',
    '[data-field-id="components"] .value',
    '[data-field-id="components"]',
    '#components-field'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.innerText?.trim();
    if (text) {
      return text.split(/\s*,\s*|\n/)[0].trim();
    }
  }
  return "";
}

function deriveComponentTeam(componentName) {
  if (!componentName) return "";
  const cleaned = componentName.trim();
  if (!cleaned) return "";
  const lettersOnly = cleaned.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length >= 3) {
    return lettersOnly.slice(0, 3).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase();
}

function getSelectedReferences() {
  const checks = document.querySelectorAll('.jra-ref-check');
  return Array.from(checks)
    .filter(check => check.checked)
    .map(check => lastReferences[Number(check.dataset.refIndex)])
    .filter(Boolean);
}

async function handleResuggest() {
  if (!lastReferences.length) {
    alert("尚未取得 references，請先送出一次建議。");
    return;
  }
  const selected = getSelectedReferences();
  if (selected.length === 0) {
    alert("請先勾選至少一筆 reference。");
    return;
  }
  await submitToAI({ selectedReferences: selected });
}

async function submitToAI(options = {}) {
  const inputBtn = document.getElementById('jra-submit-ai');
  const resuggestBtn = document.getElementById('jra-resuggest');
  const inputText = document.getElementById('jra-input-text').value;
  const selectedReferences = options.selectedReferences || null;

  if (!inputText.trim()) {
      alert("Please enter some text first.");
      return;
  }

  // UI Loading State
  inputBtn.disabled = true;
  if (resuggestBtn) resuggestBtn.disabled = true;
  document.getElementById('jra-output-placeholder').style.display = 'none';
  document.getElementById('jra-loading').style.display = 'flex';
  document.getElementById('jra-output-text').style.display = 'none';
  document.getElementById('jra-output-visual').style.display = 'none';

  // Get Context
  const summary = document.querySelector('#summary-val')?.innerText || "Unknown Issue";
  const issueType = document.querySelector('#type-val')?.innerText || "Story";
  const componentName = getComponentName();
  const componentTeam = deriveComponentTeam(componentName);
  const restrictToTeam = document.getElementById('jra-restrict-team')?.checked ?? true;
  const outputLanguage = document.getElementById('jra-output-language')?.value || "zh-TW";

  try {
    const payload = {
      current_description: inputText,
      summary: summary,
      issue_type: issueType,
      component_name: componentName,
      component_team: componentTeam,
      restrict_to_team: restrictToTeam,
      output_language: outputLanguage
    };
    if (selectedReferences) {
      payload.selected_references = selectedReferences;
    }

    const apiUrl = await getApiUrl();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("API Request failed");

    const data = await response.json();
    
    // Success: Render
    renderOutput(data.refined_content);
    renderReferences(data.references);
    
    // Start Cooldown
    startCooldown(inputBtn);
    if (resuggestBtn) resuggestBtn.disabled = false;

  } catch (error) {
    console.error(error);
    alert("Error: " + error.message);
    inputBtn.disabled = false; // Re-enable on error
    if (resuggestBtn) resuggestBtn.disabled = false;
  } finally {
    document.getElementById('jra-loading').style.display = 'none';
  }
}

function startCooldown(btn) {
  cooldownRemaining = 30;
  btn.disabled = true;
  btn.innerHTML = `<span>Wait ${cooldownRemaining}s</span>`;

  if (cooldownTimer) clearInterval(cooldownTimer);
  
  cooldownTimer = setInterval(() => {
    cooldownRemaining--;
    if (cooldownRemaining <= 0) {
      clearInterval(cooldownTimer);
      btn.disabled = false;
      btn.innerHTML = `<span>Submit to AI</span>`;
    } else {
      btn.innerHTML = `<span>Wait ${cooldownRemaining}s</span>`;
    }
  }, 1000);
}

// --- Logic: Rendering ---

function renderOutput(text) {
  const textarea = document.getElementById('jra-output-text');
  const visualDiv = document.getElementById('jra-output-visual');
  
  textarea.value = text;
  visualDiv.innerHTML = simpleWikiParser(text);
  
  // Default to Text mode for Output
  const activeTab = document.querySelector('.jra-tab-btn[data-target="output"].active');
  const mode = activeTab ? activeTab.dataset.mode : 'text';
  toggleViewMode('output', mode);
}

function renderReferences(refs) {
  const container = document.getElementById('jra-ref-list');
  const resuggestBtn = document.getElementById('jra-resuggest');
  lastReferences = refs || [];
  if (!refs || refs.length === 0) {
      container.innerHTML = '<p style="color:#999">No specific references found.</p>';
      if (resuggestBtn) resuggestBtn.disabled = true;
      return;
  }

  if (resuggestBtn) resuggestBtn.disabled = false;

  container.innerHTML = refs.map((ref, index) => `
    <div class="jra-ref-item">
      <div class="jra-ref-header">
        <label class="jra-ref-check-wrap">
          <input
            class="jra-ref-check"
            type="checkbox"
            data-ref-index="${index}"
            checked
            aria-label="使用此 reference"
          />
        </label>
        <strong class="jra-ref-title">[${ref.source_type.toUpperCase()}] ${escapeHtml(ref.title)}</strong>
        <button class="jra-ref-toggle" type="button" aria-expanded="false" aria-label="展開內容" title="展開">
          <svg class="jra-ref-toggle-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M4 2 L8 6 L4 10 Z"></path>
          </svg>
        </button>
      </div>
      <p class="jra-ref-content collapsed">
        ${escapeHtml(ref.content_excerpt)}
      </p>
    </div>
  `).join('');
}

function toggleViewMode(target, mode) {
  const textarea = document.getElementById(`jra-${target}-text`);
  const visualDiv = document.getElementById(`jra-${target}-visual`);
  const placeholder = document.getElementById('jra-output-placeholder');

  // Special handling for output placeholder
  if (target === 'output') {
      if (!textarea.value) {
          if (placeholder) placeholder.style.display = 'block';
          textarea.style.display = 'none';
          visualDiv.style.display = 'none';
          return;
      }
      if (placeholder) placeholder.style.display = 'none';
  }

  if (mode === 'text') {
      textarea.style.display = 'block';
      visualDiv.style.display = 'none';
  } else {
      textarea.style.display = 'none';
      visualDiv.style.display = 'block';
  }
}

function copyResult() {
  const text = document.getElementById('jra-output-text').value;
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
     showToast("Copied to clipboard!");
  }).catch(() => {
     document.getElementById('jra-output-text').select();
     document.execCommand('copy');
     showToast("Copied!");
  });
}

// --- Utility: Wiki Parser & Helpers ---

function escapeHtml(text) {
  if (!text) return "";
  return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'jra-toast show';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Basic JIRA Wiki Markup to HTML converter for Visual Preview
function simpleWikiParser(wikiText) {
  if (!wikiText) return "";
  let lines = wikiText.split('\n');
  let html = "";
  let listStack = [];
  let tableOpen = false;
  const closeLists = (targetDepth = 0) => {
    while (listStack.length > targetDepth) {
      html += `</${listStack.pop()}>`;
    }
  };
  const closeTable = () => {
    if (tableOpen) {
      html += "</table>";
      tableOpen = false;
    }
  };
  const buildTableRow = (line) => {
    const isHeader = line.startsWith("||");
    const delimiter = isHeader ? "||" : "|";
    let cells = line.split(delimiter);
    if (cells.length <= 1) return "";
    cells = cells.slice(1);
    if (line.endsWith(delimiter)) cells.pop();
    const tag = isHeader ? "th" : "td";
    return `<tr>${cells.map(cell => `<${tag}>${parseInline(cell.trim())}</${tag}>`).join("")}</tr>`;
  };

  lines.forEach(line => {
      line = escapeHtml(line);
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("||") || trimmedLine.startsWith("|")) {
          closeLists();
          if (!tableOpen) {
              html += '<table class="jra-table">';
              tableOpen = true;
          }
          const rowHtml = buildTableRow(trimmedLine);
          if (rowHtml) html += rowHtml;
          return;
      } else {
          closeTable();
      }

      // Headers (h1. Title -> <h1>Title</h1>)
      if (line.match(/^h[1-6]\./)) {
          closeLists();
          const level = line.charAt(1);
          const content = line.substring(3).trim();
          html += `<h${level}>${parseInline(content)}</h${level}>`;
      } 
      // Horizontal Rule (---- -> <hr>)
      else if (line.match(/^----/)) {
          closeLists();
          html += `<hr>`;
      }
      // Normal Text
      else {
          const listMatch = line.match(/^(\s*[*#]+)\s+(.*)$/);
          if (listMatch) {
              const marker = listMatch[1].replace(/\s/g, '');
              const depth = marker.length;
              const type = marker[marker.length - 1] === '*' ? 'ul' : 'ol';

              if (listStack.length >= depth && listStack[depth - 1] !== type) {
                  closeLists(depth - 1);
              }
              while (listStack.length < depth) {
                  html += `<${type}>`;
                  listStack.push(type);
              }
              closeLists(depth);

              if (listStack[depth - 1] !== type) {
                  closeLists(depth - 1);
                  while (listStack.length < depth) {
                      html += `<${type}>`;
                      listStack.push(type);
                  }
              }

              const content = listMatch[2].trim();
              html += `<li>${parseInline(content)}</li>`;
          } else {
              closeLists();
              if (line.trim() === "") html += "<br>";
              else html += `<p>${parseInline(line)}</p>`;
          }
      }
  });
  closeLists();
  closeTable();
  return html;
}

function parseInline(text) {
  // Color ({color:#ff0000}text{color})
  text = text.replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/g, '<span style="color:$1">$2</span>');
  // Monospace ({{text}})
  text = text.replace(/\{\{([\s\S]+?)\}\}/g, '<code>$1</code>');
  // Citation (??text??)
  text = text.replace(/\?\?([\s\S]+?)\?\?/g, '<cite>$1</cite>');
  // Superscript (^text^)
  text = text.replace(/\^([^^\n]+)\^/g, '<sup>$1</sup>');
  // Subscript (~text~)
  text = text.replace(/~([^~\n]+)~/g, '<sub>$1</sub>');
  // Bold (*text*)
  text = text.replace(/\*([^*]+)\*/g, '<b>$1</b>');
  // Italic (_text_)
  text = text.replace(/_([^_\n]+)_/g, '<i>$1</i>');
  // Underline (+text+)
  text = text.replace(/\+([^+\n]+)\+/g, '<u>$1</u>');
  // Strikethrough (-text-)
  text = text.replace(/-([^\n-]+)-/g, '<del>$1</del>');
  return text;
}

init();
