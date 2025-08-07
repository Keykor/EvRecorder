// Debug logging functionality
let debugMode = false;

// Initialize debug mode from storage
chrome.storage.sync.get(['debugMode'], function(result) {
  debugMode = result.debugMode || false;
});

// Conditional logging function
function debugLog(...args) {
  if (debugMode) {
    console.log('[EvRecorder Debug]', ...args);
  }
}

// Function that captures events and sends them to background.js
function captureMethods(eventConfig) {
  // Validate that eventConfig exists and has events array
  if (!eventConfig) {
    debugLog("No event configuration provided");
    return;
  }
  
  if (!eventConfig.events || !Array.isArray(eventConfig.events)) {
    debugLog("Invalid event configuration: events array is missing or invalid", eventConfig);
    return;
  }
  
  let eventListeners = [];

  // Save the event in an array and send it to background.js
  function captureEvent(eventType, attributes, eventData, anonymization) {
    debugLog("Capturing event", eventType);

    let capturedData = {};

    // Save the event type
    capturedData.type = eventType;

    // Save the event attributes that are found in the configuration
    if (attributes) {
      attributes.forEach((attribute) => {
        let value = eventData[attribute];
        if (value) {
          if (anonymization && anonymization[attribute]) {
            value = anonymizeEventValue(eventType, attribute, value, anonymization);
          }
          capturedData[attribute] = value;
        }
      });
    }

    // Add event timestamp
    capturedData.timestamp = new Date().getTime();

    // Add browser information directly to the event object
    capturedData.windowWidth = window.innerWidth;
    capturedData.windowHeight = window.innerHeight;
    capturedData.viewportWidth = document.documentElement.clientWidth;
    capturedData.viewportHeight = document.documentElement.clientHeight;
    capturedData.scrollX = window.scrollX || 0;
    capturedData.scrollY = window.scrollY || 0;

    chrome.runtime.sendMessage({ type: "event", event: capturedData });
  }

  // Configure event polling
  let lastEvent = {};
  let pollingIntervals = [];
  function configurePolling(eventName, pollingInterval, attributes, anonymization) {
    lastEvent[eventName] = null;

    const eventHandler = (e) => {
      lastEvent[eventName] = e;
    };

    document.addEventListener(eventName, eventHandler, true);
    eventListeners.push({ eventName, handler: eventHandler });

    const intervalID = setInterval(() => {
      if (lastEvent[eventName]) {
        // Send the last captured event
        captureEvent(eventName, attributes, lastEvent[eventName], anonymization);
        // Reset the event
        lastEvent[eventName] = null;
      }
    }, pollingInterval || 1000);

    // Save the intervalID to be able to clear it later
    pollingIntervals.push(intervalID);
  }

  // Configure capture for each event in the configuration
  eventConfig.events.forEach((event) => {
    if (!event.polling) {
      const eventHandler = (e) => {
        captureEvent(event.type, event.attributes, e, event.anonymization);
      };
      document.addEventListener(event.type, eventHandler, true);
      eventListeners.push({ eventName: event.type, handler: eventHandler });
    } else {
      configurePolling(event.type, event.interval, event.attributes, event.anonymization);
    }
  });

  // Save the timeoutID to be able to stop it later
  let timeoutId;

  // Stop event capturing, listeners and intervals
  function stopCapturing() {
    debugLog("Stopping event capturing...");

    // Remove all event listeners
    eventListeners.forEach(({ eventName, handler }) => {
      document.removeEventListener(eventName, handler, true);
    });

    // Stop all polling intervals
    pollingIntervals.forEach(clearInterval);

    // Stop the timeout
    clearTimeout(timeoutId);

    // Notify background script that capture has ended
    chrome.runtime.sendMessage({ type: "captureEnded" });
  }

  // Configure timeout to stop capture
  if (eventConfig.timeout) {
    timeoutId = setTimeout(() => {
      stopCapturing();
    }, eventConfig.timeout);
  }
}

function isHttpOrHttps(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'debugModeChanged') {
    debugMode = message.debugMode;
    return;
  }

  if (!isHttpOrHttps(window.location.href)) {
    debugLog("Content script ignoring non-HTTP/HTTPS page:", window.location.href);
    sendResponse({ success: false, reason: "Non-HTTP/HTTPS page ignored" });
    return;
  }

  if (message.type === "captureMethods") {
    debugLog("Event configuration received", message.config);
    
    if (!message.config) {
      debugLog("No configuration provided in message");
      sendResponse({ success: false, reason: "No configuration provided" });
      return;
    }
    
    captureMethods(message.config);
    sendResponse({ success: true });
  }
});