// JIRA Requirement Assistant - Content Script (Manual Mode)

const DEFAULT_API_BASE_URL = "http://10.80.1.49:8787";
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

let cachedState = null;

function handleFabClick() {
  const currentUrl = window.location.href;

  // 1. Check Cache
  if (cachedState && cachedState.url === currentUrl) {
    console.log("JRA: Restoring from cache");
    showModal(null, null, cachedState);
    return;
  }

  // 2. Scrape Content (fresh)
  cachedState = null; // Clear old cache if URL changed

  const summaryVal = document.getElementById('summary-val')?.innerText || "";
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

  // 3. Open Modal fresh
  showModal(currentText, summaryVal, null);
}

// --- UI Components ---

function showModal(initialText, initialSummary = "", restoredState = null) {
  if (modalOverlay) return; // Already open

  modalOverlay = document.createElement('div');
  modalOverlay.className = 'jra-modal-overlay';

  // Determine initial values
  const valText = restoredState ? restoredState.inputText : (initialText || "");
  const valSummary = restoredState ? restoredState.inputSummary : (initialSummary || "");
  const valOutputText = restoredState ? restoredState.outputText : "";
  const valOutputSummary = restoredState ? restoredState.outputSummary : "";
  // Default sidebar to expanded (false) if no restored state
  const valSidebarCollapsed = restoredState ? restoredState.sidebarCollapsed : false;

  const sidebarDisplay = valSidebarCollapsed ? 'none' : 'flex';

  // Skeleton Layout
  const modalHTML = `
    <div class="jra-modal">
      <div class="jra-modal-header">
        <span class="jra-modal-title">BA Agent</span>
        <div style="display:flex; align-items:center; gap:8px;">
            <button id="jra-toggle-sidebar-btn" class="jra-icon-btn ${valSidebarCollapsed ? 'collapsed' : ''}" title="${valSidebarCollapsed ? 'Show Context' : 'Hide Context'}">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   <line x1="15" y1="3" x2="15" y2="21"></line>
                   ${valSidebarCollapsed ? '<path d="M9 3v18" stroke="transparent"></path>' : ''} 
               </svg>
            </button>
            <button class="jra-close-btn jra-icon-btn" title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
      </div>
      <div class="jra-modal-body">
        
        <!-- Col 1: Input -->
        <div class="jra-col-input">
          <div class="jra-tabs-header">
             <div class="jra-tab-item active" data-target="input" data-mode="text">Original Draft</div>
             <div class="jra-tab-item" data-target="input" data-mode="visual">Visual Preview</div>
          </div>
          
          <input type="text" id="jra-input-summary" class="jra-input" placeholder="Summary" style="margin-bottom: 8px; font-weight: bold;" value="${escapeHtml(valSummary)}" />
          <textarea class="jra-textarea" id="jra-input-text">${escapeHtml(valText)}</textarea>
          <div class="jra-visual-view" id="jra-input-visual" style="display:none;"></div>
          
          <div style="margin-top: 10px; display:flex; flex-direction: column; gap: 8px;">
             <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#42526e;">
                <input type="checkbox" id="jra-restrict-team" checked />
                只搜尋同團隊 reference
             </label>
             <div style="display:flex; align-items:center; gap:8px;">
                 <label class="jra-input-label" for="jra-issue-type-override">輸出類別</label>
                 <select id="jra-issue-type-override" class="jra-select" style="font-size:12px; padding: 2px 24px 2px 8px; height: 28px; width: auto; background-position: right 8px center;">
                    <option value="" selected>Auto (Default)</option>
                    <option value="Bug">Bug</option>
                    <option value="Change Request">Change Request</option>
                 </select>
             </div>
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
           <div class="jra-tabs-header">
              <div class="jra-tab-item active" data-target="output" data-mode="text">AI Suggestion</div>
              <div class="jra-tab-item" data-target="output" data-mode="visual">Visual Preview</div>
           </div>
           
           <div id="jra-output-container" style="flex:1; display:flex; flex-direction:column; position:relative; min-height:0; overflow:hidden;">
              <div id="jra-output-placeholder" style="margin:auto; color:#999; text-align:center; display: ${valOutputText ? 'none' : 'block'};">
                 Click "Submit to AI" to generate suggestions.
              </div>
              <input type="text" id="jra-output-summary" class="jra-input" placeholder="Refined Summary will appear here..." style="display:${valOutputSummary ? 'block' : 'none'}; margin-bottom: 8px; font-weight: bold;" value="${escapeHtml(valOutputSummary)}" readonly />
              <textarea class="jra-textarea" id="jra-output-text" style="display:${valOutputText ? 'block' : 'none'}; flex: 1;">${escapeHtml(valOutputText)}</textarea>
              <div class="jra-visual-view" id="jra-output-visual" style="display:none;"></div>
              <div id="jra-loading" style="display:none; position:absolute; inset:0; background:rgba(255,255,255,0.8); align-items:center; justify-content:center;">
                 <div class="jra-spinner"></div>
              </div>
           </div>
        </div>

        <!-- Col 3: Questions / Context -->
        <div class="jra-col-questions" id="jra-col-questions" style="display: ${sidebarDisplay};">
           <div class="jra-tabs-header">
              <div class="jra-tab-item active" data-tab="questions">Questions</div>
              <div class="jra-tab-item" data-tab="context">Context</div>
           </div>
           
           <div class="jra-col3-content active" style="overflow: auto;" id="jra-tab-questions">
              <div style="margin-bottom:8px; font-weight:600; color:#172b4d;">Developer Questions (PM Focus)</div>
              <div id="jra-questions-list">
                 <div style="color:#6b778c; padding:8px;">No questions generated.</div>
              </div>
           </div>
           
           <div class="jra-col3-content" id="jra-tab-context">
              <div class="jra-question-label">Reference Context</div>
              <div id="jra-references">
                 <p style="color:#999">No specific references found.</p>
              </div>
              <button class="jra-btn jra-btn-secondary" id="jra-resuggest" disabled style="margin-top:10px; width:100%;">
                Refine with References
              </button>
           </div>
        </div>

      </div>
      <div class="jra-modal-footer">
        <button class="jra-btn" id="jra-close-btn-footer">Close</button>
        <button class="jra-btn jra-btn-primary" onclick="copyResult()">Copy Result</button>
      </div>
    </div>
  `;

  modalOverlay.innerHTML = modalHTML;
  document.body.appendChild(modalOverlay);

  // Init Inputs
  const inputTextarea = document.getElementById('jra-input-text');

  // Init Left Visual View
  document.getElementById('jra-input-visual').innerHTML = simpleWikiParser(valText);

  // Real-time Visual Update
  inputTextarea.addEventListener('input', () => {
    document.getElementById('jra-input-visual').innerHTML = simpleWikiParser(inputTextarea.value);
  });

  // Restore Questions/Refs if state exists
  if (restoredState) {
    if (restoredState.questionsHTML) {
      const qList = document.getElementById("jra-questions-list");
      if (qList) {
        qList.innerHTML = restoredState.questionsHTML;
        setupQuestionInteractivity(); // Restore listeners
      }
    }
    if (restoredState.refsHTML) {
      const rList = document.getElementById("jra-references");
      if (rList) rList.innerHTML = restoredState.refsHTML;
    }
    // Re-initialize Ref toggles since HTML was blindly injected? 
    // Actually renderReferences handles onclick attributes cleanly, so innerHTML inject is fine IF the onclick logic is robust.
    // But our onclick logic in renderReferences uses "this.nextElementSibling...", which relies on DOM structure.
    // Injecting HTML preserves structure, so inline onclicks should work.
  }

  modalOverlay.querySelector('.jra-close-btn').addEventListener('click', closeModal);
  document.getElementById('jra-close-btn-footer').addEventListener('click', closeModal);
  document.getElementById('jra-submit-ai').addEventListener('click', submitToAI);
  document.getElementById('jra-resuggest').addEventListener('click', submitToAI);

  // Toggle Sidebar
  document.getElementById('jra-toggle-sidebar-btn').addEventListener('click', toggleSidebar);

  // ... tabs listeners ...
  const modeTabs = modalOverlay.querySelectorAll('.jra-tab-item[data-target]');
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target; // 'input' or 'output'
      // Deactivate siblings in the same header
      tab.parentElement.querySelectorAll('.jra-tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      toggleViewMode(target, tab.dataset.mode);
    });
  });

  // Tab Switching (Col 3: Questions/Context)
  const col3Tabs = modalOverlay.querySelectorAll('.jra-col-questions .jra-tab-item');
  col3Tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate siblings in the same header
      tab.parentElement.querySelectorAll('.jra-tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetId = "jra-tab-" + tab.dataset.tab;
      modalOverlay.querySelectorAll(".jra-col3-content").forEach(c => c.classList.remove("active"));
      document.getElementById(targetId).classList.add("active");
    });
  });
}

function closeModal() {
  if (modalOverlay) {
    // SAVE STATE to Cache
    const sidebar = document.getElementById('jra-col-questions');
    // We check style.display directly
    const sidebarCollapsed = sidebar && sidebar.style.display === 'none';

    cachedState = {
      url: window.location.href,
      inputText: document.getElementById('jra-input-text')?.value || "",
      inputSummary: document.getElementById('jra-input-summary')?.value || "",

      outputText: document.getElementById('jra-output-text')?.value || "",
      outputSummary: document.getElementById('jra-output-summary')?.value || "",

      questionsHTML: document.getElementById('jra-questions-list')?.innerHTML || "",
      refsHTML: document.getElementById('jra-references')?.innerHTML || "",

      sidebarCollapsed: sidebarCollapsed
    };

    console.log("JRA: State cached for URL: " + cachedState.url);

    modalOverlay.remove();
    modalOverlay = null;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('jra-col-questions');
  const btn = document.getElementById('jra-toggle-sidebar-btn');
  if (!sidebar || !btn) return;

  // Icons
  const iconOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`;
  // Closed icon: Dashed line or different visual? Let's use the same but maybe opacity change or "Layout" icon.
  // Actually, "Hide Context" implies we see it now. "Show" means we don't.
  // Let's use a crossed-out sidebar or just a full rect for closed.
  const iconClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21" opacity="0.2"></line></svg>`;

  if (sidebar.style.display === 'none') {
    sidebar.style.display = 'flex';
    btn.innerHTML = iconOpen;
    btn.title = "Hide Context";
    btn.classList.remove('collapsed');
  } else {
    sidebar.style.display = 'none';
    btn.innerHTML = iconClosed;
    btn.title = "Show Context";
    btn.classList.add('collapsed');
  }
}

async function submitToAI(e) {
  const inputBtn = document.getElementById('jra-submit-ai');
  const resuggestBtn = document.getElementById('jra-resuggest');
  const answersBtn = document.getElementById('jra-submit-answers');

  // Determine if this is a refinement (Update with Answers)
  const isRefinement = e && e.target && e.target.id === 'jra-submit-answers';

  // Get Sources
  let inputText = document.getElementById('jra-input-text')?.value || "";
  let summary = document.getElementById('jra-input-summary')?.value || (document.querySelector('#summary-val')?.innerText || "Unknown Issue");

  // If refining, try to use the existing AI Output as the base
  if (isRefinement) {
    const outputText = document.getElementById('jra-output-text')?.value;
    const outputSummary = document.getElementById('jra-output-summary')?.value;

    if (outputText && outputText.trim().length > 0) {
      console.log("JRA: Using AI Output as base for refinement");
      inputText = outputText; // Swap source
      if (outputSummary) summary = outputSummary;
    }
  }

  const issueTypeOriginal = document.querySelector('#type-val')?.innerText || "Story";
  const issueTypeOverride = document.getElementById('jra-issue-type-override')?.value;
  const issueType = issueTypeOverride || issueTypeOriginal;
  const componentName = getComponentName();
  const componentTeam = deriveComponentTeam(componentName);
  const restrictToTeam = document.getElementById('jra-restrict-team')?.checked ?? true;
  const outputLanguage = document.getElementById('jra-output-language')?.value || "zh-TW";
  const selectedReferences = document.getElementById('jra-references')?.dataset.selected || null;

  if (!inputText.trim()) {
    alert("Please enter some text first.");
    return;
  }

  // UI Loading State
  setLoading(true);

  try {
    // Check for User Answers from Questions Column
    const userAnswers = [];
    const qCards = document.querySelectorAll('.jra-question-card');
    qCards.forEach((card, idx) => {
      if (!card.classList.contains('skipped')) {
        const question = card.querySelector('strong').innerText;
        const answer = card.querySelector('textarea').value;
        if (answer && answer.trim()) {
          userAnswers.push({ question: question, answer: answer.trim() });
        }
      }
    });

    const payload = {
      current_description: inputText,
      summary: summary,
      issue_type: issueType,
      component_name: componentName,
      component_team: componentTeam,
      restrict_to_team: restrictToTeam,
      output_language: outputLanguage,
      user_answers: userAnswers.length > 0 ? userAnswers : null
      // Pass selected references if any (simplified)
      // selected_references: selectedReferences ? JSON.parse(selectedReferences) : null 
    };

    // Check if we have references stored in global
    if (lastReferences && lastReferences.length > 0) {
      // Simple logic: send all as context if re-suggesting, or let backend verify
      // For now, simpler payload is fine as backend handles RAG if not provided
      // or we could pass IDs. Kept simple as per original logic.
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
    let refinedText = data.refined_content || "";
    let refinedSummary = data.refined_summary || "";

    console.log("JRA: Received Data", data); // Debug log

    if (!refinedText) {
      throw new Error("Received empty content from AI. Please try again.");
    }

    const outputSummaryInput = document.getElementById('jra-output-summary');
    if (outputSummaryInput) {
      outputSummaryInput.value = refinedSummary;
      outputSummaryInput.style.display = 'block';
    }

    // Extract Questions
    let { cleanWiki, questions } = extractQuestions(refinedText);

    // Filter out questions that were just answered
    if (userAnswers && userAnswers.length > 0) {
      const answeredTexts = new Set(userAnswers.map(ua => ua.question.trim()));
      questions = questions.filter(q => !answeredTexts.has(q.trim()));
    }

    // Only clear and render if we have content
    if (cleanWiki && cleanWiki.trim().length > 0) {
      renderOutput(cleanWiki);
    } else {
      console.error("JRA: cleanWiki is empty after extraction", refinedText);
      // Fallback: Render raw text if extraction failed
      renderOutput(refinedText);
    }

    // If user answered questions, we might want to keep the old questions 
    // OR show new questions. Usually new spec -> new questions.
    renderQuestions(questions);

    // Switch to Output Tab
    toggleViewMode('output', 'text');
    const outputTab = document.querySelector('.jra-tab-item[data-target="output"]');
    if (outputTab) outputTab.click();

    // Render References
    if (data.references) {
      lastReferences = data.references;
      renderReferences(data.references);
    }

    // Stop Loading UI first
    setLoading(false);

    // Start Cooldown (overrides button state)
    startCooldown(inputBtn);
    if (resuggestBtn) resuggestBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
    setLoading(false); // Reset on error
  }
}

function setLoading(isLoading) {
  const loader = document.getElementById('jra-loading');
  const btn = document.getElementById('jra-submit-ai');
  const resuggestBtn = document.getElementById('jra-resuggest');
  const answersBtn = document.getElementById('jra-submit-answers');

  if (isLoading) {
    if (loader) loader.style.display = 'flex';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Processing...</span>';
    }
    if (resuggestBtn) resuggestBtn.disabled = true;
    if (answersBtn) {
      answersBtn.classList.add('disabled');
      answersBtn.innerText = "Processing...";
    }
  } else {
    if (loader) loader.style.display = 'none';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Submit to AI</span>';
    }
    // Re-validate answers button instead of just enabling
    if (answersBtn) {
      answersBtn.innerText = "Update with Answers";
      // Let the validation logic decide if it should be enabled
      // Trigger a fake input event to re-run validation check?
      // Or expose checkSubmit?
      // Simpler: Just remove "Processing..." text, allow validation to handle disabled class.
      // We'll rely on checkSubmit() running on input/click to re-enable it if valid.
      // But we should probably run checkSubmit here if we can.
      // For now, let's just reset text. Ideally, checkSubmit should run.
    }
  }
}

let cooldownTimer = null;
function startCooldown(btn) {
  let cooldownRemaining = 30; // 30 seconds
  btn.disabled = true;
  btn.innerHTML = `<span>Wait ${cooldownRemaining}s</span>`;

  if (cooldownTimer) clearInterval(cooldownTimer);

  cooldownTimer = setInterval(() => {
    cooldownRemaining--;
    if (cooldownRemaining <= 0) {
      clearInterval(cooldownTimer);
      btn.disabled = false;
      btn.innerHTML = '<span>Submit to AI</span>';
    } else {
      btn.innerHTML = `<span>Wait ${cooldownRemaining}s</span>`;
    }
  }, 1000);
}

function renderOutput(text) {
  const textarea = document.getElementById('jra-output-text');
  const visualDiv = document.getElementById('jra-output-visual');

  textarea.value = text;
  visualDiv.innerHTML = simpleWikiParser(text);

  // Default to Text mode for Output
  const activeTab = document.querySelector('.jra-tab-item[data-target="output"].active');
  const mode = activeTab ? activeTab.dataset.mode : 'text';
  toggleViewMode('output', mode);
}

// --- Utility: Question Extraction ---

function extractQuestions(wikiText) {
  // Look for header "h1. Developer Questions" or similar localized versions
  const headerRegex = /h1\.\s*(Developer Questions|Developer Questions（開發者提問）|Developer Questions（开发者提问）|Developer Questions.*)/i;
  const match = wikiText.match(headerRegex);

  if (!match) {
    return { cleanWiki: wikiText, questions: [] };
  }

  const startIndex = match.index;
  const sectionTitle = match[0];
  const contentAfter = wikiText.substring(startIndex + sectionTitle.length);

  // The clean wiki is everything before the questions header
  const cleanWiki = wikiText.substring(0, startIndex).trim();

  // Extract lines that look like questions (bullet points)
  const lines = contentAfter.split('\n');
  const questions = [];

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('h1.')) break;
    if (line.startsWith('----')) break;

    if (line.match(/^[\*\#\-]+\s*/)) {
      let qText = line.replace(/^[\*\#\-]+\s*/, '');
      qText = qText.replace(/^\*(.*)\*$/, '$1');
      qText = qText.replace(/^_(.*)_$/, '$1');

      if (qText.trim().length > 2 && !qText.includes("None")) {
        questions.push(qText.trim());
      }
    }
  }

  return { cleanWiki, questions };
}

function renderQuestions(questions) {
  const container = document.getElementById('jra-questions-list');
  if (!questions || questions.length === 0) {
    container.innerHTML = '<div style="color:#6b778c; padding:8px;">No questions generated.</div>';
    return;
  }

  container.innerHTML = questions.map((q, idx) => `
    <div class="jra-question-card" id="q-card-${idx}" data-idx="${idx}">
      <div class="jra-q-header">
        <strong style="font-size:13px; color:#172b4d;">${escapeHtml(q)}</strong>
        <button class="jra-skip-btn">Skip</button>
      </div>
      <textarea class="jra-q-input" id="q-input-${idx}" placeholder="Answer here to refine spec..."></textarea>
    </div>
  `).join('');

  // Add Submit Button at the bottom
  const submitBtn = document.createElement('div');
  submitBtn.style.marginTop = "12px";
  // Added 'disabled' class initially
  submitBtn.innerHTML = `
    <button class="jra-btn jra-btn-primary disabled" id="jra-submit-answers" style="width:100%">
        Update with Answers
    </button>
  `;
  container.appendChild(submitBtn);

  // Initial check
  setupQuestionInteractivity();
}

function setupQuestionInteractivity() {
  const container = document.getElementById('jra-questions-list');
  const submitBtnEl = document.getElementById('jra-submit-answers');

  if (!container || !submitBtnEl) return;

  // Validation Logic
  const checkSubmit = () => {
    const cards = container.querySelectorAll('.jra-question-card');
    let allAnswered = true;
    cards.forEach(card => {
      const isSkipped = card.classList.contains('skipped');
      const hasAnswer = card.querySelector('textarea').value.trim().length > 0;
      if (!isSkipped && !hasAnswer) {
        allAnswered = false;
      }
    });

    if (allAnswered) {
      submitBtnEl.classList.remove('disabled');
    } else {
      submitBtnEl.classList.add('disabled');
    }
  };

  // Event Delegation for Skip Buttons (Assignments to onclick prevents duplicates)
  container.onclick = (e) => {
    // Use closest to handle clicks on children (if any) or the button itself
    const btn = e.target.closest('.jra-skip-btn');
    if (btn) {
      const card = btn.closest('.jra-question-card');
      if (card) {
        // Add/Remove class
        if (card.classList.contains('skipped')) {
          card.classList.remove('skipped');
        } else {
          card.classList.add('skipped');
        }
        checkSubmit(); // Re-validate on skip toggle
      }
    }
  };

  // Event Delegation for Inputs
  container.oninput = (e) => {
    if (e.target.classList.contains('jra-q-input')) {
      checkSubmit();
    }
  };

  // Attach click listener to Submit button (idempotent check)
  // Note: renderQuestions used to add this listener. 
  // If we call this from showModal, we need to ensure we don't double add if not using onclick property.
  // Ideally submitToAI listener is global or added once. 
  // Since submitBtnEl is recreated every time renderQuestions runs OR showModal restores HTML, we MUST add listener.
  // Use onclick to be safe against duplicates.
  submitBtnEl.onclick = submitToAI;

  // Initial check
  checkSubmit();
}
// Removed window.toggleSkip logic as it's now handled via delegation

function renderReferences(refs) {
  const container = document.getElementById('jra-references');
  const resuggestBtn = document.getElementById('jra-resuggest');
  lastReferences = refs || [];
  if (!refs || refs.length === 0) {
    container.innerHTML = '<p style="color:#999">No specific references found.</p>';
    if (resuggestBtn) resuggestBtn.disabled = true;
    return;
  }

  if (resuggestBtn) resuggestBtn.disabled = false;
  container.innerHTML = refs.map(ref => `
    <div class="jra-reference-card">
      <div class="jra-ref-header" onclick="this.nextElementSibling.classList.toggle('collapsed'); this.querySelector('.jra-ref-toggle').setAttribute('aria-expanded', !this.nextElementSibling.classList.contains('collapsed'))">
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

function getComponentName() {
  const componentEl = document.getElementById('components-val');
  if (!componentEl) return "";
  return componentEl.innerText.trim();
}

// Simple heuristic mapping
function deriveComponentTeam(componentName) {
  if (!componentName) return "Unknown";
  // Example logic
  if (componentName.includes("Backend")) return "Backend";
  if (componentName.includes("Frontend")) return "Frontend";
  return "General";
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

  let wikiText = traverse(root);

  // 1. Remove excessive newlines
  wikiText = wikiText.replace(/\n{3,}/g, '\n\n');

  // 2. Remove leading whitespace from each line (Fix for HTML source indentation)
  // This ensures "* Item" starts at the beginning of the line, not "       * Item"
  wikiText = wikiText.split('\n').map(line => line.trimStart()).join('\n');

  return wikiText.trim();
}

init();
