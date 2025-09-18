// ==========================================
// INITIALIZATION AND CONFIGURATION
// ==========================================

// Cross-browser compatibility
const extensionAPI = typeof browser !== 'undefined' ? browser : chrome;

// Global state
let sessionData = {};
let eventConfig = null;

// Open options page on installation
extensionAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    extensionAPI.runtime.openOptionsPage();
  }
});

// Initialize configuration when loading the extension
(async () => {
  try {
    eventConfig = await fetchEventConfig();
    console.log("Initial event configuration loaded:", eventConfig);
  } catch (error) {
    console.error("Error loading initial event configuration:", error);
  }
})();

// ==========================================
// UTILITY FUNCTIONS AND HELPERS
// ==========================================

// Helper function to promisify storage API
function getStorageData(keys, useLocal = false) {
  return new Promise((resolve, reject) => {
    const storage = useLocal ? extensionAPI.storage.local : extensionAPI.storage.sync;
    storage.get(keys, (result) => {
      if (extensionAPI.runtime.lastError) {
        reject(new Error(extensionAPI.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// Helper function to get data from sync storage with local fallback
async function getStorageWithFallback(keys) {
  try {
    const result = await getStorageData(keys, false); // Try sync first
    if (result && Object.keys(result).length > 0) {
      return result;
    }
  } catch (error) {
    console.log('Sync storage failed, trying local storage:', error.message);
  }

  try {
    return await getStorageData(keys, true); // Fallback to local
  } catch (error) {
    console.error('Both sync and local storage failed:', error.message);
    return {};
  }
}

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

  // Use action API instead of browserAction for Manifest V3
  if (extensionAPI.action) {
    extensionAPI.action.setIcon({ path: iconPath });
  } else if (extensionAPI.browserAction) {
    // Fallback for older browsers
    extensionAPI.browserAction.setIcon({ path: iconPath });
  }
}

// ==========================================
// SESSION MANAGEMENT FUNCTIONS
// ==========================================

// Create a new event capture session if there is an event configuration
async function createNewCaptureSession(tabId) {
  try {
    // If no config available, try to fetch it
    if (!eventConfig) {
      console.log("No event config available, trying to fetch from server");
      eventConfig = await fetchEventConfig();
    }

    if (!eventConfig || !eventConfig.events || !Array.isArray(eventConfig.events)) {
      console.log("No valid event configuration available, session creation skipped for tab", tabId);
      return;
    }

    console.log("Creating new capture session for tab", tabId);

    // Get stored user ID with proper async handling
    const userResult = await getStorageWithFallback(['userId']);

    if (!userResult || !userResult.userId) {
      console.error("No user ID configured in storage");
      return;
    }

    await proceedWithSession(userResult.userId, tabId);
  } catch (error) {
    console.error("Error creating capture session:", error);
  }
}

// Continue with session creation after validation
async function proceedWithSession(userId, tabId) {
  try {
    // Get tab info with Promise wrapper
    const tab = await new Promise((resolve, reject) => {
      extensionAPI.tabs.get(tabId, (tab) => {
        if (extensionAPI.runtime.lastError) {
          reject(new Error(extensionAPI.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });

    // Apply URL anonymization if configured
    const finalUrl = anonymizeUrl(tab.url || '', eventConfig?.url);

    sessionData[tabId] = {
      userId: userId,
      tabId: tabId,
      url: finalUrl,
      startTime: Date.now(),
      endTime: null,
      events: []
    };

    // Send message to content script with Promise wrapper
    const response = await new Promise((resolve, reject) => {
      extensionAPI.tabs.sendMessage(
        tabId,
        { type: "captureMethods", config: eventConfig },
        (response) => {
          if (extensionAPI.runtime.lastError) {
            reject(new Error(extensionAPI.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response && !response.success) {
      console.error("Content script rejected configuration:", response.reason);
      delete sessionData[tabId];
    } else {
      console.log("Event configuration successfully sent", response);
    }

    updateIcon();
  } catch (error) {
    console.error("Error in proceedWithSession:", error);
    delete sessionData[tabId];
    updateIcon();
  }
}

// End the event capture session and send captured events to the server
function endCaptureSession(tabId) {
  if (!sessionData[tabId]) return;
  console.log("Ending capture session for tab", tabId);

  // Set end time to now (normal closure - user might be inactive)
  sessionData[tabId].endTime = Date.now();

  sendEventsToServer(tabId);
  delete sessionData[tabId];
  updateIcon();
}

// ==========================================
// SERVER COMMUNICATION FUNCTIONS
// ==========================================

// Get event configuration from the server
async function fetchEventConfig() {
    try {
        // Get server URL from storage with proper async handling
        const result = await getStorageWithFallback(['serverUrl']);

        // If no server URL is configured, don't capture
        if (!result || !result.serverUrl) {
            console.log("No server URL configured, event capture disabled");
            return null;
        }

        const response = await fetch(`${result.serverUrl}/start`);

        if (!response.ok) {
            console.error('Server request failed:', response.status, response.statusText);
            return null;
        }

        let serverResponse;
        try {
            serverResponse = await response.json();
        } catch (error) {
            console.error('Invalid JSON response from server:', error);
            return null;
        }
        console.log('Server response:', serverResponse);

        let eventConfig;
        if (serverResponse.data) {
            eventConfig = serverResponse.data;
        } else {
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
        // Get server URL from storage with proper async handling
        const result = await getStorageWithFallback(['serverUrl']);

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

// ==========================================
// MESSAGE HANDLERS
// ==========================================

// Handle configuration update requests
async function handleConfigUpdate() {
  console.log("Configuration updated, fetching new event config");
  try {
    eventConfig = await fetchEventConfig();
    console.log("Event configuration reloaded:", eventConfig);
  } catch (error) {
    console.error("Error reloading event configuration:", error);
  }
}

// Handle debug mode changes across all tabs
async function handleDebugModeChange(debugMode) {
  try {
    const tabs = await new Promise((resolve, reject) => {
      extensionAPI.tabs.query({}, (tabs) => {
        if (extensionAPI.runtime.lastError) {
          reject(new Error(extensionAPI.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });

    // Send debug mode change to all tabs
    const messagePromises = tabs.map(tab =>
      new Promise((resolve) => {
        extensionAPI.tabs.sendMessage(
          tab.id,
          { type: "debugModeChanged", debugMode: debugMode },
          (response) => {
            // Don't reject on individual tab failures - tab might be closed
            if (extensionAPI.runtime.lastError) {
              console.log(`Failed to send debug mode to tab ${tab.id}:`, extensionAPI.runtime.lastError.message);
            }
            resolve();
          }
        );
      })
    );

    await Promise.all(messagePromises);
    console.log("Debug mode change sent to all tabs");
  } catch (error) {
    console.error("Error updating debug mode across tabs:", error);
  }
}

// Handle incoming messages from content scripts and other components
function handleMessage(message, sender, sendResponse) {
  if (message.type === "event") {
    if (sender.tab && sessionData[sender.tab.id]) {
      sessionData[sender.tab.id].events.push(message.event);
    }
  } else if (message.type === "captureEnded") {
    if (sender.tab) {
      console.log("Capture ended by timeout for tab", sender.tab.id);
      endCaptureSession(sender.tab.id);
    }
  } else if (message.type === "getSessionCount") {
    sendResponse({ count: Object.keys(sessionData).length });
  } else if (message.type === "configUpdated") {
    handleConfigUpdate();
  } else if (message.type === "debugModeChanged") {
    handleDebugModeChange(message.debugMode);
  }
  return true; // Keep message channel open for async response
}

// ==========================================
// STORAGE BACKUP FUNCTIONS
// ==========================================

// Backup sessionData to storage every 1 minute
setInterval(() => {
  // Validate sessionData before backup
  if (!sessionData || typeof sessionData !== 'object') {
    console.warn('Invalid sessionData object, skipping backup');
    return;
  }

  const activeSessions = Object.keys(sessionData).length;

  if (activeSessions > 0) {
    // Count total events for logging
    const totalEvents = Object.values(sessionData).reduce((total, session) => {
      return total + (session.events ? session.events.length : 0);
    }, 0);

    // Validate each session before backup
    const validSessions = {};
    let validCount = 0;

    Object.entries(sessionData).forEach(([tabId, session]) => {
      if (session && session.userId && session.startTime && Array.isArray(session.events)) {
        validSessions[tabId] = session;
        validCount++;
      } else {
        console.warn(`Invalid session data for tab ${tabId}, excluding from backup`);
      }
    });

    if (validCount > 0) {
      // Save valid sessionData to storage, replacing previous
      extensionAPI.storage.local.set({
        backupSessionData: validSessions
      }, () => {
        if (extensionAPI.runtime.lastError) {
          console.error('Error backing up session data:', extensionAPI.runtime.lastError);
        } else {
          console.log(`Backup: ${validCount} sessions, ${totalEvents} total events saved to storage`);
        }
      });
    } else {
      console.warn('No valid sessions to backup');
    }
  } else {
    // No active sessions, clear storage
    extensionAPI.storage.local.remove(['backupSessionData'], () => {
      if (extensionAPI.runtime.lastError) {
        console.error('Error clearing backup storage:', extensionAPI.runtime.lastError);
      } else {
        console.log('No active sessions, cleared backup storage');
      }
    });
  }
}, 60000); // 1 minute = 60,000ms

// On extension startup, check for backup data and send it
(async () => {
  try {
    const result = await new Promise((resolve) => {
      extensionAPI.storage.local.get(['backupSessionData'], resolve);
    });

    if (result.backupSessionData && Object.keys(result.backupSessionData).length > 0) {
      console.log('Found backup session data, sending to server...');

      // Send each session from backup
      for (const [tabId, sessionInfo] of Object.entries(result.backupSessionData)) {
        // Validate backup session before sending
        if (!sessionInfo || !sessionInfo.userId || !sessionInfo.startTime || !Array.isArray(sessionInfo.events)) {
          console.error(`Invalid backup session for tab ${tabId}, skipping`);
          continue;
        }

        // Set end time to last event timestamp, or startTime if no events
        if (sessionInfo.events.length > 0) {
          const lastEvent = sessionInfo.events[sessionInfo.events.length - 1];
          sessionInfo.endTime = lastEvent.timestamp;
        } else {
          sessionInfo.endTime = sessionInfo.startTime;
        }

        try {
          // Use existing sendEventsToServer logic but with direct session info
          const serverResult = await getStorageWithFallback(['serverUrl']);
          if (serverResult && serverResult.serverUrl) {
            const response = await fetch(`${serverResult.serverUrl}/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sessionInfo)
            });

            if (response.ok) {
              console.log(`Successfully sent backup session for tab ${tabId} (${sessionInfo.events.length} events)`);
            } else {
              console.error(`Server error for backup session ${tabId}:`, response.status, response.statusText);
            }
          }
        } catch (error) {
          console.error(`Error sending backup session ${tabId}:`, error);
        }
      }

      // Clear backup after sending
      extensionAPI.storage.local.remove(['backupSessionData'], () => {
        console.log('Backup data sent and cleared');
      });
    }
  } catch (error) {
    console.error('Error processing backup data on startup:', error);
  }
})();

// ==========================================
// EVENT LISTENERS
// ==========================================

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

// Handle messages from content scripts and other components
extensionAPI.runtime.onMessage.addListener(handleMessage);