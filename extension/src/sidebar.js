function setInputsEnabled(enabled, show_stop_button=false) {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');

    chatInput.disabled = !enabled;
    sendButton.disabled = !enabled;
    
    // Add visual styling for disabled state
    if (enabled) {
        chatInput.style.backgroundColor = '';
        chatInput.style.color = '';
        // Show send button, hide stop button
        sendButton.style.display = 'block';
        stopButton.style.display = 'none';
    } else {
        chatInput.style.backgroundColor = '#f5f5f5';
        chatInput.style.color = '#999';
        // Show stop button, hide send button
        if (show_stop_button) {
            sendButton.style.display = 'none';
            stopButton.style.display = 'block';
        } else {
            sendButton.style.display = 'block';
            stopButton.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const connectionStatus = document.getElementById('connection-status');

    const messagesContainer = document.getElementById('messages-container');
    const messageHistory = new MessageHistory();
    // Load history messages efficiently
    const history = await messageHistory.loadHistory();
    if (history.length > 0) {
        // Create fragment to batch DOM updates
        const fragment = document.createDocumentFragment();
        let previousMessage = null;
        
        for (const message of history) {
            const messageElement = createMessageElement(message, previousMessage);
            if (messageElement) {
                messageElement.message = message;
                fragment.appendChild(messageElement);
                previousMessage = message;
            }
        }
        
        messagesContainer.appendChild(fragment);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    window.messageHistory = messageHistory;

    let currentTaskId = null; // Track current task ID

    // Handle sending messages
    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Handle /clear command
        if (text.toLowerCase() === '/clear') {
            // Clear UI
            const messagesContainer = document.getElementById('messages-container');
            messagesContainer.innerHTML = '';
            
            // Clear storage
            await messageHistory.clearHistory();
            
            // Clear input
            chatInput.value = '';
            return;
        }

        // Regular message handling continues...
        setInputsEnabled(false, true);

        // Add user message to chat
        addMessage({
            actor: 'user',
            content: text,
            timestamp: new Date()
        });
        chatInput.value = '';

        // Get current tab ID and send message
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tabId = tabs[0]?.id ? `nano-tab-${tabs[0].id}` : generateFallbackId();
            
            // Send message to service worker
            chrome.runtime.sendMessage({
                type: 'SEND_MESSAGE',
                text,
                tabId
            }).then(response => {
                if (response?.taskId) {
                    currentTaskId = response.taskId; // Store the task ID
                }
            }).catch(err => {
                addMessage({
                    actor: 'system',
                    content: 'Failed to send message',
                    timestamp: new Date()
                });
                setInputsEnabled(true);
            });
        });
    }

    // Handle messages from service worker
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'connection_status') {
            updateConnectionStatus(message.data.isConnected);
        } else if (message.type === 'state') {
            handleTaskState(message.data);
        } else if (message.type === 'current_task') {
            // Handle current task message
            if (message.data.task_id) {  // Will be false for "", null, undefined
                currentTaskId = message.data.task_id;
                // disable inputs and show stop button
                setInputsEnabled(false, true);
            } else {
                currentTaskId = null;
                // enable inputs
                setInputsEnabled(true);
            }
        }
    });

    // Update connection status
    function updateConnectionStatus(isConnected) {
        connectionStatus.textContent = isConnected ? 'Connected' : 'Not Connected';
        connectionStatus.style.display = 'block';
        connectionStatus.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
        if (!isConnected) {
            // disable inputs and but keep send button visible
            setInputsEnabled(false, false);
        }
    }

    // Event listeners
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Add auto-grow functionality
    function autoGrow() {
        chatInput.style.height = 'auto'; // Reset height to recalculate
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 100)}px`; // Set new height up to max
    }
    
    // Listen for input events
    chatInput.addEventListener('input', autoGrow);

    // Add stop button handler
    document.getElementById('stop-button').addEventListener('click', () => {
        if (currentTaskId) {
            // Send CANCEL message to service worker
            chrome.runtime.sendMessage({
                type: 'CANCEL_TASK',
                taskId: currentTaskId
            }).catch(err => {
                addMessage({
                    actor: 'system',
                    content: 'Failed to cancel task',
                    timestamp: new Date()
                });
            });
            
            currentTaskId = null;
            setInputsEnabled(true);
        }
    });

    // When task completes or errors, switch back to send button
    function handleTaskComplete() {
        currentTaskId = null;
    }

    // Request current task status when sidebar opens
    chrome.runtime.sendMessage({
        type: 'GET_CURRENT_TASK'
    }).catch(err => {
        console.error('Failed to get current task status:', err);
    });
});

// Helper function for generating fallback ID
function generateFallbackId() {
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

const ACTORS = {
    user: {
        name: 'User',
        icon: 'icons/user.svg',
        iconBackground: '#4CAF50'  // Stronger green
    },
    system: {
        name: 'System',
        icon: 'icons/system.svg',
        iconBackground: '#2196F3'  // Stronger blue
    },
    manager: {
        name: 'Manager',
        icon: 'icons/manager.svg',
        iconBackground: '#9C27B0'  // Stronger purple
    },
    planner: {
        name: 'Planner',
        icon: 'icons/planner.svg',
        iconBackground: '#FF9800'  // Stronger orange
    },
    navigator: {
        name: 'Navigator',
        icon: 'icons/navigator.svg',
        iconBackground: '#00BCD4'  // Stronger cyan
    },
    evaluator: {
        name: 'Evaluator',
        icon: 'icons/evaluator.svg',
        iconBackground: '#FFC107'  // Stronger yellow
    },
    validator: {
        name: 'Validator',
        icon: 'icons/validator.svg',
        iconBackground: '#F44336'  // Stronger red
    }
};




function formatTime(date) {
    // Convert string dates to Date objects if needed
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toTimeString().split(' ')[0];
}

function createMessageElement(message, previousMessage) {
    // Check if previous message was a progress bar
    if (previousMessage?.content === 'Working on it...') {
        // If current message is also a progress bar, skip creating new element
        if (message.content === 'Working on it...') {
            return null;
        }
        
        // If current message is not a progress bar, remove the last progress message
        const messagesContainer = document.getElementById('messages-container');
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            messagesContainer.removeChild(lastMessage);
        }
    }

    const messageBlock = document.createElement('div');
    messageBlock.className = 'message-block';
    messageBlock.setAttribute('data-actor', message.actor);
    
    const isSameActor = previousMessage && previousMessage.actor === message.actor;
    if (isSameActor) {
        messageBlock.classList.add('same-actor');
    }

    // Actor icon
    const actorIcon = document.createElement('div');
    actorIcon.className = 'actor-icon';
    if (!isSameActor && ACTORS[message.actor].icon) {
        const iconImg = document.createElement('img');
        iconImg.src = ACTORS[message.actor].icon;
        iconImg.alt = ACTORS[message.actor].name;
        actorIcon.appendChild(iconImg);
        actorIcon.style.backgroundColor = ACTORS[message.actor].iconBackground;
    }
    messageBlock.appendChild(actorIcon);

    // Message content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'message-content';

    // Display actor name if it's not the same as the previous message
    if (!isSameActor) {
        const actorName = document.createElement('div');
        actorName.className = 'actor-name';
        actorName.textContent = ACTORS[message.actor].name;
        contentContainer.appendChild(actorName);
    }

    // Create time element first
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = formatTime(message.timestamp);

    // Message text
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    // Add progress indicator for "Working on it..." messages
    if (message.content === 'Working on it...') {
        messageText.classList.add('progress-message');
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        messageText.appendChild(progressBar);
        
        // Hide the time element for progress messages
        timeElement.style.display = 'none';
    } else {
        messageText.textContent = message.content;
    }
    
    contentContainer.appendChild(messageText);
    contentContainer.appendChild(timeElement);
    messageBlock.appendChild(contentContainer);

    return messageBlock;
}

function addMessage(message) {
    const messagesContainer = document.getElementById('messages-container');
    const previousMessage = messagesContainer.lastElementChild?.message;
    
    const messageElement = createMessageElement(message, previousMessage);
    // Only append if messageElement is not null
    if (messageElement) {
        messageElement.message = message;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Save message to history
        if (message.content !== 'Working on it...') {
            window.messageHistory.addMessage(message);
        }
    }
}

function handleTaskState(data) {

    const state = data.state;
    const actor = data.actor || 'system';
    const timestamp = new Date(data.timestamp) || new Date();
    const eventData = data.data;
    let content = eventData?.details
    let skip = false;
    let display_progress = false;

    if (actor === 'manager') {
        if (state === 'task.start') {
           skip = true;
        } else if (state === 'task.error') {
            content = `Task failed. \n\n ${content}`;
            setInputsEnabled(true);
        } else if (state === 'task.cancel') {
            content = 'Task canceled.';
            setInputsEnabled(true);
        } else if (state === 'task.ok') {
            setInputsEnabled(true);
            skip = true;
        }
    } else if (actor === 'planner') {
        if (state === 'step.start') {
            skip = true;
        } else if (state === 'step.ok') {
            // if plan is not empty, display the plan first
            if (eventData?.plan) {
                if (eventData.step === 1) {
                    plan = `${eventData.plan}`;
                } else {
                    plan = `${eventData.plan}`;
                }
                addMessage({
                    actor,
                    content: plan,
                    timestamp
                }); 
            }
            // skip to display the details: next step, but display final response
            if (!eventData?.final) {
                skip = true; 
            }
        } else if (state === 'step.error') {
            content = `Step failed. \n\n ${content}`;
        } else if (state === 'step.cancel') {
            content = 'Step canceled.';
        }
    } else if (actor === 'navigator') {
        // by default, display progress when navigating
        display_progress = true;
        if (state === 'step.start') {
            // remove string like "[mmid='914']"
            content = content.replace(/\[mmid='\d+'\]/g, '');
        } else if (state === 'step.error') {
            content = `Step failed. \n ${content}`;
            display_progress = false;
        } else if (state === 'step.cancel') {
            content = 'Step canceled.';
            display_progress = false;
        } else if (state === 'step.ok') {
            // display progress if it's not the final response
            if (eventData?.final) {
                display_progress = false;
            }
            skip = true;
        } else{
            // skip to display other messages, like tool calls
            skip = true;
        }
    } 

    if (!skip) {
        addMessage({
            actor,
            content,
            timestamp
        });
    }
    
    // display progress if needed
    if (display_progress) {
        addMessage({
            actor: actor,
            content: 'Working on it...',
            timestamp
        });
    }
} 