import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect as rawConnect } from 'node:net';
import { createHash } from 'node:crypto';
import { acceptWebSockets } from '../server/websocket.mjs';

function listen() {
  const httpServer = createServer(() => {});
  const onceConnection = new Promise(resolve => acceptWebSockets(httpServer, { onConnection: session => resolve({ httpServer, session }) }));
  const listening = new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  return listening.then(() => ({ httpServer, onceConnection, port: httpServer.address().port }));
}

/** Minimal masked-frame WebSocket client over a raw socket (RFC 6455 basics). */
class RawWebSocket {
  constructor(port) {
    this.frames = [];
    this.waiters = [];
    this.closed = new Promise(resolve => { this._resolveClosed = resolve; });
    this.socket = rawConnect(port, '127.0.0.1');
    this.buffer = Buffer.alloc(0);
    this.ready = false;
    this.socket.on('close', () => { this.dead = true; this._resolveClosed(); });
  }

  handshake() {
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => {
        const key = 'dGhlIHNhbXBsZSBub25jZQ==';
        this.socket.write(
          'GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        );
        const expected = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        let raw = Buffer.alloc(0);
        const onData = chunk => {
          raw = Buffer.concat([raw, chunk]);
          const end = raw.indexOf('\r\n\r\n');
          if (end < 0) return;
          this.socket.off('data', onData);
          const header = raw.subarray(0, end).toString();
          this.buffer = raw.subarray(end + 4);
          const ok = header.includes('101 Switching Protocols') && header.includes(`Sec-WebSocket-Accept: ${expected}`);
          if (!ok) { reject(new Error(`Handshake recusado: ${header.slice(0, 120)}`)); return; }
          this.ready = true;
          this.socket.on('data', chunk => { this.buffer = Buffer.concat([this.buffer, chunk]); this._drain(); });
          resolve();
          this._drain();
        };
        this.socket.on('data', onData);
        this.socket.once('error', reject);
      });
    });
  }

  _drain() {
    while (true) {
      const buffer = this.buffer;
      if (buffer.length < 2) return;
      const opcode = buffer[0] & 0x0f;
      let length = buffer[1] & 0x7f, offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      if (buffer.length < offset + length) return;
      const payload = buffer.subarray(offset, offset + length);
      this.buffer = buffer.subarray(offset + length);
      if (opcode === 0x9) this.send(0xA, payload); // auto-pong
      else if (opcode === 0x8) { // echo the close and finish the stream
        this.send(0x8, payload);
        this.socket.end();
        this.dead = true;
        this._resolveClosed();
      }
      else {
        const frame = { opcode, payload };
        const waiter = this.waiters.shift();
        if (waiter) waiter(frame); else this.frames.push(frame);
      }
    }
  }

  send(opcode, payload = Buffer.alloc(0)) {
    const mask = Buffer.from([7, 31, 127, 201]);
    const masked = Buffer.from([...payload].map((byte, i) => byte ^ mask[i & 3]));
    let header;
    if (payload.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  text(message) { this.send(0x1, Buffer.from(message, 'utf8')); }

  next({ timeout = 4000 } = {}) {
    const queued = this.frames.shift();
    if (queued) return Promise.resolve({ opcode: queued.opcode, payload: queued.payload.toString('utf8') });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Quadro não chegou.')), timeout);
      this.waiters.push(({ opcode, payload }) => { clearTimeout(timer); resolve({ opcode, payload: payload.toString('utf8') }); });
    });
  }

  destroy() { this.socket.destroy(); }
}

const shutdown = target => { target.httpServer.close(); target.httpServer.closeAllConnections(); };

test('websocket: handshake aceito com Sec-WebSocket-Accept correto', async () => {
  const target = await listen();
  const client = new RawWebSocket(target.port);
  await client.handshake();
  client.destroy();
  await shutdown(target);
});

test('websocket: eco de mensagem de texto e fechamento limpo', async () => {
  const target = await listen();
  const client = new RawWebSocket(target.port);
  await client.handshake();
  const { session } = await target.onceConnection;
  session.on('message', raw => session.send(raw));
  client.text('{"olá":"mundo"}');
  const reply = await client.next();
  assert.equal(reply.opcode, 0x1);
  assert.equal(reply.payload, '{"olá":"mundo"}');
  const closed = new Promise(resolve => { session.on('close', () => resolve(true)); });
  client.send(0x8, Buffer.alloc(0)); // close frame, no payload
  assert.ok(await closed, 'o servidor deve reconhecer o fechamento');
  await client.closed;
  client.destroy();
  await shutdown(target);
});

test('websocket: mensagem grande chega inteira', async () => {
  const target = await listen();
  const client = new RawWebSocket(target.port);
  await client.handshake();
  const { session } = await target.onceConnection;
  const received = new Promise(resolve => { session.on('message', raw => resolve(raw)); });
  const payload = 'x'.repeat(200000);
  client.text(payload);
  assert.equal(await received, payload);
  client.destroy();
  await shutdown(target);
});

test('websocket: ping do cliente responde pong com o mesmo payload', async () => {
  const target = await listen();
  const client = new RawWebSocket(target.port);
  await client.handshake();
  await target.onceConnection;
  client.send(0x9, Buffer.from('oi'));
  const pong = await client.next();
  assert.equal(pong.opcode, 0xA);
  assert.equal(pong.payload, 'oi');
  client.destroy();
  await shutdown(target);
});
