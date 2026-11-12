import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 16 * 1024 * 1024;

/** Minimal RFC 6455 server-side WebSocket session over a net.Socket. */
export class WebSocketSession extends EventEmitter {
  constructor(socket, { maxPayload = MAX_PAYLOAD } = {}) {
    super();
    this.socket = socket;
    this.maxPayload = maxPayload;
    this.open = true;
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._fragmentOpcode = 0;
    this._closeSent = false;
    socket.on('data', chunk => this._onData(chunk));
    const end = () => this._closeFromSocket(1006, 'conexão encerrada');
    socket.on('close', end);
    socket.on('end', end);
    socket.on('error', () => this._closeFromSocket(1006, 'erro de socket'));
  }

  _onData(chunk) {
    this._buffer = this._buffer.length ? Buffer.concat([this._buffer, chunk]) : chunk;
    try {
      while (true) {
        const frame = this._readFrame();
        if (!frame) break;
        this._handleFrame(frame);
        if (!this.open) break;
      }
    } catch (error) {
      this.close(1002, error.message);
    }
  }

  _readFrame() {
    const buffer = this._buffer;
    if (buffer.length < 2) return null;
    const first = buffer[0], second = buffer[1];
    const fin = (first & 0x80) !== 0, opcode = first & 0x0f, masked = (second & 0x80) !== 0;
    let length = second & 0x7f, offset = 2;
    if (length === 126) {
      if (buffer.length < 4) return null;
      length = buffer.readUInt16BE(2); offset = 4;
    } else if (length === 127) {
      if (buffer.length < 10) return null;
      const big = buffer.readBigUInt64BE(2);
      if (big > BigInt(this.maxPayload)) throw new Error('Quadro maior que o permitido.');
      length = Number(big); offset = 10;
    }
    if (length > this.maxPayload) throw new Error('Quadro maior que o permitido.');
    let mask = null;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      mask = buffer.subarray(offset, offset + 4); offset += 4;
    }
    if (buffer.length < offset + length) return null;
    let payload = buffer.subarray(offset, offset + length);
    if (mask) {
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    this._buffer = buffer.subarray(offset + length);
    return { fin, opcode, payload };
  }

  _handleFrame({ fin, opcode, payload }) {
    if (opcode === 0x8) { // close
      if (!this._closeSent) this.close(1000, '');
      this._closeFromSocket(1000, 'fechado pelo cliente');
      return;
    }
    if (opcode === 0x9) { this._sendFrame(0xA, payload); return; } // ping → pong
    if (opcode === 0xA) return; // pong
    if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
      if (opcode !== 0x0) this._fragmentOpcode = opcode;
      this._fragments.push(payload);
      if (!fin) return;
      const data = this._fragments.length === 1 ? this._fragments[0] : Buffer.concat(this._fragments);
      this._fragments = [];
      const isText = this._fragmentOpcode === 0x1;
      this._fragmentOpcode = 0;
      if (isText) this.emit('message', data.toString('utf8'));
      else this.emit('binary', data);
      return;
    }
    throw new Error(`Opcode desconhecido: ${opcode}`);
  }

  _sendFrame(opcode, payload) {
    if (!this.open || this.socket.destroyed) return false;
    const length = payload.length;
    let header;
    if (length < 126) header = Buffer.from([0x80 | opcode, length]);
    else if (length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2); }
    this.socket.write(Buffer.concat([header, payload]));
    return true;
  }

  send(message) {
    if (!this.open) return false;
    return this._sendFrame(0x1, Buffer.from(String(message), 'utf8'));
  }

  sendJson(value) { return this.send(JSON.stringify(value)); }

  ping() { return this._sendFrame(0x9, Buffer.alloc(0)); }

  close(code = 1000, reason = '') {
    if (!this.open || this._closeSent) return;
    this._closeSent = true;
    const body = Buffer.from(String(reason), 'utf8').subarray(0, 123);
    const frame = Buffer.alloc(4 + body.length); // 2 frame bytes + 2 status bytes + body
    frame[0] = 0x88; frame[1] = body.length + 2;
    frame.writeUInt16BE(code, 2);
    body.copy(frame, 4);
    try { this.socket.write(frame); } catch {}
    this.socket.end();
    setTimeout(() => { try { this.socket.destroy(); } catch {} }, 2000).unref?.();
  }

  _closeFromSocket(code, reason) {
    if (!this.open) return;
    this.open = false;
    this.emit('close', code, reason);
  }
}

/** HTTP upgrade listener that accepts WebSocket sessions on every path. */
export function acceptWebSockets(httpServer, { onConnection, maxPayload } = {}) {
  httpServer.on('upgrade', (request, socket, head) => {
    const key = request.headers['sec-websocket-key'];
    const version = request.headers['sec-websocket-version'];
    if (!key || version !== '13' || (request.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = createHash('sha1').update(key + WS_MAGIC).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    const session = new WebSocketSession(socket, { maxPayload });
    if (head?.length) session._onData(head);
    onConnection(session, request);
  });
}
