// Función que captura los eventos y los envía al background.js
function captureMethods(eventConfig) {
  // Guarda el evento en un array y lo envía al background.js
  function captureEvent(eventType, attributes, eventData) {
    let capturedData = {};

    // Guardar el tipo de evento
    capturedData.type = eventType;
    capturedData.attributes = {};

    // Guardar los atributos del evento que se encuentran en la configuración
    if (attributes) {
      attributes.forEach((attribute) => {
        if (eventData[attribute]) {
          capturedData.attributes[attribute] = eventData[attribute];
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

    chrome.runtime.sendMessage({ type: "event", event: capturedData });
  }

  // Configura el polling de eventos
  let lastEvent = {};
  function configurePolling(eventName, pollingInterval, attributes) {
    lastEvent[eventName] = null;

    document.addEventListener(
      eventName,
      (e) => {
        // Guardar el último evento capturado
        console.log("Capturing event", eventName);
        lastEvent[eventName] = e;
      },
      true,
    );

    setInterval(() => {
      if (lastEvent[eventName]) {
        // Enviar el último evento capturado
        captureEvent(eventName, attributes, lastEvent[eventName]);
        // Reiniciar el evento
        lastEvent[eventName] = null;
      }
    }, pollingInterval || 1000);
  }

  // Configura la captura de cada evento en la configuración
  eventConfig.events.forEach((event) => {
    if (!event.polling) {
      document.addEventListener(
        event.type,
        (e) => {
          captureEvent(event.type, event.attributes, e);
        },
        true,
      );
    } else {
      configurePolling(event.type, event.interval, event.attributes);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "captureMethods") {
    console.log("Event configuration received", message.config);
    captureMethods(message.config);
  }
  return true;
});
