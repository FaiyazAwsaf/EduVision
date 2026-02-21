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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WhiteboardCanvas, { WhiteboardCanvasHandle } from "./WhiteboardCanvas";
import LatexRenderer, { LatexObject } from "./LatexRenderer";
import { convertHandwritingToLatex } from "@/api/geminiService";
import Toolbar, { Tool } from "./Toolbar";
import { useWebSocket, WebSocketMessage } from "../../hooks/useWebSocket";
import * as fabric from "fabric";

/**
 * Selection bounds type
 */
type SelectionBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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

type HistoryEntry = {
  canvas: ReturnType<WhiteboardCanvasHandle["exportToJSON"]>;
  latex: LatexObject[];
};

function isLatexIntersecting(
  obj: LatexObject,
  bounds: SelectionBounds,
): boolean {
  return !(
    obj.left > bounds.left + bounds.width ||
    obj.left + obj.width < bounds.left ||
    obj.top > bounds.top + bounds.height ||
    obj.top + obj.height < bounds.top
  );
}

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
  const [eraserWidth, setEraserWidth] = useState(20);
  const [isDrawingLocked, setIsDrawingLocked] = useState(false);
  const [latexObjects, setLatexObjects] = useState<LatexObject[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [selectionData, setSelectionData] = useState<{
    imageData: string;
    bounds: SelectionBounds;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const selectionBounds = useMemo(
    () => selectionData?.bounds ?? null,
    [selectionData],
  );

  const historyRef = useRef<{ undo: HistoryEntry[]; redo: HistoryEntry[] }>({
    undo: [],
    redo: [],
  });
  const isApplyingHistoryRef = useRef(false);
  const lastSnapshotRef = useRef<string>("");
  const latexObjectsRef = useRef<LatexObject[]>([]);

  useEffect(() => {
    latexObjectsRef.current = latexObjects;
  }, [latexObjects]);

  const updateHistoryAvailability = useCallback(() => {
    const { undo, redo } = historyRef.current;
    setCanUndo(undo.length > 1);
    setCanRedo(redo.length > 0);
  }, []);

  const captureHistory = useCallback(
    (nextLatex?: LatexObject[]) => {
      if (isApplyingHistoryRef.current) return;
      const canvasState = canvasRef.current?.exportToJSON();
      if (!canvasState) return;

      const latex = nextLatex ?? latexObjectsRef.current;
      const snapshot: HistoryEntry = { canvas: canvasState, latex };
      const snapshotKey = JSON.stringify(snapshot);

      if (snapshotKey === lastSnapshotRef.current) return;

      lastSnapshotRef.current = snapshotKey;
      historyRef.current.undo.push(snapshot);
      historyRef.current.redo = [];

      if (historyRef.current.undo.length > 50) {
        historyRef.current.undo.shift();
      }

      updateHistoryAvailability();
    },
    [updateHistoryAvailability],
  );

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
            console.log(
              "[Whiteboard] received canvas_event with pathData:",
              message.data.pathData,
            );
            canvasRef.current?.addPath(message.data.pathData);
          } else {
            console.warn(
              "[Whiteboard] received canvas_event but no pathData in message:",
              message,
            );
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

        case "latex_added":
          if (message.data?.latexObject) {
            setLatexObjects((prev) => [...prev, message.data.latexObject]);
            console.log("[Whiteboard] Remote LaTeX object added");
          }
          break;

        default:
          console.warn("[Whiteboard] Unknown message type:", message.type);
      }
    },
    [role],
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

  useEffect(() => {
    if (currentTool !== "select") {
      setSelectionData(null);
    }
  }, [currentTool]);

  const applySnapshot = useCallback(
    async (snapshot: HistoryEntry) => {
      if (!canvasRef.current) return;
      isApplyingHistoryRef.current = true;
      await canvasRef.current.loadFromJSON(snapshot.canvas);
      setLatexObjects(snapshot.latex);
      latexObjectsRef.current = snapshot.latex;
      lastSnapshotRef.current = JSON.stringify(snapshot);
      isApplyingHistoryRef.current = false;
      updateHistoryAvailability();
    },
    [updateHistoryAvailability],
  );

  const handleUndo = useCallback(() => {
    const { undo, redo } = historyRef.current;
    if (undo.length <= 1) return;
    const current = undo.pop();
    if (current) {
      redo.push(current);
    }
    const previous = undo[undo.length - 1];
    if (previous) {
      void applySnapshot(previous);
    }
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    const { undo, redo } = historyRef.current;
    if (redo.length === 0) return;
    const next = redo.pop();
    if (!next) return;
    undo.push(next);
    void applySnapshot(next);
  }, [applySnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier && e.key !== "Delete") return;

      if (e.key.toLowerCase() === "z" && !e.shiftKey && isModifier) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) && isModifier) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Handle Delete key
      if (e.key === "Delete") {
        e.preventDefault();
        const canvas = canvasRef.current?.getCanvas();
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          // If there's an active selection or object, delete it
          if (activeObject instanceof fabric.ActiveSelection) {
            // Delete all selected objects
            const objects = activeObject.getObjects();
            objects.forEach((obj) => canvas.remove(obj));
          } else {
            // Delete single object
            canvas.remove(activeObject);
          }
          canvas.discardActiveObject();
          canvas.renderAll();
          captureHistory();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, captureHistory]);

  // ============================================================
  // canvas event handlers
  // ============================================================

  /**
   * handle selection tool
   */

  const handleSelectionComplete = useCallback(
    async (imageData: string, bounds: SelectionBounds) => {
      console.log("[Whiteboard] Selection complete, converting to LaTeX...");
      setIsConverting(true);

      try {
        // call gemini
        const result = await convertHandwritingToLatex(imageData, "math");

        if (result.success && result.latex) {
          // clear the hand-drawn content in the selected region
          canvasRef.current?.clearRegion(bounds);

          // create new Latex object positioned at the selection
          const newLatexObject: LatexObject = {
            id: `latex-${Date.now()}`,
            latex: result.latex,
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            fontSize: Math.min(Math.max(bounds.height * 0.6, 16), 48),
          };

          // add to state
          const nextLatex = [...latexObjectsRef.current, newLatexObject];
          setLatexObjects(nextLatex);

          // broadcast to other users
          if (websocket.isConnected) {
            websocket.sendMessage({
              type: "latex_added",
              data: { latexObject: newLatexObject },
            });
          }

          captureHistory(nextLatex);

          console.log(
            "[Whiteboard] LaTeX conversion successful:",
            result.latex,
          );
        } else {
          console.error("[Whiteboard] LaTeX conversion failed:", result.error);
          alert(`Conversion failed: ${result.error}`);
        }
      } catch (error) {
        console.error("[Whiteboard] Error during conversion:", error);
        alert("An error occurred during conversion");
      } finally {
        setIsConverting(false);
        setCurrentTool("pen");
      }
    },
    [websocket],
  );

  const handleSelectionReady = useCallback(
    (imageData: string, bounds: SelectionBounds) => {
      setSelectionData({ imageData, bounds });
    },
    [],
  );

  const handleSelectionCleared = useCallback(() => {
    setSelectionData(null);
  }, []);

  const handleConvertSelection = useCallback(() => {
    if (!selectionData) return;
    const { imageData, bounds } = selectionData;
    setSelectionData(null);
    handleSelectionComplete(imageData, bounds);
  }, [selectionData, handleSelectionComplete]);

  /**
   * handle local drawing events
   * broadcasts path data to all connected peers
   */
  const handlePathCreated = useCallback(
    (path: CanvasPath) => {
      if (isApplyingHistoryRef.current) return;
      const pathData = path.toObject();

      if (!websocket.isConnected) {
        console.log("[Whiteboard] Cannot broadcast: websocket not connected");
        return;
      }

      if (!canDraw) {
        console.log("[Whiteboard] Cannot broadcast: drawing is locked");
        return;
      }

      websocket.sendMessage({
        type: "canvas_event",
        data: { pathData },
      });

      console.log("[Whiteboard] Broadcasted path to peers");
      captureHistory();
    },
    [websocket, canDraw, captureHistory],
  );

  /**
   * handle canvas clear (teacher only)
   * broadcasts clear event to all students
   */
  const handleClear = useCallback(() => {
    if (role !== "teacher") return;

    const canvas = canvasRef.current?.getCanvas();

    if (selectionBounds) {
      canvasRef.current?.clearRegion(selectionBounds);
      const nextLatex = latexObjectsRef.current.filter(
        (obj) => !isLatexIntersecting(obj, selectionBounds),
      );
      setLatexObjects(nextLatex);
      setSelectionData(null);
      if (canvas) {
        canvas.discardActiveObject();
        canvas.renderAll();
      }
      captureHistory(nextLatex);
      return;
    }

    canvasRef.current?.clearCanvas();
    setLatexObjects([]);
    if (canvas) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    captureHistory([]);

    if (!websocket.isConnected) {
      return;
    }

    websocket.sendMessage({
      type: "clear_canvas",
      data: {},
    });

    console.log("[Whiteboard] Cleared canvas");
  }, [role, selectionBounds, websocket]);

  const handleLatexObjectClick = useCallback(
    (id: string) => {
      if (currentTool !== "eraser") return;
      const nextLatex = latexObjectsRef.current.filter((obj) => obj.id !== id);
      setLatexObjects(nextLatex);
      captureHistory(nextLatex);
    },
    [currentTool, captureHistory],
  );

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

      if (websocket.isConnected) {
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
        eraserWidth={eraserWidth}
        isDrawingLocked={isDrawingLocked}
        isConnected={websocket.isConnected}
        selectionReady={!!selectionData}
        onConvertSelection={handleConvertSelection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToolChange={setCurrentTool}
        onColorChange={setPenColor}
        onStrokeWidthChange={setStrokeWidth}
        onEraserWidthChange={setEraserWidth}
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
          eraserWidth={eraserWidth}
          tool={currentTool}
          onPathCreated={handlePathCreated}
          onSelectionReady={handleSelectionReady}
          onCanvasReady={() => {
            historyRef.current.undo = [];
            historyRef.current.redo = [];
            lastSnapshotRef.current = "";
            captureHistory([]);
          }}
        />
      </div>

      {/* latex overlay */}
      <LatexRenderer
        objects={latexObjects}
        onObjectClick={handleLatexObjectClick}
      />

      {/* loading indicator */}
      {isConverting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48A6A7] mx-auto mb-4" />
            <p className="text-[#006A71] font-bold">Converting to LaTeX...</p>
          </div>
        </div>
      )}

      {/* session info */}
      <div className="fixed top-2.5 right-2.5 bg-slate-700 bg-opacity-90 text-slate-100 px-3 py-2 rounded text-xs z-[900] flex flex-col gap-1">
        <div>Session: {sessionId}</div>
        <div>Role: {role}</div>
        <div>Status: {websocket.connectionState}</div>
      </div>
    </div>
  );
}
