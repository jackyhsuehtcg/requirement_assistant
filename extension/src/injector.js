// This script runs in the MAIN world (Page Context)
(function() {
    console.log("JRA: Injector strategy: Text Mode + execCommand");

    const rawText = document.body.dataset.jraRawText;
    if (!rawText) return;

    const textarea = document.getElementById('description');
    if (!textarea) {
        console.error("JRA: Textarea #description not found.");
        return;
    }

    // Helper to find the "Text" tab button
    function findTextTab() {
        // Try precise selectors for JIRA Server
        let tab = document.querySelector('.tabs-menu .tabs-menu-item a[href*="description-wiki-view"]'); // Common in JIRA
        if (!tab) {
             // Search by text content
             const links = document.querySelectorAll('a, button');
             for (let i = 0; i < links.length; i++) {
                 if (links[i].innerText.trim() === 'Text') {
                     return links[i];
                 }
             }
        }
        return tab;
    }

    const textTab = findTextTab();

    // 1. Force Switch to Text Mode
    if (textTab) {
        console.log("JRA: Clicking 'Text' tab...");
        textTab.click();
    } else {
        console.warn("JRA: 'Text' tab not found, assuming already in Text mode or simple editor.");
    }

    // 2. Wait a split second for the tab switch to render the textarea visible
    setTimeout(() => {
        try {
            console.log("JRA: Focusing textarea...");
            textarea.style.display = 'block'; // Force visible just in case
            textarea.style.visibility = 'visible';
            
            textarea.focus();
            textarea.click(); // Simulate user entering the field

            // 3. Simulate Typing (The most robust way)
            console.log("JRA: Executing insertText command...");
            
            // Select all current text
            document.execCommand('selectAll', false, null);
            
            // Replace with new text
            const success = document.execCommand('insertText', false, rawText);
            
            if (success) {
                console.log("JRA: insertText successful!");
            } else {
                console.warn("JRA: insertText failed, falling back to value assignment.");
                textarea.value = rawText;
            }

            // 4. Signal JIRA that form is dirty
            if (window.JIRA && window.JIRA.DirtyForm) {
                window.JIRA.DirtyForm.setDirty();
            }

        } catch (e) {
            console.error("JRA: Error during injection sequence", e);
        }
        
        // Cleanup
        delete document.body.dataset.jraRawText;
        delete document.body.dataset.jraHtmlText;
        
    }, 150); // Small delay to allow tab switch
})();
