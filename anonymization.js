// Random generation utilities
const randomGenerators = {
  letter: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return letters[Math.floor(Math.random() * letters.length)];
  },
  
  number: () => {
    return Math.floor(Math.random() * 10).toString();
  },
};

// Anonymizers by event type
const anonymizers = {
  keyboard: {
    key: (key, config) => {
      if (!config.key) return key;
      
      // Anonymize individual letters with random letters
      if (/^[a-zA-Z]$/.test(key)) {
        return randomGenerators.letter();
      }
      
      // Anonymize individual numbers with random numbers
      if (/^[0-9]$/.test(key)) {
        return randomGenerators.number();
      }
      
      // Everything else remains unchanged (special keys, combinations, etc.)
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
    // Mouse event anonymizers can be added here
  },
};

// Main anonymization function
function anonymizeEventValue(eventType, attribute, value, anonymizationConfig) {
  // Map event types to anonymization categories
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

// Export for use in content_script.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { anonymizeEventValue, anonymizers, randomGenerators };
}
