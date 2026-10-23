// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'http';
import { createConnection, type Socket, type AddressInfo } from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
const tsx = import.meta.resolve('tsx');

describe('server signal shutdown (real child process)', () => {
  let child: ChildProcess | undefined;
  let directory: string;
  const sockets: Array<WebSocket | Socket> = [];
  let output = '';

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      if (socket instanceof WebSocket) socket.terminate();
      else socket.destroy();
    }
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
      child.kill('SIGKILL');
      await closed;
    }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  async function start() {
    // Reserve an ephemeral port without depending on a fixed test port.
    const reservation = createServer();
    await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = (reservation.address() as AddressInfo).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-shutdown-'));
    fs.writeFileSync(path.join(directory, 'client-names.json'), JSON.stringify({ screen: 'living-room', orphan: 'keep-me' }));
    output = '';
    child = spawn(process.execPath, ['--import', tsx, entry], {
      cwd: directory,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: directory, ROON_ENABLED: 'false', CODEX_ENABLED: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr!.on('data', (data) => { output += data.toString(); });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 5000);
      const exited = () => { clearTimeout(timer); reject(new Error(`Startup failed: ${output}`)); };
      child!.once('exit', exited);
      child!.stdout!.on('data', (data) => {
        output += data.toString();
        if (output.includes('Server running at')) {
          clearTimeout(timer);
          child!.off('exit', exited);
          resolve();
        }
      });
    });
    return port;
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    for (const stubborn of [false, true]) {
      for (const partialHttp of [false, true]) {
        it(`${signal} exits cleanly with ${stubborn ? 'a nonresponsive' : 'a cooperative'} WebSocket${partialHttp ? ' and an incomplete HTTP request' : ''}`, async () => {
          const port = await start();
          const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
          sockets.push(ws);
          await new Promise<void>((resolve, reject) => {
            ws.once('open', resolve);
            ws.once('error', reject);
          });
          const registered = new Promise<void>((resolve) => ws.on('message', (data) => {
            if (JSON.parse(data.toString()).friendly_name) resolve();
          }));
          ws.send(JSON.stringify({ type: 'client_metadata', clientId: 'screen:session', layout: 'cover', font: 'system', background: 'black', zoneId: null, zoneName: null }));
          await registered;
          const names = fs.readFileSync(path.join(directory, 'client-names.json'), 'utf8');
          await vi.waitFor(() => expect(fs.existsSync(path.join(directory, 'client-settings.json'))).toBe(true));
          const settings = fs.readFileSync(path.join(directory, 'client-settings.json'), 'utf8');
          let closeCode: number | undefined;
          ws.on('close', (code) => { closeCode = code; });
          if (stubborn) ws.pause(); // Never reads/acknowledges the server's close frame.

          if (partialHttp) {
            const http = createConnection({ host: '127.0.0.1', port });
            sockets.push(http);
            await new Promise<void>((resolve, reject) => {
              http.once('connect', resolve);
              http.once('error', reject);
            });
            http.write('GET /api/health HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n');
            await new Promise<void>((resolve) => http.once('data', () => resolve()));
            http.write('GET /api/health HTTP/1.1\r\nHost:');
            // An active partial request must not leave server.close waiting indefinitely.
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          const started = Date.now();
          const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Signal did not exit within 2200ms: ${output}`)), 2200);
            child!.once('exit', (code, exitSignal) => {
              clearTimeout(timer);
              resolve({ code, signal: exitSignal });
            });
          });
          child!.kill(signal);
          // A second signal must not start a competing cleanup or writer.
          if (stubborn) setTimeout(() => child?.kill(signal), 25).unref();
          expect(await exited).toEqual({ code: 0, signal: null });
          const elapsed = Date.now() - started;
          console.info(`${signal} stubborn=${stubborn} partialHttp=${partialHttp} exit=0 elapsed=${elapsed}ms`);
          expect(elapsed).toBeLessThan(2200);
          expect(output).toContain('Server closed');
          expect(output.match(/received, shutting down/g)).toHaveLength(1);
          if (!stubborn) expect(closeCode).toBe(1001);
          expect(fs.readFileSync(path.join(directory, 'client-names.json'), 'utf8')).toBe(names);
          expect(fs.readFileSync(path.join(directory, 'client-settings.json'), 'utf8')).toBe(settings);
        }, 10000);
      }
    }
  }
});
