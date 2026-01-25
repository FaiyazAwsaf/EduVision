/**
 * useWebSocket Hook
 *
 * Manages WebSocket connection for real-time collaboration
 * Handles both whiteboard events and WebRTC signaling
 */

import { useEffect, useRef, useCallback, useState } from "react";

export type WebSocketMessage = {
  type:
    | "canvas_event"
    | "webrtc_signal"
    | "user_joined"
    | "user_left"
    | "lock_state"
    | "clear_canvas";
  data?: any;
  senderId?: string;
  sessionId?: string;
};

type WebSocketConfig = {
  sessionId: string;
  userId: string;
  role: "teacher" | "student";
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
};

export function useWebSocket(config: WebSocketConfig) {
  const {
    sessionId,
    userId,
    role,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
  } = config;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  // Queue for messages sent before connection is established
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  const connect = useCallback(() => {
    try {
      // WebSocket endpoint format: ws://<host>/ws/whiteboard/{sessionId}/
      const wsUrl = `ws://localhost:8000/ws/whiteboard/${sessionId}/`;

      console.log(`[WebSocket] Connecting to ${wsUrl} as ${role}...`);
      setConnectionState("connecting");

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected successfully");
        setIsConnected(true);
        setConnectionState("connected");

        // Send initial join message
        ws.send(
          JSON.stringify({
            type: "user_joined",
            data: { userId, role },
            senderId: userId,
            sessionId,
          }),
        );

        // Flush message queue
        while (messageQueueRef.current.length > 0) {
          const queuedMessage = messageQueueRef.current.shift();
          if (queuedMessage) {
            ws.send(JSON.stringify(queuedMessage));
          }
        }

        onConnected?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Don't process our own messages (avoid infinite loops)
          if (message.senderId === userId) {
            return;
          }

          console.log("[WebSocket] Received message:", message.type);
          onMessage?.(message);
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        onError?.(error);
      };

      ws.onclose = (event) => {
        console.log(
          `[WebSocket] Disconnected (code: ${event.code}, reason: ${event.reason})`,
        );
        setIsConnected(false);
        setConnectionState("disconnected");
        wsRef.current = null;
        onDisconnected?.();

        // Attempt to reconnect after 3 seconds (unless intentional close)
        if (event.code !== 1000) {
          console.log("[WebSocket] Attempting to reconnect in 3 seconds...");
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);
      setConnectionState("disconnected");
    }
  }, [
    sessionId,
    userId,
    role,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send leave message before disconnecting
      wsRef.current.send(
        JSON.stringify({
          type: "user_left",
          data: { userId, role },
          senderId: userId,
          sessionId,
        }),
      );

      wsRef.current.close(1000, "Client disconnecting");
    }

    wsRef.current = null;
    setIsConnected(false);
    setConnectionState("disconnected");
  }, [userId, role, sessionId]);

  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      // Add sender info to message
      const enrichedMessage = {
        ...message,
        senderId: userId,
        sessionId,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(enrichedMessage));
        console.log("[WebSocket] Sent message:", message.type);
      } else {
        // Queue message if not connected
        console.warn(
          "[WebSocket] Not connected, queuing message:",
          message.type,
        );
        messageQueueRef.current.push(enrichedMessage);
      }
    },
    [userId, sessionId],
  );

  // Connect on mount - only when sessionId or userId changes
  useEffect(() => {
    // Don't connect if sessionId or userId is loading
    if (sessionId === "loading" || userId === "loading") {
      return;
    }

    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId]); // Only reconnect if session or user changes

  return {
    isConnected,
    connectionState,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
