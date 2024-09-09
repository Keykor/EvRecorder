// Función que captura los eventos y los envía al background.js
function captureMethods(eventConfig) {

    // Guarda el evento en un array y lo envía al background.js
    function captureEvent(event) {
        const eventData = {
            type: event.type,
            timeStamp: event.timeStamp,
            x: event.clientX || null,
            y: event.clientY || null,
            key: event.key || null,
            button: event.button || null,
            scrollY: window.scrollY || null
        };
        chrome.runtime.sendMessage({ type: 'event', event: eventData });
    }

    // Configura el polling de eventos
    let lastEvent = {}
    function configurePolling(eventName, pollingInterval) {
        lastEvent[eventName] = null;

        document.addEventListener(eventName, (e) => {
            // Guardar el último evento capturado
            lastEvent[eventName] = e;
        });

        setInterval(() => {
            if (lastEvent[eventName]) {
                // Enviar el último evento capturado
                captureEvent(lastEvent[eventName]);
                // Reiniciar el evento
                lastEvent[eventName] = null;
            }
        }, pollingInterval || 1000);
    }

    // Configura la captura de cada evento en la configuración
    eventConfig.events.forEach(event => {
        if (!event.polling) {
            document.addEventListener(event.type, captureEvent);
        }
        else {
            configurePolling(event.type, event.interval);
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
