# Server connections and shutdown

## Display identity and admin observers

The WebSocket endpoint remains `/ws`; admins use `/ws?admin=true` and/or
`client_metadata.isAdmin: true`. Once a connection declares itself admin, later
metadata cannot make that socket a display. Open a separate display connection.
Admin is a connection role, not an authentication boundary.

Display identity keeps the existing wire format:

- `client_metadata.clientId` and returned `ClientMetadata.clientId` contain
  `deviceId:sessionSuffix`. Legacy IDs without a colon remain supported.
- The prefix before the first colon is the stable device ID. The browser retains
  it in localStorage; the suffix identifies a session and may change on reconnect.
- There is no separate `deviceId` field in the metadata response. Integrations
  should derive the stable prefix from `clientId`, not use `friendlyName` as an ID.
- Friendly names are mutable labels. Persistent names and settings remain keyed
  by the stable device ID. Renaming a display keeps its device identity.

`GET /api/admin/clients` and `clients_list` contain registered displays,
deduplicated by stable device ID. Admin sockets remain connected observers of
lists and display events, but never receive generated/stored friendly names,
register as display targets, or produce display lifecycle events. Display
settings, rename and reset operations exclude same-browser admin sockets.
Admin HTTP controls retain their routes and target display session IDs.

A display reconnect reuses its persistent name and server settings. Closing an
older connection with the same session ID does not unregister its replacement.
Admin-only visits do not create or change persistent display records. Existing
historical records remain untouched; there is no automatic purge or migration.
`DELETE /api/admin/clients/:clientId` continues to reset a connected display and
returns 404 for an offline record. Offline cleanup requires a separate explicit
operation; this fix does not add one.

## SIGTERM and SIGINT

Shutdown is idempotent. The server stops listening and rejects further HTTP
requests on existing connections with 503 before awaiting service disposal.
WebSocket upgrades stop and incoming metadata/subscriptions are ignored.

Connected WebSockets receive close code 1001 (`Server shutting down`). Peers
that do not complete the handshake are terminated after 250 ms. The WebSocket
server tracks all its sockets, including sockets removed from the display
registry. Idle HTTP connections close immediately; remaining TCP connections,
including incomplete HTTP requests, are destroyed after 750 ms.

Codex facts and account disposal keep their existing order. Shutdown uses the
existing persistence implementations without adding another flush writer.
Successful disposal and connection draining log `Server closed` and exit 0.
Disposal failures exit 1. A 3 s deadline, armed before any awaited disposal,
forces exit 1 if cleanup stalls. As with any event-loop timer, that deadline
cannot preempt synchronous code blocking the event loop. Existing synchronous
name/settings writes and serialized atomic cache writes retain their behavior;
shutdown does not make a new crash-safety guarantee for storage or power loss.

## Regression checks

Run from the workspace root with the pinned pnpm version:

```sh
pnpm exec vitest run packages/server/src/shutdown.spec.ts packages/server/src/websocket.roles.spec.ts packages/server/src/websocket.spec.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The shutdown tests launch the real entrypoint in isolated child processes with
Roon/Codex disabled and temporary data. They cover SIGTERM/SIGINT, cooperative
and nonresponsive WebSockets, repeated signals, and incomplete requests on HTTP
keep-alive connections. Successful runs preserve persisted names/settings byte
for byte. The observer tests cover new and historical admin identities,
same-browser sessions, admin controls, name lookup, display reset, authoritative
settings replay, replacement session lookup and metadata arriving at shutdown.
