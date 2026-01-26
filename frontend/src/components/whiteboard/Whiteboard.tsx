/**
 * Whiteboard Component
 *
 * Main orchestrator component that integrates:
 * - WhiteboardCanvas (Fabric.js drawing)
 * - WebSocket (real-time collaboration)
 * - Toolbar (UI controls)
 * - Session info display
 */

"use client";

import { useCallback, useRef, useState } from "react";
import WhiteboardCanvas, { WhiteboardCanvasHandle } from "./WhiteboardCanvas";
import Toolbar, { Tool } from "./Toolbar";
import { useWebSocket, WebSocketMessage } from "../../hooks/useWebSocket";

/**
 * props for whiteboard component
 */
export type WhiteboardProps = {
  sessionId: string;
  userId: string;
  role: "teacher" | "student";
};

/**
 * path object from fabric.js canvas
 * represents a drawn stroke with all its properties
 */
type CanvasPath = fabric.Path;

/**
 * main whiteboard component
 * coordinates drawing canvas, toolbar controls, and real-time collaboration
 */
export default function Whiteboard({
  sessionId,
  userId,
  role,
}: WhiteboardProps) {
  // ============================================================
  // state management
  // ============================================================

  // canvas state
  const canvasRef = useRef<WhiteboardCanvasHandle>(null);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawingLocked, setIsDrawingLocked] = useState(false);

  // ============================================================
  // websocket handlers
  // ============================================================

  /**
   * handle incoming websocket messages
   * routes different message types to appropriate handlers
   */
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("[Whiteboard] Received message:", message.type);

      switch (message.type) {
        case "canvas_event":
          // handle remote drawing events
          if (message.data?.pathData) {
            console.log("[Whiteboard] received canvas_event with pathData:", message.data.pathData);
            canvasRef.current?.addPath(message.data.pathData);
          } else {
            console.warn("[Whiteboard] received canvas_event but no pathData in message:", message);
          }
          break;

        case "clear_canvas":
          // remote clear event
          console.log("[Whiteboard] Remote clear canvas");
          canvasRef.current?.clearCanvas();
          break;

        case "lock_state":
          // update drawing lock state for students
          if (role === "student") {
            setIsDrawingLocked(message.data?.isLocked || false);
            console.log(
              "[Whiteboard] Drawing lock state:",
              message.data?.isLocked
            );
          }
          break;

        case "user_joined":
          console.log("[Whiteboard] User joined:", message.data?.userId);
          break;

        case "user_left":
          console.log("[Whiteboard] User left:", message.data?.userId);
          break;

        default:
          console.warn("[Whiteboard] Unknown message type:", message.type);
      }
    },
    [role]
  );

  /**
   * initialize websocket connection with callbacks
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

  // ============================================================
  // computed state
  // ============================================================

  const canDraw = role === "teacher" || !isDrawingLocked;

  // ============================================================
  // canvas event handlers
  // ============================================================

  /**
   * handle local drawing events
   * broadcasts path data to all connected peers
   */
  const handlePathCreated = useCallback(
    (path: CanvasPath) => {
      const pathData = path.toObject() as fabric.IPathOptions;

      if (!websocket.isConnected){
        console.log("[Whiteboard] Cannot broadcast: websocket not connected");
        return;
      }

      if(!canDraw){
        console.log("[Whiteboard] Cannot broadcast: drawing is locked");
        return;
      }

      websocket.sendMessage({
        type: "canvas_event",
        data: { pathData },
      });

      console.log("[Whiteboard] Broadcasted path to peers");
    },
    [websocket, canDraw]
  );

  /**
   * handle canvas clear (teacher only)
   * broadcasts clear event to all students
   */
  const handleClear = useCallback(() => {
    if (role !== "teacher") return;

    canvasRef.current?.clearCanvas();
    
    if(!websocket.isConnected){
      return;
    }

    websocket.sendMessage({
      type: "clear_canvas",
      data: {},
    });

    console.log("[Whiteboard] Cleared canvas");
  }, [role, websocket]);

  /**
   * export canvas to json file
   * allows saving whiteboard state for future reference
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
   * toggle drawing lock for students (teacher only)
   * broadcasts lock state to all connected students
   */
  const handleToggleLock = useCallback(() => {
    if (role !== "teacher") return;

    setIsDrawingLocked((prevLocked) => {
      const newLockState = !prevLocked;

      if(websocket.isConnected){
        websocket.sendMessage({
          type: "lock_state",
          data: { isLocked: newLockState },
        });
      }

      console.log("[Whiteboard] Drawing lock:", newLockState);
      return newLockState;
    });
  }, [role, websocket]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="w-screen h-screen bg-[#1a1a1a] relative overflow-hidden">
      {/* toolbar */}
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

      {/* canvas */}
      <div className="w-full h-full absolute top-0 left-0">
        <WhiteboardCanvas
          ref={canvasRef}
          isDrawingEnabled={canDraw}
          penColor={penColor}
          strokeWidth={strokeWidth}
          tool={currentTool}
          onPathCreated={handlePathCreated}
        />
      </div>

      {/* session info */}
      <div className="fixed top-2.5 right-2.5 bg-slate-700 bg-opacity-90 text-slate-100 px-3 py-2 rounded text-xs z-[900] flex flex-col gap-1">
        <div>Session: {sessionId}</div>
        <div>Role: {role}</div>
        <div>Status: {websocket.connectionState}</div>
      </div>
    </div>
  );
}
