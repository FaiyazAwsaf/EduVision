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
import { LatexObject } from "./LatexRenderer";
import { convertHandwritingToLatex, evaluateHandwrittenEquation } from "@/api/geminiService";
import { saveState, WhiteboardState } from "@/api/whiteboardService";
import Toolbar, { Tool } from "./Toolbar";
import VoiceChat from "./VoiceChat";
import { useWebSocket, WebSocketMessage } from "../../hooks/useWebSocket";
import MembersList, { Member } from "./MembersList";
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
  initialPageStates?: WhiteboardState[];
  pageCount?: number;
  onExitSession?: () => Promise<void> | void;
  members?: Member[];
  ownerId?: string;
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

function normalizeLatexPayload(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.latex, obj.katex, obj.expression, obj.original_latex, obj.solution_latex];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
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
  initialPageStates = [],
  pageCount = 1,
  onExitSession,
  members = [],
  ownerId = "",
}: WhiteboardProps) {
  // ============================================================
  // state management
  // ============================================================

  // page management
  const [pages, setPages] = useState<PageData[]>([
    { id: "page-1", canvasState: null, latexObjects: [] },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pagesRef = useRef<PageData[]>([]);
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
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

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

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
  // Load initial state(s) from backend
  // ============================================================
  useEffect(() => {
    if (hasLoadedInitialState || !isCanvasReady || !canvasRef.current) return;

    const loadInitialState = async () => {
      try {
        const canvasHandle = canvasRef.current;
        if (!canvasHandle) return;

        const seedStates = initialPageStates.length > 0
          ? initialPageStates
          : initialState
            ? [initialState]
            : [];

        const highestSeedPage = seedStates.reduce((max, s) => {
          const page = Number(s.page || 1);
          return page > max ? page : max;
        }, 1);

        const resolvedPageCount = Math.max(pageCount, highestSeedPage, 1);
        const seededPages: PageData[] = Array.from({ length: resolvedPageCount }, (_, idx) => ({
          id: `page-${idx + 1}`,
          canvasState: null,
          latexObjects: [],
        }));

        for (const state of seedStates) {
          const targetPage = Math.max(Number(state.page || 1), 1);
          const targetIndex = targetPage - 1;
          if (!seededPages[targetIndex]) continue;

          const snapshot =
            typeof state.snapshot_json === "string"
              ? JSON.parse(state.snapshot_json)
              : state.snapshot_json;

          seededPages[targetIndex] = {
            ...seededPages[targetIndex],
            canvasState: snapshot && typeof snapshot === "object" ? snapshot : null,
            latexObjects: state.latex_objects || [],
          };
        }

        setPages(seededPages);
        setCurrentPageIndex(0);
        setLatexObjects(seededPages[0]?.latexObjects || []);

        if (seededPages[0]?.canvasState) {
          await canvasHandle.loadFromJSON(seededPages[0].canvasState);
        } else {
          canvasHandle.clearCanvas();
        }

        console.log("[Whiteboard] Initial page states restored", {
          pageCount: seededPages.length,
          seededPages: seedStates.length,
        });

        setHasLoadedInitialState(true);
      } catch (error) {
        console.error("[Whiteboard] Error loading initial state:", error);
        setHasLoadedInitialState(true);
      }
    };

    void loadInitialState();
  }, [initialState, initialPageStates, pageCount, hasLoadedInitialState, isCanvasReady]);

  // ============================================================
  // Periodic state saving to backend
  // ============================================================
  useEffect(() => {
    // Save state every 30 seconds
    const saveIntervalId = setInterval(() => {
      if (!canvasRef.current) return;

      const currentCanvasState = canvasRef.current.exportToJSON();
      if (!currentCanvasState) return;

      const currentPage = currentPageIndex + 1;
      const stateToSave = {
        page: currentPage,
        snapshot_json: currentCanvasState,
        latex_objects: latexObjectsRef.current,
        description: `Auto-saved at ${new Date().toLocaleTimeString()}`,
      };

      const hasCanvasObjects = Array.isArray(currentCanvasState?.objects) && currentCanvasState.objects.length > 0;
      const hasLatexObjects = (latexObjectsRef.current?.length || 0) > 0;
      if (!hasCanvasObjects && !hasLatexObjects) {
        return;
      }

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
        stateToSave.page,
      )
        .then(() => {
          console.log("[Whiteboard] State saved successfully");
        })
        .catch((error) => {
          console.error("[Whiteboard] Error saving state:", error);
        });
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveIntervalId);
  }, [sessionId, currentPageIndex]);

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
          if (Number(message.data?.page || 1) !== currentPageIndex + 1) {
            break;
          }
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
          if (Number(message.data?.page || 1) !== currentPageIndex + 1) {
            break;
          }
          // remote clear event
          console.log("[Whiteboard] Remote clear canvas");
          canvasRef.current?.clearCanvas();
          break;

        case "lock_state":
          // update drawing lock state for students
          console.log(
            "[Whiteboard] Received lock_state message:",
            message.data?.isLocked,
            "Role:",
            role,
          );
          if (role === "student") {
            setIsDrawingLocked(Boolean(message.data?.isLocked));
            console.log(
              "[Whiteboard] Student - Drawing lock state updated to:",
              message.data?.isLocked,
            );
          } else {
            console.log("[Whiteboard] Teacher - Ignoring lock_state (teacher can always draw)");
          }
          break;

        case "user_joined":
          console.log("[Whiteboard] User joined:", message.data?.userId);
          break;

        case "user_left":
          console.log("[Whiteboard] User left:", message.data?.userId);
          break;

        case "latex_added":
          if (Number(message.data?.page || 1) !== currentPageIndex + 1) {
            break;
          }
          {
            const payload = message.data;
            const latex = normalizeLatexPayload(message.data?.latex);
            if (!latex || !payload) {
              break;
            }
            // Add remote LaTeX directly to canvas
            void canvasRef.current?.addLatexAsImage(
              latex,
              (payload.left as number) || 0,
              (payload.top as number) || 0,
              (payload.fontSize as number) || 24,
              (payload.width as number) || undefined,
              (payload.height as number) || undefined,
            );
            console.log("[Whiteboard] Remote LaTeX object added");
          }
          break;

        default:
          console.warn("[Whiteboard] Unknown message type:", message.type);
      }
    },
    [role, currentPageIndex],
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
   * navigate to previous page
   */
  const handlePreviousPage = useCallback(async () => {
    if (currentPageIndex === 0 || isTransitioning) return;

    setIsTransitioning(true);
    saveCurrentPage();

    const targetPageIndex = currentPageIndex - 1;
    setCurrentPageIndex(targetPageIndex);

    // Load previous page canvas
    const canvas = canvasRef.current;
    const targetPage = pagesRef.current[targetPageIndex];
    
    if (canvas && targetPage) {
      if (targetPage.canvasState) {
        await canvas.loadFromJSON(targetPage.canvasState);
      } else {
        canvas.clearCanvas();
      }
      setLatexObjects(targetPage.latexObjects || []);
    }

    console.log(`[Whiteboard] Navigated to page ${targetPageIndex + 1}/${pages.length}`);
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentPageIndex, pages.length, saveCurrentPage, isTransitioning]);

  /**
   * navigate to next page (create if needed)
   */
  const handleNextPage = useCallback(async () => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    saveCurrentPage();

    // Create new page if on last page
    if (currentPageIndex === pages.length - 1 && pages.length < 100) {
      const newPageNumber = pages.length + 1;
      const newPage: PageData = {
        id: `page-${newPageNumber}`,
        canvasState: null,
        latexObjects: [],
      };

      setPages((prev) => [...prev, newPage]);
      setCurrentPageIndex(newPageNumber - 1);
      setLatexObjects([]);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.clearCanvas();
      }

      console.log(`[Whiteboard] Created and navigated to new page ${newPageNumber}`);
    } else if (currentPageIndex < pages.length - 1) {
      // Navigate to existing next page
      const targetPageIndex = currentPageIndex + 1;
      setCurrentPageIndex(targetPageIndex);

      const canvas = canvasRef.current;
      const targetPage = pagesRef.current[targetPageIndex];
      
      if (canvas && targetPage) {
        if (targetPage.canvasState) {
          await canvas.loadFromJSON(targetPage.canvasState);
        } else {
          canvas.clearCanvas();
        }
        setLatexObjects(targetPage.latexObjects || []);
      }

      console.log(`[Whiteboard] Navigated to page ${targetPageIndex + 1}/${pages.length}`);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentPageIndex, pages.length, saveCurrentPage, isTransitioning]);

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

  // Debug logging for drawing permission changes
  useEffect(() => {
    console.log("[Whiteboard] canDraw updated:", {
      canDraw,
      role,
      isDrawingLocked,
      reason: role === "teacher" ? "teacher (always allowed)" : isDrawingLocked ? "locked" : "unlocked"
    });
  }, [canDraw, role, isDrawingLocked]);

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

  const [isExiting, setIsExiting] = useState(false);

  const handleSaveAndExit = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      const currentCanvasState = canvasRef.current?.exportToJSON();
      if (currentCanvasState) {
        await saveState(
          sessionId,
          currentCanvasState,
          latexObjectsRef.current,
          `Saved on exit at ${new Date().toLocaleTimeString()}`,
          currentPageIndex + 1,
        );
      }

      await onExitSession?.();
    } catch (error) {
      console.error("[Whiteboard] Error during save and exit:", error);
    } finally {
      setIsExiting(false);
    }
  }, [isExiting, onExitSession, sessionId, currentPageIndex]);

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
        const normalizedLatex = normalizeLatexPayload(result.latex);

        if (result.success && normalizedLatex) {
          // clear the hand-drawn content in the selected region
          canvasRef.current?.clearRegion(bounds);

          // Calculate font size based on bounds
          const fontSize = Math.min(Math.max(bounds.height * 0.6, 16), 48);

          // Add LaTeX directly to canvas as selectable image
          await canvasRef.current?.addLatexAsImage(
            normalizedLatex,
            bounds.left,
            bounds.top,
            fontSize,
            bounds.width,
            bounds.height,
          );

          // broadcast to other users
          if (websocket.isConnected) {
            websocket.sendMessage({
              type: "latex_added",
              data: {
                latex: normalizedLatex,
                left: bounds.left,
                top: bounds.top,
                fontSize: fontSize,
                width: bounds.width,
                height: bounds.height,
                page: currentPageIndex + 1,
              },
            });
          }

          captureHistory();

          console.log(
            "[Whiteboard] LaTeX conversion successful:",
            normalizedLatex,
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
    [websocket, currentPageIndex, captureHistory],
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
   * Evaluate a handwritten equation and display both original and solution
   */
  const handleEvaluateEquation = useCallback(() => {
    if (!selectionData) return;
    const { imageData, bounds } = selectionData;
    setSelectionData(null);
    setIsConverting(true);

    (async () => {
      try {
        // Call evaluate endpoint
        const result = await evaluateHandwrittenEquation(imageData);
        const originalLatex = normalizeLatexPayload(result.original_latex);
        const solutionLatex = normalizeLatexPayload(result.solution_latex);

        if (result.success && solutionLatex) {
          // Clear the hand-drawn content in the selected region
          canvasRef.current?.clearRegion(bounds);

          // Calculate font size
          const fontSize = Math.min(Math.max(bounds.height * 0.6, 16), 48);

          // Add only the evaluated solution at the selected area
          await canvasRef.current?.addLatexAsImage(
            solutionLatex,
            bounds.left,
            bounds.top,
            fontSize,
            bounds.width,
            bounds.height,
          );

          // Broadcast to other users
          if (websocket.isConnected) {
            websocket.sendMessage({
              type: "latex_added",
              data: {
                latex: solutionLatex,
                left: bounds.left,
                top: bounds.top,
                fontSize: fontSize,
                width: bounds.width,
                height: bounds.height,
                page: currentPageIndex + 1,
              },
            });
          }

          captureHistory();

          console.log(
            "[Whiteboard] Equation evaluation successful:",
            solutionLatex,
          );
        } else {
          console.error("[Whiteboard] Equation evaluation failed:", result.error);
        }
      } catch (error) {
        console.error("[Whiteboard] Error during evaluation:", error);
      } finally {
        setIsConverting(false);
        setCurrentTool("pen");
      }
    })();
  }, [selectionData, websocket, currentPageIndex, captureHistory]);

  /**
   * handle local drawing events
   * broadcasts path data to all connected peers
   */
  const handlePathCreated = useCallback(
    (path: CanvasPath) => {
      if (isApplyingHistoryRef.current) return;
      if (currentTool === "select") return;
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
        data: { pathData, page: currentPageIndex + 1 },
      });

      console.log("[Whiteboard] Broadcasted path to peers");
      captureHistory();
    },
    [websocket, canDraw, captureHistory, currentPageIndex, currentTool],
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
      data: { page: currentPageIndex + 1 },
    });

    console.log("[Whiteboard] Cleared canvas");
  }, [role, selectionBounds, websocket, currentPageIndex]);

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

      console.log("[Whiteboard] Teacher toggling lock to:", newLockState);

      if (websocket.isConnected) {
        websocket.sendMessage({
          type: "lock_state",
          data: { isLocked: newLockState },
        });
        console.log("[Whiteboard] Lock state broadcasted via WebSocket");
      } else {
        console.warn("[Whiteboard] Cannot broadcast lock state - WebSocket not connected");
      }

      return newLockState;
    });
  }, [role, websocket]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="w-screen h-screen bg-[#1a1a1a] flex overflow-hidden">
      {/* Voice chat bar */}
      <VoiceChat sessionId={sessionId} userId={userId} role={role} />

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
          onEvaluateEquation={handleEvaluateEquation}
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
          onSaveExit={() => void handleSaveAndExit()}
          isExiting={isExiting}
          currentPageIndex={currentPageIndex}
          totalPages={pages.length}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          isTransitioning={isTransitioning}
        />
      </div>

      {/* Members List */}
      <MembersList
        members={members}
        ownerId={ownerId}
        isConnected={websocket.isConnected}
      />

      {/* current page - single page display with transitions */}
      <div className="flex-1 h-screen relative overflow-hidden">
        <div
          className={`w-full h-full bg-white relative transition-opacity duration-300 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <WhiteboardCanvas
            ref={canvasRef}
            isDrawingEnabled={canDraw}
            penColor={penColor}
            strokeWidth={strokeWidth}
            eraserWidth={eraserWidth}
            tool={currentTool}
            onPathCreated={handlePathCreated}
            onSelectionReady={handleSelectionReady}
            onObjectModified={captureHistory}
            onCanvasReady={() => {
              setIsCanvasReady(true);
              historyRef.current.undo = [];
              historyRef.current.redo = [];
              lastSnapshotRef.current = "";
              captureHistory([]);
            }}
          />

          {/* page number indicator */}
          <div className="fixed top-20 right-2.5 text-gray-600 text-sm z-[900] font-medium">
            {currentPageIndex + 1}/{pages.length}
          </div>
        </div>
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
    </div>
  );
}
