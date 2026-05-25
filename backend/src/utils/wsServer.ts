import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { verifyToken } from './auth';

type ClientRecord = { userId?: string; ws: WebSocket };

let wss: any = null;
const clients = new Set<ClientRecord>();

export function initWebsocket(server: HttpServer) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: any, req: any) => {
    const client: ClientRecord = { ws };

    // secure production auth: require JWT via sec-websocket-protocol
    try {
      const proto = req.headers && (req.headers['sec-websocket-protocol'] || req.headers['Sec-WebSocket-Protocol']);
      let token: string | null = null;
      if (proto) {
        const parts = Array.isArray(proto) ? proto : String(proto).split(',');
        const cleaned = parts.map((p: any) => String(p).trim()).filter(Boolean);
        // Convention: first subprotocol is "jwt", second is the token
        token = cleaned[0] === 'jwt' && cleaned[1] ? cleaned[1] : (cleaned[0] === 'jwt' ? null : cleaned[0] || null);
      }

      const decoded = token ? verifyToken(token) : null;
      if (!decoded || !decoded.id) {
        // invalid token - close connection
        try { ws.close(); } catch (e) {}
        return;
      }
      client.userId = String(decoded.id);
      clients.add(client);
    } catch (e) {
      try { ws.close(); } catch (err) {}
      return;
    }

    ws.on('message', (msg: any) => {
      // currently we don't expect messages from clients other than future features
      // keep placeholder to avoid unhandled messages
      return;
    });

    ws.on('close', () => {
      clients.delete(client);
    });
  });

  console.log('✓ WebSocket server initialized at /ws');
}

export function sendToUser(userId: string, event: string, payload: any) {
  for (const c of clients) {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) {
      try {
        c.ws.send(JSON.stringify({ event, payload }));
      } catch (err) {
        // ignore
      }
    }
  }
}

export default { initWebsocket, sendToUser };
