// Utilidades de generación aleatoria
const randomGenerators = {
  letter: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return letters[Math.floor(Math.random() * letters.length)];
  },
  
  number: () => {
    return Math.floor(Math.random() * 10).toString();
  },
};

// Anonimizadores por tipo de evento
const anonymizers = {
  keyboard: {
    key: (key, config) => {
      if (!config.key) return key;
      
      // Anonimizar letras individuales con letras aleatorias
      if (/^[a-zA-Z]$/.test(key)) {
        return randomGenerators.letter();
      }
      
      // Anonimizar números individuales con números aleatorios
      if (/^[0-9]$/.test(key)) {
        return randomGenerators.number();
      }
      
      // Todo lo demás se mantiene sin cambios (teclas especiales, combinaciones, etc.)
      return key;
    },
    code: (code, config) => {
      if (!config.code) return code;
      if (/^Key[A-Z]$/.test(code)) {
        return `Key${randomGenerators.letter()}`;
      }
      if (/^Digit[0-9]$/.test(code)) {
        return 'Digit' + randomGenerators.number();
      } 
      return code;
    },
  },

  mouse: {
    // Aquí se pueden agregar anonimizadores para eventos de mouse
  },

  browser: {
    url: (url, config) => {
      if (!config.url) return url;
      return "https://anonymized.com";
    }
  }
};

// Función principal de anonimización
function anonymizeEventValue(eventType, attribute, value, anonymizationConfig) {
  // Mapear tipos de evento a categorías de anonimización
  const eventTypeMapping = {
    'keydown': 'keyboard',
    'keyup': 'keyboard',
    'keypress': 'keyboard',
    'click': 'mouse',
    'mousedown': 'mouse',
    'mouseup': 'mouse',
    'mousemove': 'mouse',
  };
  
  const category = eventTypeMapping[eventType];
  
  if (category && anonymizers[category] && anonymizers[category][attribute]) {
    return anonymizers[category][attribute](value, anonymizationConfig);
  }
  
  return value;
};

// Exportar para uso en content_script.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { anonymizeEventValue, anonymizers, randomGenerators };
}
