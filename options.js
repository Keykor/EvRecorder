document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const saveButton = document.getElementById('saveConfig');
  const statusDiv = document.getElementById('status');

  // Cargar configuración guardada
  chrome.storage.sync.get(['serverUrl', 'userId'], function(result) {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    }
    if (result.userId) {
      userIdInput.value = result.userId;
    }
  });

  // Guardar configuración
  saveButton.addEventListener('click', function() {
    const serverUrl = serverUrlInput.value.trim();
    const userId = userIdInput.value.trim();

    if (!serverUrl || !userId) {
      showStatus('Por favor complete todos los campos', 'error');
      return;
    }

    // Validar URL
    try {
      new URL(serverUrl);
    } catch (e) {
      showStatus('Por favor ingrese una URL válida', 'error');
      return;
    }

    // Guardar en storage
    chrome.storage.sync.set({
      serverUrl: serverUrl,
      userId: userId
    }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Error al guardar la configuración', 'error');
      } else {
        showStatus('Configuración guardada exitosamente', 'success');
        // Notificar al background script
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
