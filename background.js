// Cross-browser compatibility
const extensionAPI = typeof browser !== 'undefined' ? browser : chrome;

// Open options page on installation
extensionAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    extensionAPI.runtime.openOptionsPage();
  }
});

// Maintains session data for each tab
let sessionData = {};

// Anonymize URL if configured
function anonymizeUrl(url, shouldAnonymize) {
  if (!shouldAnonymize) return url;
  return '[anonymized-url]';
}

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
  extensionAPI.browserAction.setIcon({ path: iconPath });
}

// Event configuration
let eventConfig = null;

// Initialize configuration when loading the extension
fetchEventConfig().then(config => {
  eventConfig = config;
});

// Create a new event capture session if there is an event configuration
async function createNewCaptureSession(tabId) {
  // If no config available, try to fetch it
  if (!eventConfig) {
    console.log("No event config available, trying to fetch from server");
    eventConfig = await fetchEventConfig();
  }
  
  if (!eventConfig || !eventConfig.events || !Array.isArray(eventConfig.events)) {
    console.log("No valid event configuration available, session creation skipped for tab", tabId);
    return;
  }

  console.log("Creating new capture session for tab", tabId);  // Get stored user ID and tab information
  extensionAPI.storage.sync.get(['userId'], (result) => {
    if (!result || !result.userId) {
      // Try local storage as fallback
      extensionAPI.storage.local.get(['userId'], (localResult) => {
        if (!localResult || !localResult.userId) {
          console.error("No user ID configured in sync or local storage");
          return;
        }
        proceedWithSession(localResult.userId, tabId);
      });
      return;
    }
    proceedWithSession(result.userId, tabId);
  });
}

function proceedWithSession(userId, tabId) {
    extensionAPI.tabs.get(tabId, (tab) => {
      if (extensionAPI.runtime.lastError) {
        console.error("Error getting tab info:", extensionAPI.runtime.lastError.message);
        return;
      }
      
      // Apply URL anonymization if configured
      const finalUrl = anonymizeUrl(tab.url, eventConfig.url);
      
      sessionData[tabId] = {
        userId: userId,
        tabId: tabId,
        url: finalUrl,
        startTime: Date.now(),
        endTime: null,
        events: []
      };
      
      extensionAPI.tabs.sendMessage(
        tabId,
        { type: "captureMethods", config: eventConfig },
        (response) => {
          if (extensionAPI.runtime.lastError) {
            console.error(
              "Error sending event configuration to new session:",
              extensionAPI.runtime.lastError.message,
            );
            delete sessionData[tabId];
            updateIcon();
          } else if (response && !response.success) {
            console.error("Content script rejected configuration:", response.reason);
            delete sessionData[tabId];
            updateIcon();
          } else {
            console.log("Event configuration successfully sent", response);
            updateIcon();
          }
        },
      );
    });
}

// End the event capture session and send captured events to the server
function endCaptureSession(tabId) {
  if (!sessionData[tabId]) return;
  console.log("Ending capture session for tab", tabId);
  
  // Set end time
  sessionData[tabId].endTime = Date.now();
  
  sendEventsToServer(tabId);
  delete sessionData[tabId];
  updateIcon();
}

// Configure event capture methods in the content script
extensionAPI.tabs.onCreated.addListener(async (tab) => {
  console.log("Tab created:", tab);
  await createNewCaptureSession(tab.id);
});

// When a tab is closed, send captured events to the server
extensionAPI.tabs.onRemoved.addListener((tabId) => {
  console.log("Tab removed:", tabId);
  endCaptureSession(tabId);
});

// When a tab is updated, send captured events to the server and create a new session
extensionAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, "URL:", tab.url);
    endCaptureSession(tabId);
    await createNewCaptureSession(tabId);
  }
});

extensionAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "event") {
    if (sessionData[sender.tab.id]) {
      sessionData[sender.tab.id].events.push(message.event);
    }
  } else if (message.type === "captureEnded") {
    console.log("Capture ended by timeout for tab", sender.tab.id);
    endCaptureSession(sender.tab.id);
  } else if (message.type === "getSessionCount") {
    sendResponse({ count: Object.keys(sessionData).length });
  } else if (message.type === "configUpdated") {
    console.log("Configuration updated, fetching new event config");
    // Reload event configuration when settings are updated
    fetchEventConfig().then(config => {
      eventConfig = config;
      console.log("Event configuration reloaded:", config);
    });
  } else if (message.type === "debugModeChanged") {
    // Notify all tabs about debug mode change
    extensionAPI.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        extensionAPI.tabs.sendMessage(tab.id, { type: "debugModeChanged", debugMode: message.debugMode });
      });
    });
  }
  return true; // Keep message channel open for async response
});

// ------------------ Server communication functions ------------------

// Get event configuration from the server
async function fetchEventConfig() {
    try {
        // Get server URL from storage - try both sync and local
        let result = await extensionAPI.storage.sync.get(['serverUrl']);
        
        if (!result || !result.serverUrl) {
            // Try local storage as fallback
            result = await extensionAPI.storage.local.get(['serverUrl']);
        }
        
        // If no server URL is configured, don't capture
        if (!result || !result.serverUrl) {
            console.log("No server URL configured, event capture disabled");
            return null;
        }
        
        const response = await fetch(`${result.serverUrl}/start`);
        const serverResponse = await response.json();
        console.log('Server response:', serverResponse);
        
        let eventConfig;
        if (serverResponse.data) {
            eventConfig = serverResponse.data;
        }else {
            console.error('Invalid server response structure:', serverResponse);
            return null;
        }
        
        // Validate the structure of the configuration
        if (!eventConfig.events || !Array.isArray(eventConfig.events)) {
            console.error('Invalid event config structure - missing or invalid events array:', eventConfig);
            return null;
        }
        
        console.log('Event config extracted:', eventConfig);
        return eventConfig;
    }
    catch (error) {
        console.error('Error fetching event config from server:', error);
        return null;
    }
}

// Send captured events to the server
async function sendEventsToServer(tabId) {
    const sessionInfo = sessionData[tabId];
    if (!sessionInfo) return;
    
    try {
        // Get server URL from storage - try both sync and local
        let result = await extensionAPI.storage.sync.get(['serverUrl']);
        if (!result || !result.serverUrl) {
            result = await extensionAPI.storage.local.get(['serverUrl']);
        }
        
        // If no server URL is configured, just log the data locally
        if (!result || !result.serverUrl) {
            console.log('No server URL configured. Session data (not sent):', sessionInfo);
            return;
        }
        
        const response = await fetch(`${result.serverUrl}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionInfo)
        });
        
        if (response.ok) {
            console.log('Events sent successfully to server');
        } else {
            console.error('Server returned error:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error sending events to server:', error);
        console.error('Session data that failed to send:', sessionInfo);
    }
}
