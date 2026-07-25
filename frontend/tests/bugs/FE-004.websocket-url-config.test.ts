/**
 * Bug FE-004: deployment docs/env expect NEXT_PUBLIC_WS_URL to configure the
 * full WebSocket URL, but the client only reads NEXT_PUBLIC_WS_HOST and falls
 * back to "localhost:8000" when it's missing. In a real deployment this means
 * every browser tries to connect to its own machine instead of the real server.
 *
 * frontend/src/lib/websocket.ts:184 (connect() builds the URL)
 */
import { TutoringWebSocketManager } from "@/lib/websocket";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  close() {}
  send() {}
}

const originalWebSocket = global.WebSocket;
const originalEnv = process.env.NEXT_PUBLIC_WS_URL;

beforeEach(() => {
  FakeWebSocket.instances = [];
  // @ts-expect-error - simplified fake for testing URL construction only
  global.WebSocket = FakeWebSocket;
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  process.env.NEXT_PUBLIC_WS_URL = originalEnv;
});

test("connect() honors a configured NEXT_PUBLIC_WS_URL instead of defaulting to localhost", () => {
  process.env.NEXT_PUBLIC_WS_URL = "wss://api.example.com";

  const manager = new TutoringWebSocketManager("session-1", "user-1");
  manager.connect();

  const created = FakeWebSocket.instances[0];
  expect(created.url).toContain("api.example.com");
  expect(created.url).not.toContain("localhost:8000");
});
