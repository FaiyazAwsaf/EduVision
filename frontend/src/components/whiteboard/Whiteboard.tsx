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
import { saveState, WhiteboardState } from "@/api/whiteboardService";
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
  initialState?: WhiteboardState | null;
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

/**
 * page data structure for multi-page whiteboard
 */
type PageData = {
  id: string;
  canvasState: ReturnType<WhiteboardCanvasHandle["exportToJSON"]> | null;
  latexObjects: LatexObject[];
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
  initialState,
}: WhiteboardProps) {
  // ============================================================
  // state management
  // ============================================================

  // page management
  const [pages, setPages] = useState<PageData[]>([
    { id: "page-1", canvasState: null, latexObjects: [] },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");

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

  // ============================================================
  // Load initial state from backend
  // ============================================================
  useEffect(() => {
    if (hasLoadedInitialState || !initialState) return;

    console.log("[Whiteboard] Loading initial state from backend:", initialState);

    try {
      // Load canvas state
      if (initialState.snapshot_json) {
        canvasRef.current?.loadFromJSON(initialState.snapshot_json);
        setPages([
          {
            id: "page-1",
            canvasState: initialState.snapshot_json,
            latexObjects: initialState.latex_objects || [],
          },
        ]);
        setLatexObjects(initialState.latex_objects || []);
        console.log("[Whiteboard] Initial state restored successfully");
      }

      setHasLoadedInitialState(true);
    } catch (error) {
      console.error("[Whiteboard] Error loading initial state:", error);
      setHasLoadedInitialState(true);
    }
  }, [initialState, hasLoadedInitialState]);

  // ============================================================
  // Periodic state saving to backend
  // ============================================================
  useEffect(() => {
    // Save state every 30 seconds
    const saveIntervalId = setInterval(() => {
      if (!canvasRef.current) return;

      const currentCanvasState = canvasRef.current.exportToJSON();
      if (!currentCanvasState) return;

      const stateToSave = {
        snapshot_json: currentCanvasState,
        latex_objects: latexObjectsRef.current,
        description: `Auto-saved at ${new Date().toLocaleTimeString()}`,
      };

      const stateKey = JSON.stringify(stateToSave);

      // Only save if state has changed
      if (stateKey === lastSavedStateRef.current) {
        console.log("[Whiteboard] State unchanged, skipping save");
        return;
      }

      console.log("[Whiteboard] Saving state to backend...");
      lastSavedStateRef.current = stateKey;

      saveState(
        sessionId,
        stateToSave.snapshot_json,
        stateToSave.latex_objects,
        stateToSave.description,
      )
        .then(() => {
          console.log("[Whiteboard] State saved successfully");
        })
        .catch((error) => {
          console.error("[Whiteboard] Error saving state:", error);
        });
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveIntervalId);
  }, [sessionId]);

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
  // page management
  // ============================================================

  /**
   * save current page state before switching
   */
  const saveCurrentPage = useCallback(() => {
    const canvasState = canvasRef.current?.exportToJSON() ?? null;
    setPages((prev) => {
      const updated = [...prev];
      updated[currentPageIndex] = {
        ...updated[currentPageIndex],
        canvasState,
        latexObjects,
      };
      return updated;
    });
  }, [currentPageIndex, latexObjects]);

  /**
   * load a specific page
   */
  const loadPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex === currentPageIndex) return;
      if (pageIndex < 0 || pageIndex >= pages.length) return;

      // save current page
      saveCurrentPage();

      // load new page
      const page = pages[pageIndex];
      setCurrentPageIndex(pageIndex);
      setLatexObjects(page.latexObjects);

      // load canvas state
      if (page.canvasState) {
        canvasRef.current?.loadFromJSON(page.canvasState);
      } else {
        canvasRef.current?.clearCanvas();
      }

      console.log(`[Whiteboard] Loaded page ${pageIndex + 1}/${pages.length}`);
    },
    [currentPageIndex, pages, saveCurrentPage],
  );

  // Track if page creation has been triggered at this scroll position to prevent duplicates
  const pageCreationThresholdRef = useRef<number>(-1);

  /**
   * handle scroll to load pages and create new ones when needed
   * stricter logic: only create new page when scrolled close to bottom (~95%)
   */
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) {
      console.log("[Whiteboard] Pages container ref not available");
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      console.log("[Whiteboard] Scroll event fired:", { scrollTop, scrollHeight, clientHeight });
      const pageHeight = clientHeight;
      
      // Calculate how close to bottom we are (0 = top, 1 = bottom)
      // If scrollHeight <= clientHeight (no scroll needed), consider it as being at bottom
      const scrollProgress = scrollHeight > clientHeight 
        ? (scrollTop + clientHeight) / scrollHeight 
        : 1.0;  // At max scroll when content fits in viewport

      // Load page based on scroll position
      const visiblePageIndex = Math.floor(scrollTop / pageHeight);
      if (
        visiblePageIndex !== currentPageIndex &&
        visiblePageIndex >= 0 &&
        visiblePageIndex < pages.length
      ) {
        console.log(
          `[Whiteboard] ✓ Scrolled to page ${visiblePageIndex + 1}/${pages.length}`
        );
        loadPage(visiblePageIndex);
      }

      // Only create new page when scrolled to 95% and there's room for more
      // AND only once per threshold (prevent multiple creations)
      if (
        scrollProgress > 0.95 &&
        pages.length < 100 &&
        pageCreationThresholdRef.current < scrollProgress
      ) {
        pageCreationThresholdRef.current = scrollProgress;
        const newPageId = `page-${Date.now()}`;
        setPages((prev) => {
          console.log("[Whiteboard] ✓ Auto-created new page", prev.length + 1);
          return [
            ...prev,
            { id: newPageId, canvasState: null, latexObjects: [] },
          ];
        });
      }

      // Reset threshold when scrolling back up (below 90%)
      if (scrollProgress < 0.9) {
        pageCreationThresholdRef.current = -1;
      }

      console.log("[Whiteboard] Scroll progress:", {
        scrollProgress: scrollProgress.toFixed(2),
        visiblePageIndex,
        pagesLength: pages.length,
      });
    };

    container.addEventListener("scroll", handleScroll);
    console.log("[Whiteboard] Scroll event listener attached to pages container");
    
    return () => {
      container.removeEventListener("scroll", handleScroll);
      console.log("[Whiteboard] Scroll event listener removed");
    };
  }, [currentPageIndex, pages.length, loadPage]);

  /**
   * update current page when latex objects change
   */
  useEffect(() => {
    setPages((prev) => {
      const updated = [...prev];
      updated[currentPageIndex] = {
        ...updated[currentPageIndex],
        latexObjects,
      };
      return updated;
    });
  }, [latexObjects, currentPageIndex]);

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

  const handleToolChange = useCallback((tool: Tool) => {
    setCurrentTool(tool);
    if (tool === "pencil") {
      setPenColor("#A9A9A9"); // grey
    } else if (tool === "marker") {
      setPenColor("#87CEEB"); // light blue
    } else {
      setPenColor("#000000");
    }
  }, []);

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
        }
      } catch (error) {
        console.error("[Whiteboard] Error during conversion:", error);
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
    <div className="w-screen h-screen bg-[#1a1a1a] flex overflow-hidden">
      {/* toolbar - sidebar on left */}
      <div className="h-full overflow-y-auto">
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
          onToolChange={handleToolChange}
          onColorChange={setPenColor}
          onStrokeWidthChange={setStrokeWidth}
          onEraserWidthChange={setEraserWidth}
          onClear={handleClear}
          onExport={handleExport}
          onToggleLock={role === "teacher" ? handleToggleLock : undefined}
        />
      </div>

      {/* pages container - scrollable */}
      <div
        ref={pagesContainerRef}
        className="flex-1 h-screen overflow-y-auto scroll-smooth"
        style={{ 
          scrollBehavior: "smooth", 
          touchAction: "auto"
        }}
      >
        {/* pages */}
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="w-full relative bg-white"
            style={{ 
              height: "100vh",
              position: "relative",
              flexShrink: 0
            }}
          >
            {index === currentPageIndex && (
              <>
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

                {/* latex overlay for current page */}
                <div style={{ pointerEvents: 'auto' }}>
                  <LatexRenderer
                    objects={latexObjects}
                    onObjectClick={handleLatexObjectClick}
                  />
                </div>

                {/* page number indicator */}
                <div className="fixed top-20 right-2.5 text-gray-600 text-sm z-[900] font-medium">
                  {index + 1}/{pages.length}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* converting indicator - positioned near selection */}
      {isConverting && selectionBounds && (
        <div
          className="fixed z-[1500] bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-[#48A6A7] flex items-center gap-2"
          style={{
            left: `${selectionBounds.left + selectionBounds.width / 2}px`,
            top: `${selectionBounds.top - 50}px`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#48A6A7] border-t-transparent" />
          <span className="text-sm font-medium text-[#006A71] whitespace-nowrap">
            Converting...
          </span>
        </div>
      )}

      {/* fallback converting indicator if no selection bounds */}
      {isConverting && !selectionBounds && (
        <div className="fixed bottom-6 right-6 z-[1500] bg-white px-4 py-3 rounded-lg shadow-lg border-2 border-[#48A6A7] flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#48A6A7] border-t-transparent" />
          <span className="text-sm font-medium text-[#006A71]">
            Converting to LaTeX...
          </span>
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
