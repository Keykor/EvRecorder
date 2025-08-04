// Mantiene los datos de sesión de cada pestaña
let sessionData = {};

// Función para actualizar el icono de la extensión
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

// Configuración de eventos
const eventConfig = fetchEventConfig();

// Crea una nueva sesión de captura de eventos si hay una configuración de eventos
function createNewCaptureSession(tabId) {
  if (!eventConfig) return;
  console.log("Creating new capture session for tab", tabId);
  sessionData[tabId] = [];
  
  updateIcon();
  
  chrome.tabs.sendMessage(
    tabId,
    { type: "captureMethods", config: eventConfig },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending event configuration to new session:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.log("Event configuration successfully sent", response);
      }
    },
  );
}

// Finaliza la sesión de captura de eventos y envía los eventos capturados al servidor
function endCaptureSession(tabId) {
  if (!sessionData[tabId]) return;
  console.log("Ending capture session for tab", tabId);
  sendEventsToServer(tabId);
  delete sessionData[tabId];

  updateIcon();
}

// Configura los métodos de captura de eventos en el content script
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log("Tab created:", tab);
  createNewCaptureSession(tab.id);
});

// Cuando se cierra una pestaña, envía los eventos capturados al servidor
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log("Tab removed:", tabId);
  endCaptureSession(tabId);
});

// Cuando se actualiza una pestaña, envía los eventos capturados al servidor y crea una nueva sesión
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId);
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
  }
});

// ------------------ Funciones de comunicación con servidores ------------------

// Obtiene la configuración de eventos desde el servidor
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
*/

// ------------------ Funciones de prueba ------------------

function fetchEventConfig() {
  console.log("Fetching event configuration from server");
  return {
    timeout: 10000,
    events: [
      {
        type: "click",
        polling: false,
        attributes: ["clientX", "clientY"],
      },
      {
        type: "scroll",
        polling: true,
        interval: 100,
      },
      {
        type: "keydown",
        polling: false,
        attributes: ["key", "code"],
      },
      {
        type: "mousemove",
        polling: true,
        interval: 100,
        attributes: ["screenX", "screenY"],
      },
    ],
  };
}

function sendEventsToServer(tabId) {
  console.log("Sending events to server:", sessionData[tabId]);
}
