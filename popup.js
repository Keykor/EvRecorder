document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const saveButton = document.getElementById('saveConfig');
  const statusDiv = document.getElementById('status');
  const configureButton = document.getElementById('configureButton');
  const captureStatusElement = document.getElementById('captureStatus');
  const configStatusElement = document.getElementById('configStatus');
  const sessionsCountElement = document.getElementById('sessionsCount');

  // Initialize status display
  updateStatus();

  // Configure button - open options page
  if (configureButton) {
    configureButton.addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  }

  // Load saved configuration for form (if elements exist)
  if (serverUrlInput && userIdInput) {
    chrome.storage.sync.get(['serverUrl', 'userId'], function(result) {
      if (result.serverUrl) {
        serverUrlInput.value = result.serverUrl;
      }
      if (result.userId) {
        userIdInput.value = result.userId;
      }
    });
  }

  // Save configuration (if save button exists)
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      const serverUrl = serverUrlInput.value.trim();
      const userId = userIdInput.value.trim();

      if (!serverUrl || !userId) {
        showStatus('Por favor complete todos los campos', 'error');
        return;
      }

      // Validate URL
      try {
        new URL(serverUrl);
      } catch (e) {
        showStatus('Por favor ingrese una URL válida', 'error');
        return;
      }

      // Save to storage
      chrome.storage.sync.set({
        serverUrl: serverUrl,
        userId: userId
      }, function() {
        if (chrome.runtime.lastError) {
          showStatus('Error al guardar la configuración', 'error');
        } else {
          showStatus('Configuración guardada exitosamente', 'success');
          // Notify background script
          chrome.runtime.sendMessage({ type: 'configUpdated' });
          // Update status display
          updateStatus();
        }
      });
    });
  }

  function updateStatus() {
    // Check configuration status
    chrome.storage.sync.get(['serverUrl', 'userId'], function(result) {
      const isConfigured = result.serverUrl && result.userId;
      
      if (configStatusElement) {
        configStatusElement.textContent = isConfigured ? 'Configurado' : 'No configurado';
        configStatusElement.className = isConfigured ? 'status-value status-configured' : 'status-value status-not-configured';
      }
    });

    // Get active sessions from background script
    chrome.runtime.sendMessage({ type: 'getSessionCount' }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Could not get session count:', chrome.runtime.lastError.message);
        return;
      }
      
      const sessionCount = response ? response.count : 0;
      const isCapturing = sessionCount > 0;
      
      if (captureStatusElement) {
        captureStatusElement.textContent = isCapturing ? 'Capturando' : 'Detenido';
        captureStatusElement.className = isCapturing ? 'status-value status-capturing' : 'status-value status-stopped';
      }
      
      if (sessionsCountElement) {
        sessionsCountElement.textContent = `Sesiones activas: ${sessionCount}`;
      }
    });
  }

  function showStatus(message, type) {
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
      statusDiv.style.display = 'block';
      
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }
});
