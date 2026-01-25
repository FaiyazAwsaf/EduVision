/**
 * Whiteboard Component
 *
 * Main orchestrator component that integrates:
 * - WhiteboardCanvas (Fabric.js drawing)
 * - WebSocket (real-time collaboration)
 * - Toolbar (UI controls)
 */

"use client";

import { useState, useRef, useCallback } from "react";
import WhiteboardCanvas, { WhiteboardCanvasHandle } from "./WhiteboardCanvas";
import Toolbar, { Tool } from "./Toolbar";
import { useWebSocket, WebSocketMessage } from "../../hooks/useWebSocket";

export type WhiteboardProps = {
  sessionId: string;
  userId: string;
  role: "teacher" | "student";
};

export default function Whiteboard({
  sessionId,
  userId,
  role,
}: WhiteboardProps) {
  // Canvas state
  const canvasRef = useRef<WhiteboardCanvasHandle>(null);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawingLocked, setIsDrawingLocked] = useState(false);

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("[Whiteboard] Received message:", message.type);

      switch (message.type) {
        case "canvas_event":
          // Handle remote drawing events
          if (message.data?.pathData) {
            canvasRef.current?.addPath(message.data.pathData);
          }
          break;

        case "clear_canvas":
          // Remote clear event
          console.log("[Whiteboard] Remote clear canvas");
          canvasRef.current?.clearCanvas();
          break;

        case "lock_state":
          // Update drawing lock state for students
          if (role === "student") {
            setIsDrawingLocked(message.data?.isLocked || false);
            console.log(
              "[Whiteboard] Drawing lock state:",
              message.data?.isLocked,
            );
          }
          break;

        case "user_joined":
          console.log("[Whiteboard] User joined:", message.data?.userId);
          break;

        case "user_left":
          console.log("[Whiteboard] User left:", message.data?.userId);
          break;
      }
    },
    [role],
  );

  /**
   * Initialize WebSocket connection
   */
  const websocket = useWebSocket({
    sessionId,
    userId,
    role,
    onMessage: handleWebSocketMessage,
    onConnected: () => {
      console.log("[Whiteboard] WebSocket connected");
    },
    onDisconnected: () => {
      console.log("[Whiteboard] WebSocket disconnected");
    },
  });

  /**
   * Handle local drawing events
   */
  const handlePathCreated = useCallback(
    (path: any) => {
      // Broadcast drawing event to other participants
      const pathData = path.toObject();

      websocket.sendMessage({
        type: "canvas_event",
        data: { pathData },
      });

      console.log("[Whiteboard] Broadcasted path to peers");
    },
    [websocket],
  );

  /**
   * Handle canvas clear (teacher only)
   */
  const handleClear = useCallback(() => {
    if (role !== "teacher") return;

    canvasRef.current?.clearCanvas();

    // Broadcast clear event
    websocket.sendMessage({
      type: "clear_canvas",
      data: {},
    });

    console.log("[Whiteboard] Cleared canvas");
  }, [role, websocket]);

  /**
   * Export canvas to JSON
   */
  const handleExport = useCallback(() => {
    const state = canvasRef.current?.exportToJSON();
    if (state) {
      const dataStr = JSON.stringify(state, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `whiteboard-${sessionId}-${Date.now()}.json`;
      link.click();

      URL.revokeObjectURL(url);
      console.log("[Whiteboard] Exported canvas");
    }
  }, [sessionId]);

  /**
   * Toggle drawing lock (teacher only)
   */
  const handleToggleLock = useCallback(() => {
    if (role !== "teacher") return;

    const newLockState = !isDrawingLocked;
    setIsDrawingLocked(newLockState);

    // Broadcast lock state to students
    websocket.sendMessage({
      type: "lock_state",
      data: { isLocked: newLockState },
    });

    console.log("[Whiteboard] Drawing lock:", newLockState);
  }, [role, isDrawingLocked, websocket]);

  // Determine if current user can draw
  const canDraw = role === "teacher" || !isDrawingLocked;

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <Toolbar
        role={role}
        currentTool={currentTool}
        penColor={penColor}
        strokeWidth={strokeWidth}
        isDrawingLocked={isDrawingLocked}
        isConnected={websocket.isConnected}
        onToolChange={setCurrentTool}
        onColorChange={setPenColor}
        onStrokeWidthChange={setStrokeWidth}
        onClear={handleClear}
        onExport={handleExport}
        onToggleLock={role === "teacher" ? handleToggleLock : undefined}
      />

      {/* Canvas */}
      <div style={styles.canvasContainer}>
        <WhiteboardCanvas
          ref={canvasRef}
          isDrawingEnabled={canDraw}
          penColor={penColor}
          strokeWidth={strokeWidth}
          tool={currentTool}
          onPathCreated={handlePathCreated}
        />
      </div>

      {/* Session Info */}
      <div style={styles.sessionInfo}>
        <div>Session: {sessionId}</div>
        <div>Role: {role}</div>
        <div>Status: {websocket.connectionState}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#1a1a1a",
    position: "relative",
    overflow: "hidden",
  },
  canvasContainer: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  sessionInfo: {
    position: "fixed",
    top: 10,
    right: 10,
    backgroundColor: "rgba(44, 62, 80, 0.9)",
    color: "#ecf0f1",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    zIndex: 900,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
};
