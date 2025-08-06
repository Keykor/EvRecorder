# EvRecord

Browser extension that captures user interaction events during web browsing sessions for research and analysis purposes.

## Features
- Real-time event capturing (clicks, scrolls, keystrokes, mouse movements)
- Configurable event types and attributes
- URL and keystroke anonymization
- Session-based data collection with user-configured ID
- User-friendly configuration interface
- Real-time status monitoring

## Configuration

Events are configured through a JSON file with the following structure:

```json
{
  "timeout": 10000,
  "url": false,
  "events": [
    {
      "type": "click",
      "polling": false,
      "attributes": ["clientX", "clientY"]
    },
    {
      "type": "keydown",
      "polling": false,
      "attributes": ["key", "code"],
      "anonymization": {
        "key": true,
        "code": true
      }
    }
  ]
}
```

### Configuration Options
- **timeout**: Capture duration in milliseconds
- **url**: Enable URL anonymization (true = anonymize, false = capture full URL)
- **events**: Array of event configurations
  - **type**: Event type (`click`, `scroll`, `keydown`, `mousemove`)
  - **polling**: Use polling (true) or event listeners (false)
  - **interval**: Polling interval (when polling: true)
  - **attributes**: Event properties to capture
  - **anonymization**: Specify which attributes to anonymize

## Captured Data

Each session returns structured data with user-configured ID:

```json
{
  "userId": "user-configured-id",
  "tabId": 123,
  "url": "https://example.com",
  "startTime": 1640995200000,
  "endTime": 1640995210000,
  "events": [
    {
      "type": "click",
      "timestamp": 1640995201500,
      "clientX": 150,
      "clientY": 200,
      "windowWidth": 1920,
      "windowHeight": 1080,
    }
  ]
}
```

## Installation

1. Enable Developer mode in Chrome (`chrome://extensions/`)
2. Click "Load unpacked" and select the extension directory
3. Click the extension icon and select "Configurar Extensión"
4. Enter server URL and your user ID, then save
5. Visit any website to start capturing events

## User Interface

- **Popup**: Shows capture status and active sessions
- **Options Page**: Configure server URL and user-provided ID

## How It Works

1. Extension uses your configured user ID for all sessions
2. Extension automatically starts capturing when tabs are created/updated
3. Events are captured based on configuration settings
4. Data is stored per session and sent to server when session ends
5. Extension icon indicates active capture status

## Anonymization

- **URLs**: URLs can be hidden
- **Keystrokes**: Individual letters and numbers are randomized
- **Configurable**: Set per event type and attribute