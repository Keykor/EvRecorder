// Mantiene los datos de sesión de cada pestaña
let sessionData = {};

// Configuración de eventos
const eventConfig = fetchEventConfig();

// Crea una nueva sesión de captura de eventos si hay una configuración de eventos
function createNewCaptureSession(tabId) {
    if (!eventConfig) return;
    sessionData[tabId] = [];
    chrome.tabs.sendMessage(tabId, { type: "configureCaptureMethods", config: eventConfig });
}

// Finaliza la sesión de captura de eventos y envía los eventos capturados al servidor
function endCaptureSession(tabId) {
    if (!sessionData[tabId]) return;
    sendEventsToServer(tabId);
    delete sessionData[tabId];
}

// Configura los métodos de captura de eventos en el content script
chrome.tabs.onCreated.addListener(async (tab) => {
    createNewCaptureSession(tab.id);
});

// Cuando se cierra una pestaña, envía los eventos capturados al servidor
chrome.tabs.onRemoved.addListener((tabId) => {
    endCaptureSession(tabId)
});

// Cuando se actualiza una pestaña, envía los eventos capturados al servidor y crea una nueva sesión
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        endCaptureSession(tabId);
        createNewCaptureSession(tabId);
    }
});


// ------------------ Funciones de comunicación con servidores ------------------

// Obtiene la configuración de eventos desde el servidor
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

// Envía los eventos capturados al servidor
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