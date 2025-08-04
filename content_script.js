// Variable global para configuración de anonimización (simplificada)
let browserAnonymization = {};

// Función que captura los eventos y los envía al background.js
function captureMethods(eventConfig) {
  // Actualizar configuración de anonimización si viene en eventConfig
  if (eventConfig.anonymization) {
    browserAnonymization = { ...browserAnonymization, ...eventConfig.anonymization };
  }

  let eventListeners = [];

  // Guarda el evento en un array y lo envía al background.js
  function captureEvent(eventType, attributes, eventData, anonymization) {
    console.log("Capturing event", eventType);

    let capturedData = {};

    // Guardar el tipo de evento
    capturedData.type = eventType;
    capturedData.attributes = {};

    // Guardar los atributos del evento que se encuentran en la configuración
    if (attributes) {
      attributes.forEach((attribute) => {
        let value = eventData[attribute];
        if (value) {
          if (anonymization && anonymization[attribute]) {
            value = anonymizeEventValue(eventType, attribute, value, anonymization);
          }
          capturedData.attributes[attribute] = value;
        }
      });
    }

    // Añade el timestamp del evento
    capturedData.timestamp = new Date().getTime();

    // Añade información del navegador
    capturedData.browser = {};
    capturedData.browser.windowWidth = window.innerWidth;
    capturedData.browser.windowHeight = window.innerHeight;
    capturedData.browser.viewportWidth = document.documentElement.clientWidth;
    capturedData.browser.viewportHeight = document.documentElement.clientHeight;
    capturedData.browser.scrollX = window.scrollX || 0;
    capturedData.browser.scrollY = window.scrollY || 0;

    capturedData.browser.url = anonymizers.browser.url(window.location.href, browserAnonymization);

    chrome.runtime.sendMessage({ type: "event", event: capturedData });
  }

  // Configura el polling de eventos
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
        // Enviar el último evento capturado
        captureEvent(eventName, attributes, lastEvent[eventName], anonymization);
        // Reiniciar el evento
        lastEvent[eventName] = null;
      }
    }, pollingInterval || 1000);

    // Guardar el intervalID para poder limpiarlo después
    pollingIntervals.push(intervalID);
  }

  // Configura la captura de cada evento en la configuración
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

  // Guardar el timeoutID para poder deternerlo después
  let timeoutId;

  // Detener la captura de eventos, listeners e intervalos
  function stopCapturing() {
    console.log("Stopping event capturing...");

    // Eliminar todos los event listeners
    eventListeners.forEach(({ eventName, handler }) => {
      document.removeEventListener(eventName, handler, true);
    });

    // Detener todos los intervalos de polling
    pollingIntervals.forEach(clearInterval);

    // Detener el timeout
    clearTimeout(timeoutId);

    // Notificar al background script que la captura ha terminado
    chrome.runtime.sendMessage({ type: "captureEnded" });
  }

  // Configurar el timeout para detener la captura
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
  if (!isHttpOrHttps(window.location.href)) {
    console.log("Content script ignoring non-HTTP/HTTPS page:", window.location.href);
    sendResponse({ success: false, reason: "Non-HTTP/HTTPS page ignored" });
    return;
  }

  if (message.type === "captureMethods") {
    console.log("Event configuration received", message.config);
    captureMethods(message.config);
    sendResponse({ success: true });
  }
});