// Fixed URI for WebSocket server
const WS_URL = 'ws://localhost:6768/ws';
const TEN_SECONDS_MS = 10000;
let webSocket = null;

// Setup side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// WebSocket connection management
function connectWebSocket() {
  webSocket = new WebSocket(WS_URL);
  
  webSocket.onopen = () => {
    console.log('WebSocket connected');
    broadcastConnectionStatus(true);
    keepAlive();
  };
  
  webSocket.onclose = () => {
    console.log('WebSocket disconnected');
    broadcastConnectionStatus(false);
    // Attempt to reconnect after 5 seconds
    setTimeout(connectWebSocket, 5000);
  };
  
  webSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      const kind = message.kind;
      if (kind === 'state') {
        // Broadcast task progress to sidebar
        broadcastToSidebar({
          type: 'state',
          data: message.data
        });
      } else if (kind === 'ack') {
        // console.log('ACK:', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };
}

function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () => {
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log('sending heartbeat');
        const heartbeatMessage = {
          kind: "hb",
          data: {
            timestamp: Math.floor(new Date().getTime() / 1000)
          }
        };
        webSocket.send(JSON.stringify(heartbeatMessage));
      } else {
        clearInterval(keepAliveIntervalId);
      }
    },
    TEN_SECONDS_MS
  );
}

// Broadcast helpers
function broadcastConnectionStatus(isConnected) {
  broadcastToSidebar({
    type: 'connection_status',
    data: { isConnected }
  });
}

function broadcastToSidebar(message) {
  chrome.runtime.sendMessage(message).catch(err => {
    console.log('Failed to send message to sidebar:', err);
  });
}

function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 900000) + 100000; // 6-digit random number
  return `${timestamp}-${random}`;
}

// Message handling from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_MESSAGE' && webSocket) {
        const taskId = generateTaskId();
        const taskMessage = {
            kind: "create",
            data: {
                task_id: taskId,
                intent: message.text,
                args: { tab_id: message.tabId }
            }
        };
        webSocket.send(JSON.stringify(taskMessage));
        sendResponse({ success: true, taskId: taskId }); // Send back the taskId
    } else if (message.type === 'CANCEL_TASK' && webSocket) {
        if (message.taskId) {
            console.log('Cancelling task:', message.taskId);
            const cancelMessage = {
                kind: "cancel",
                data: {
                    task_id: message.taskId
                }
            };
            webSocket.send(JSON.stringify(cancelMessage));
            sendResponse({ success: true });
        } else {
            console.warn('Attempted to cancel task without taskId');
            sendResponse({ success: false });
        }
    }
    return true;
});

// Initialize WebSocket connection
connectWebSocket();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.error('Failed to inject content script:', err));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_TAB_ID') {
        if (sender.tab && sender.tab.id !== undefined) {
            sendResponse({ tabId: sender.tab.id });
        } else {
            sendResponse({ tabId: null });
        }
    }
}); 