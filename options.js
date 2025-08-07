document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const saveButton = document.getElementById('saveConfig');
  const debugButton = document.getElementById('debugButton');
  const statusDiv = document.getElementById('status');

  // Load saved configuration
  chrome.storage.sync.get(['serverUrl', 'userId'], function(result) {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    }
    if (result.userId) {
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
    chrome.storage.sync.set({
      serverUrl: serverUrl,
      userId: userId
    }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Error saving configuration', 'error');
      } else {
        showStatus('Configuration saved successfully', 'success');
        // Notify background script
        chrome.runtime.sendMessage({ type: 'configUpdated' });
      }
    });
  });

  // Debug button - toggle debug mode
  if (debugButton) {
    debugButton.addEventListener('click', function() {
      chrome.storage.sync.get(['debugMode'], function(result) {
        const newDebugMode = !result.debugMode;
        chrome.storage.sync.set({ debugMode: newDebugMode }, function() {
          updateDebugButton();
          showStatus(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`, 'success');
          // Notify background script and content scripts about debug mode change
          chrome.runtime.sendMessage({ type: 'debugModeChanged', debugMode: newDebugMode });
        });
      });
    });
  }

  function updateDebugButton() {
    if (!debugButton) return;
    
    chrome.storage.sync.get(['debugMode'], function(result) {
      const isDebugMode = result.debugMode || false;
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
