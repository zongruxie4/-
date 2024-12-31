class MessageHistory {
    constructor(maxSize = 512) {
        this.maxSize = maxSize;
        this.history = [];
    }

    // Add a new message to history
    addMessage(message) {
        // format timestamp to string
        message.timestamp = message.timestamp.toISOString();
        this.history.push(message);

        // Prune old messages if we exceed maxSize
        if (this.history.length > this.maxSize) {
            this.history = this.history.slice(-this.maxSize);
        }

        // Save to chrome storage
        this.saveToStorage();
    }

    // Load history from storage
    async loadHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['messageHistory'], (result) => {
                if (result.messageHistory) {
                    this.history = result.messageHistory;
                }
                resolve(this.history);
            });
        });
    }

    // Save current history to storage
    saveToStorage() {
        chrome.storage.local.set({ messageHistory: this.history });
    }

    // Clear all history
    clearHistory() {
        this.history = [];
        this.saveToStorage();
    }

    // Get all history
    getHistory() {
        return this.history;
    }
} 