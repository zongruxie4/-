// Function to generate a fallback ID when tab ID is unavailable
function generateFallbackId() {
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Function to ensure ID is assigned
function ensureTabId() {
    if (!document.body.hasAttribute('data-nano-tab-id')) {
        // Get tab ID from chrome runtime
        chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response) => {
            let uniqueId;
            if (response?.tabId) {
                uniqueId = `nano-tab-${response.tabId}`;
            } else {
                uniqueId = generateFallbackId();
                console.warn('Using fallback ID: Tab ID was unavailable');
            }
            document.body.setAttribute('data-nano-tab-id', uniqueId);
        });
    }
    return document.body.getAttribute('data-nano-tab-id');
}

// Run immediately when script loads
ensureTabId();

// Handle dynamic page changes
const observer = new MutationObserver(ensureTabId);
observer.observe(document.body, {
    attributes: true
});