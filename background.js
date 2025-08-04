// Maintains session data for each tab
let sessionData = {};

// Function to update the extension icon
function updateIcon() {
  const hasActiveSession = Object.keys(sessionData).length > 0;
  console.log("Active sessions:", Object.keys(sessionData), "hasActiveSession:", hasActiveSession);
  
  const iconPath = hasActiveSession
    ? {
        "16": "icons/icon-active-16.png",
        "32": "icons/icon-active-32.png",
        "48": "icons/icon-active-48.png",
        "128": "icons/icon-active-128.png",
      }
    : {
        "16": "icons/icon-inactive-16.png",
        "32": "icons/icon-inactive-32.png",
        "48": "icons/icon-inactive-48.png",
        "128": "icons/icon-inactive-128.png",
      };
  chrome.action.setIcon({ path: iconPath });
}

// Event configuration
let eventConfig = null;

// Initialize configuration when loading the extension
fetchEventConfig().then(config => {
  eventConfig = config;
});

// Create a new event capture session if there is an event configuration
function createNewCaptureSession(tabId) {
  if (!eventConfig) return;
  console.log("Creating new capture session for tab", tabId);
  sessionData[tabId] = [];
  
  chrome.tabs.sendMessage(
    tabId,
    { type: "captureMethods", config: eventConfig },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending event configuration to new session:",
          chrome.runtime.lastError.message,
        );
        delete sessionData[tabId];
        updateIcon();
      } else {
        console.log("Event configuration successfully sent", response);
        updateIcon();
      }
    },
  );
}

// End the event capture session and send captured events to the server
function endCaptureSession(tabId) {
  if (!sessionData[tabId]) return;
  console.log("Ending capture session for tab", tabId);
  sendEventsToServer(tabId);
  delete sessionData[tabId];
  updateIcon();
}

// Configure event capture methods in the content script
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log("Tab created:", tab);
  createNewCaptureSession(tab.id);
});

// When a tab is closed, send captured events to the server
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log("Tab removed:", tabId);
  endCaptureSession(tabId);
});

// When a tab is updated, send captured events to the server and create a new session
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, "URL:", tab.url);
    endCaptureSession(tabId);
    createNewCaptureSession(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "event") {
    sessionData[sender.tab.id].push(message.event);
  } else if (message.type === "captureEnded") {
    console.log("Capture ended by timeout for tab", sender.tab.id);
    endCaptureSession(sender.tab.id);
  } else if (message.type === "getSessionCount") {
    sendResponse({ count: Object.keys(sessionData).length });
  } else if (message.type === "configUpdated") {
    console.log("Configuration updated");
  }
  return true; // Keep message channel open for async response
});

// ------------------ Server communication functions ------------------

// Get event configuration from the server
/*
async function fetchEventConfig() {
    try {
        const response = await fetch('https://example.com/get-event-config');
        const eventConfig = await response.json();
        console.log('Event config fetched:', eventConfig);
        return eventConfig;
    }
    catch (error) {
        console.error('Error fetching event config:', error);
        return null;
    }
}

// Send captured events to the server
function sendEventsToServer(tabId) {
    fetch('https://example.com/send-events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData[tabId])
    }).then(response => console.log('Events sent', response))
    .catch(error => console.error('Error sending events', error));
}
*/

// ------------------ Test functions ------------------

function fetchEventConfig() {
  console.log("Fetching event configuration from file");
  return fetch(chrome.runtime.getURL('eventConfigExample.json'))
    .then(response => response.json())
    .then(config => {
      console.log("Event config loaded:", config);
      return config;
    })
    .catch(error => {
      console.error("Error loading event config:", error);
      return null;
    });
}

function sendEventsToServer(tabId) {
  console.log("Sending events to server:", sessionData[tabId]);
}