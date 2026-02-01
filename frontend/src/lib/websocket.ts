/**
 * WebSocket Manager for Tutoring Sessions
 *
 * Handles real-time communication with the Django Channels backend.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event-based architecture with typed events
 * - Connection state management
 * - Ping/pong keepalive
 */

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export type SessionStatus = "WAITING" | "ACTIVE" | "GRACE" | "ENDED";

export interface Participant {
  id: string;
  name: string;
  connected: boolean;
}

export interface InitialState {
  session_id: string;
  room_id: string;
  status: SessionStatus;
  your_role: "teacher" | "student";
  teacher: Participant;
  student: Participant | null;
  timestamp: string;
}

export interface ParticipantEvent {
  user_id: string;
  role: "teacher" | "student";
  user_name: string;
  timestamp: string;
}

export interface StatusChangeEvent {
  status: SessionStatus;
  previous_status: SessionStatus | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface SessionEndedEvent {
  reason: string;
  ended_by: "teacher" | "student" | null;
  timestamp: string;
}

export interface WebRTCSignalEvent {
  sender_id: string;
  sender_role: "teacher" | "student";
  signal_type: string;
  signal_data: unknown;
  timestamp: string;
}

export interface ErrorEvent {
  message: string;
  code: string;
}

// Event handlers type map
export interface TutoringEventHandlers {
  initialState: (state: InitialState) => void;
  participantJoined: (event: ParticipantEvent) => void;
  participantLeft: (event: ParticipantEvent) => void;
  statusChanged: (event: StatusChangeEvent) => void;
  sessionEnded: (event: SessionEndedEvent) => void;
  webrtcSignal: (event: WebRTCSignalEvent) => void;
  error: (event: ErrorEvent) => void;
  connectionStateChange: (state: ConnectionState) => void;
}

// Configuration options
export interface WebSocketManagerOptions {
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Base delay for reconnection in ms (default: 1000) */
  reconnectBaseDelay?: number;
  /** Maximum delay for reconnection in ms (default: 30000) */
  reconnectMaxDelay?: number;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
  /** Debug logging (default: false) */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<WebSocketManagerOptions> = {
  maxReconnectAttempts: 5,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  pingInterval: 30000,
  debug: true,
};

/**
 * WebSocket manager for tutoring sessions.
 *
 * Usage:
 * ```ts
 * const wsManager = new TutoringWebSocketManager(sessionId, userId);
 * wsManager.on('initialState', (state) => console.log(state));
 * wsManager.on('participantJoined', (event) => console.log(event));
 * wsManager.connect();
 * // Later...
 * wsManager.disconnect();
 * ```
 */
export class TutoringWebSocketManager {
  private socket: WebSocket | null = null;
  private sessionId: string;
  private userId: string;
  private options: Required<WebSocketManagerOptions>;

  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private handlers: Partial<TutoringEventHandlers> = {};

  constructor(
    sessionId: string,
    userId: string,
    options: WebSocketManagerOptions = {}
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register an event handler.
   */
  on<K extends keyof TutoringEventHandlers>(
    event: K,
    handler: TutoringEventHandlers[K]
  ): void {
    this.handlers[event] = handler;
  }

  /**
   * Remove an event handler.
   */
  off<K extends keyof TutoringEventHandlers>(event: K): void {
    delete this.handlers[event];
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.log("Already connected");
      return;
    }

    this.setConnectionState("connecting");

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_HOST || "localhost:8000";
    const url = `${protocol}//${host}/ws/tutoring/${this.sessionId}/?user_id=${this.userId}`;

    this.log(`Connecting to ${url}`);

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log("Failed to create WebSocket", error);
      this.setConnectionState("disconnected");
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.log("Disconnecting...");

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close socket
    if (this.socket) {
      this.socket.onclose = null; // Prevent reconnection
      this.socket.close(1000, "Client disconnect");
      this.socket = null;
    }

    this.setConnectionState("disconnected");
    this.reconnectAttempts = 0;
  }

  /**
   * Send a message to the server.
   */
  send(type: string, payload: Record<string, unknown> = {}): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.log("Cannot send message: not connected");
      return;
    }

    const message = JSON.stringify({ type, payload });
    this.log(`Sending: ${type}`, payload);
    this.socket.send(message);
  }

  /**
   * Send a WebRTC signal to the other participant.
   */
  sendWebRTCSignal(signalType: string, signalData: unknown): void {
    this.send("webrtc_signal", {
      signal_type: signalType,
      signal_data: signalData,
    });
  }

  /**
   * Request current session state from server.
   */
  requestState(): void {
    this.send("request_state");
  }

  // ==================== Private Methods ====================

  private handleOpen(): void {
    this.log("Connected");
    this.setConnectionState("connected");
    this.reconnectAttempts = 0;
    this.startPingInterval();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      const { type, payload } = message;

      this.log(`Received: ${type}`, payload);

      switch (type) {
        case "initial_state":
          this.handlers.initialState?.(payload as InitialState);
          break;
        case "participant_joined":
          this.handlers.participantJoined?.(payload as ParticipantEvent);
          break;
        case "participant_left":
          this.handlers.participantLeft?.(payload as ParticipantEvent);
          break;
        case "session_status_changed":
          this.handlers.statusChanged?.(payload as StatusChangeEvent);
          break;
        case "session_ended":
          this.handlers.sessionEnded?.(payload as SessionEndedEvent);
          break;
        case "webrtc_signal":
          this.handlers.webrtcSignal?.(payload as WebRTCSignalEvent);
          break;
        case "error":
          this.handlers.error?.(payload as ErrorEvent);
          break;
        case "pong":
          // Received pong, connection is alive
          break;
        default:
          this.log(`Unknown message type: ${type}`);
      }
    } catch (error) {
      this.log("Failed to parse message", error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.log(`Disconnected: code=${event.code}, reason=${event.reason}`);

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Handle different close codes
    switch (event.code) {
      case 1000: // Normal closure
        this.setConnectionState("disconnected");
        break;
      case 4001: // Unauthorized
        this.setConnectionState("disconnected");
        this.handlers.error?.({
          message: "Authentication failed",
          code: "unauthorized",
        });
        break;
      case 4003: // Forbidden
        this.setConnectionState("disconnected");
        this.handlers.error?.({
          message: "Not authorized to join this session",
          code: "forbidden",
        });
        break;
      case 4004: // Not found
        this.setConnectionState("disconnected");
        this.handlers.error?.({
          message: "Session not found",
          code: "not_found",
        });
        break;
      case 4010: // Gone (session ended)
        this.setConnectionState("disconnected");
        this.handlers.sessionEnded?.({
          reason: "Session has ended",
          ended_by: null,
          timestamp: new Date().toISOString(),
        });
        break;
      default:
        // Unexpected disconnect - try to reconnect
        this.setConnectionState("disconnected");
        this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    this.log("WebSocket error", event);
    this.handlers.error?.({
      message: "WebSocket error occurred",
      code: "websocket_error",
    });
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.handlers.connectionStateChange?.(state);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log("Max reconnect attempts reached");
      this.handlers.error?.({
        message: "Failed to reconnect after multiple attempts",
        code: "max_reconnect_attempts",
      });
      return;
    }

    this.setConnectionState("reconnecting");

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      this.options.reconnectMaxDelay
    );

    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send("ping");
    }, this.options.pingInterval);
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[TutoringWS] ${message}`, ...args);
    }
  }
}

/**
 * Create a singleton WebSocket manager for a session.
 * Useful for ensuring a single connection across components.
 */
let currentManager: TutoringWebSocketManager | null = null;

export function getTutoringWebSocket(
  sessionId: string,
  userId: string,
  options?: WebSocketManagerOptions
): TutoringWebSocketManager {
  if (
    currentManager &&
    currentManager.getConnectionState() !== "disconnected"
  ) {
    return currentManager;
  }

  currentManager = new TutoringWebSocketManager(sessionId, userId, options);
  return currentManager;
}

export function disconnectTutoringWebSocket(): void {
  if (currentManager) {
    currentManager.disconnect();
    currentManager = null;
  }
}
