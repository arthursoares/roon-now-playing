# Home Assistant Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Home Assistant custom integration that discovers and controls roon-now-playing display screens.

**Architecture:** WebSocket-based integration exposing named screens as HA devices with select entities for layout/font/background/zone control and a binary sensor for connection status.

**Tech Stack:** Python, Home Assistant Custom Component, aiohttp (WebSocket client)

---

## Overview

A custom Home Assistant integration that connects to a roon-now-playing server and exposes named display screens as controllable entities.

### Core Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Home Assistant    │         │  roon-now-playing    │
│                     │   WS    │      server          │
│  ┌───────────────┐  │◄───────►│                      │
│  │ Coordinator   │  │         │  /ws?admin=true      │
│  │ (WebSocket)   │  │         │  /api/admin/clients  │
│  └───────┬───────┘  │         │  /api/admin/zones    │
│          │          │         └──────────────────────┘
│  ┌───────▼───────┐  │
│  │   Entities    │  │
│  │ - Selects     │  │
│  │ - Binary Sen. │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Key Design Decisions

- Only screens with friendly names become HA entities (prevents clutter)
- WebSocket connection for real-time state updates
- Manual server URL configuration (mDNS discovery can be added later)
- 5 entities per screen: layout, font, background, zone (selects) + connected (binary sensor)

### Integration Flow

1. User adds integration, enters server URL
2. Integration connects via WebSocket
3. Named screens appear as devices with entities
4. Changing a select calls the push API to update the screen
5. Screen connects/disconnects update binary sensor instantly

---

## Entity Structure

### Device Representation

Each named screen becomes a Home Assistant **device** with 5 entities:

```
Device: "Kitchen Display"
├── select.kitchen_display_layout      (detailed, minimal, basic, etc.)
├── select.kitchen_display_font        (system, inter, roboto, etc.)
├── select.kitchen_display_background  (black, white, dominant, etc.)
├── select.kitchen_display_zone        (Living Room, Office, etc.)
└── binary_sensor.kitchen_display_connected  (on/off)
```

### Entity Naming

- Device name comes from `friendlyName` in roon-now-playing
- Entity IDs are slugified: "Kitchen Display" → `kitchen_display`
- Unique ID uses the clientId from roon-now-playing for stability

### Select Options

The integration fetches available options from the server:

- **Layouts**: From `LAYOUTS` constant (detailed, minimal, fullscreen, ambient, cover, facts-columns, facts-overlay, facts-carousel, basic)
- **Fonts**: From `FONTS` constant (system, inter, roboto, etc.)
- **Backgrounds**: From `BACKGROUNDS` constant (black, white, dominant, gradient-radial, etc.)
- **Zones**: From `/api/admin/zones` endpoint (dynamic, updates when Roon zones change)

### State Mapping

| roon-now-playing field | HA Entity |
|------------------------|-----------|
| `friendlyName` | Device name |
| `clientId` | Unique ID |
| `layout` | select state |
| `font` | select state |
| `background` | select state |
| `zoneId` / `zoneName` | select state |
| WebSocket connected | binary_sensor state |

---

## WebSocket Communication

### Connection Management

The integration maintains a persistent WebSocket connection to `/ws?admin=true`. The coordinator handles:

- Initial connection on integration load
- Automatic reconnection on disconnect (with exponential backoff)
- Graceful shutdown when integration is removed

### Message Flow

**Incoming (Server → HA):**

| Message | Action |
|---------|--------|
| `clients_list` | Full refresh of all clients (on connect) |
| `client_connected` | New screen online, add device if named |
| `client_disconnected` | Screen offline, update binary_sensor |
| `client_updated` | Settings changed externally, update selects |
| `zones` | Zone list updated, refresh zone select options |

**Outgoing (HA → Server):**

When user changes a select entity, HA calls the REST API:

```
POST /api/admin/clients/{clientId}/push
{
  "layout": "basic",
  "font": "inter",
  "background": "dominant",
  "zoneId": "1234-5678"
}
```

### Coordinator Pattern

```python
class RoonNowPlayingCoordinator(DataUpdateCoordinator):
    - Manages WebSocket connection
    - Stores current state of all named clients
    - Notifies entities when data changes
    - Handles reconnection logic
```

Entities subscribe to coordinator updates. When WebSocket receives `client_updated`, coordinator calls `async_set_updated_data()`, triggering all entities to refresh their states.

---

## Configuration Flow

### User Setup Experience

1. User goes to Settings → Integrations → Add Integration
2. Searches for "Roon Now Playing"
3. Enters server URL (e.g., `http://192.168.1.50:3000`)
4. Integration validates connection by calling `/api/health`
5. Success: Integration added, named screens appear as devices

### Config Flow Implementation

```python
class RoonNowPlayingConfigFlow(ConfigFlow):

    async def async_step_user(self, user_input):
        # Show form asking for server URL
        if user_input:
            # Validate connection
            try:
                await self._test_connection(user_input["host"])
                return self.async_create_entry(
                    title="Roon Now Playing",
                    data={"host": user_input["host"]}
                )
            except CannotConnect:
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("host"): str
            }),
            errors=errors
        )
```

### Configuration Options

For v1, minimal config:
- `host`: Server URL (required)

Future options could include:
- Polling interval fallback
- Entity naming prefix
- mDNS discovery toggle

---

## File Structure

### Repository Structure

```
roon-now-playing-hass/
├── custom_components/
│   └── roon_now_playing/
│       ├── __init__.py          # Integration setup, coordinator init
│       ├── manifest.json        # Integration metadata, dependencies
│       ├── config_flow.py       # Setup UI flow
│       ├── coordinator.py       # WebSocket manager, data coordinator
│       ├── select.py            # Layout/font/background/zone selects
│       ├── binary_sensor.py     # Connected status sensor
│       ├── const.py             # Constants (DOMAIN, platforms, etc.)
│       ├── strings.json         # UI strings (English)
│       └── translations/
│           └── en.json          # Translations
├── hacs.json                    # HACS metadata
├── README.md                    # Installation & usage docs
└── LICENSE                      # MIT license
```

### Key Dependencies (manifest.json)

```json
{
  "domain": "roon_now_playing",
  "name": "Roon Now Playing",
  "version": "1.0.0",
  "dependencies": [],
  "requirements": ["aiohttp>=3.8.0"],
  "codeowners": ["@arthursoares"],
  "iot_class": "local_push"
}
```

**IoT Class:** `local_push` indicates local network communication with push updates (WebSocket).

---

## Automation Examples

```yaml
# Dim lights when screen shows music
automation:
  trigger:
    - platform: state
      entity_id: binary_sensor.living_room_display_connected
      to: "on"
  action:
    - service: light.turn_on
      target:
        entity_id: light.living_room
      data:
        brightness_pct: 30

# Switch to minimal layout at night
automation:
  trigger:
    - platform: time
      at: "22:00:00"
  action:
    - service: select.select_option
      target:
        entity_id: select.bedroom_display_layout
      data:
        option: "minimal"

# Change to ambient layout when playing
automation:
  trigger:
    - platform: state
      entity_id: media_player.living_room  # From Roon integration
      to: "playing"
  action:
    - service: select.select_option
      target:
        entity_id: select.living_room_display_layout
      data:
        option: "ambient"
```

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Entity types** | Select (layout, font, background, zone) + Binary sensor (connected) |
| **Screen persistence** | Only named screens become HA entities |
| **Server discovery** | Manual URL entry (v1), mDNS optional later |
| **Real-time sync** | WebSocket to `/ws?admin=true` |
| **Repository** | Separate repo: `roon-now-playing-hass` |
| **Distribution** | HACS custom repository |
