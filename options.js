// Cross-browser compatibility
const extensionAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const saveButton = document.getElementById('saveConfig');
  const debugButton = document.getElementById('debugButton');
  const statusDiv = document.getElementById('status');

  // Load saved configuration
  extensionAPI.storage.sync.get(['serverUrl', 'userId'], function(result) {
    if (extensionAPI.runtime.lastError) {
      console.error('Error loading configuration:', extensionAPI.runtime.lastError);
      return;
    }
    if (result && result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    }
    if (result && result.userId) {
      userIdInput.value = result.userId;
    }
  });

  // Initialize debug button
  updateDebugButton();

  // Save configuration
  saveButton.addEventListener('click', function() {
    const serverUrl = serverUrlInput.value.trim();
    const userId = userIdInput.value.trim();

    if (!serverUrl || !userId) {
      showStatus('Please complete all fields', 'error');
      return;
    }

    // Validate URL
    try {
      new URL(serverUrl);
    } catch (e) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }

    // Save to storage
    const config = { serverUrl: serverUrl, userId: userId };
    
    // Save to both sync and local storage for better compatibility
    extensionAPI.storage.sync.set(config, function() {
      if (extensionAPI.runtime.lastError) {
        console.error('Storage sync error:', extensionAPI.runtime.lastError);
      } else {
      }
    });
    
    extensionAPI.storage.local.set(config, function() {
      if (extensionAPI.runtime.lastError) {
        console.error('Storage local error:', extensionAPI.runtime.lastError);
        showStatus('Error saving configuration: ' + extensionAPI.runtime.lastError.message, 'error');
      } else {
        showStatus('Configuration saved successfully', 'success');
        // Notify background script
        extensionAPI.runtime.sendMessage({ type: 'configUpdated' });
      }
    });
  });

  // Debug button - toggle debug mode
  if (debugButton) {
    debugButton.addEventListener('click', function() {
      extensionAPI.storage.sync.get(['debugMode'], function(result) {
        if (extensionAPI.runtime.lastError) {
          console.error('Error reading debug mode:', extensionAPI.runtime.lastError);
          showStatus('Error reading debug mode', 'error');
          return;
        }
        const newDebugMode = !(result && result.debugMode);
        extensionAPI.storage.sync.set({ debugMode: newDebugMode }, function() {
          if (extensionAPI.runtime.lastError) {
            console.error('Error saving debug mode:', extensionAPI.runtime.lastError);
            showStatus('Error saving debug mode', 'error');
          } else {
            updateDebugButton();
            showStatus(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`, 'success');
            // Notify background script and content scripts about debug mode change
            extensionAPI.runtime.sendMessage({ type: 'debugModeChanged', debugMode: newDebugMode });
          }
        });
      });
    });
  }

  function updateDebugButton() {
    if (!debugButton) return;
    
    extensionAPI.storage.sync.get(['debugMode'], function(result) {
      if (extensionAPI.runtime.lastError) {
        console.error('Error reading debug mode for button update:', extensionAPI.runtime.lastError);
        return;
      }
      const isDebugMode = (result && result.debugMode) || false;
      debugButton.textContent = `Debug Mode: ${isDebugMode ? 'ON' : 'OFF'}`;
      debugButton.className = isDebugMode ? 'debug-button active' : 'debug-button';
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 4000);
  }
});
