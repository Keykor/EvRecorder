document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const saveButton = document.getElementById('saveConfig');
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

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 4000);
  }
});
