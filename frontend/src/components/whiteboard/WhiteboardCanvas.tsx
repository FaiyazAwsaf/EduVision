/**
 * WhiteboardCanvas Component
 *
 * Production-grade canvas component using Fabric.js
 * Handles drawing, eraser, canvas state management
 * Broadcasts events to remote peers via WebSocket
 */

"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as fabric from "fabric";

export type CanvasState = {
  version: string;
  objects: any[];
};

export type WhiteboardCanvasProps = {
  width?: number;
  height?: number;
  isDrawingEnabled?: boolean;
  penColor?: string;
  strokeWidth?: number;
  tool?: "pen" | "eraser";
  onCanvasReady?: (canvas: fabric.Canvas) => void;
  onPathCreated?: (path: fabric.Path) => void;
};

export type WhiteboardCanvasHandle = {
  getCanvas: () => fabric.Canvas | null;
  clearCanvas: () => void;
  exportToJSON: () => CanvasState;
  loadFromJSON: (state: CanvasState) => Promise<void>;
  addPath: (pathData: any) => void;
  setDrawingMode: (enabled: boolean) => void;
  setBrushColor: (color: string) => void;
  setBrushWidth: (width: number) => void;
};

const WhiteboardCanvas = forwardRef<
  WhiteboardCanvasHandle,
  WhiteboardCanvasProps
>((props, ref) => {
  const {
    width = 1920,
    height = 1080,
    isDrawingEnabled = true,
    penColor = "#000000",
    strokeWidth = 2,
    tool = "pen",
    onCanvasReady,
    onPathCreated,
  } = props;

  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdateRef = useRef(false);

  /**
   * Initialize Fabric.js canvas
   */
  useEffect(() => {
    if (!containerRef.current) return;

    console.log("[Canvas] Initializing Fabric.js canvas...");

    const canvas = new fabric.Canvas("whiteboard-canvas", {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#ffffff",
      isDrawingMode: isDrawingEnabled,
      selection: false, // Disable object selection for drawing mode
      renderOnAddRemove: true,
    });

    // Initialize brush
    const brush = new fabric.PencilBrush(canvas);
    brush.width = strokeWidth;
    brush.color = penColor;
    canvas.freeDrawingBrush = brush;

    canvasRef.current = canvas;

    // Notify parent component
    onCanvasReady?.(canvas);

    // Listen for path:created events (when user finishes drawing a stroke)
    canvas.on("path:created", (event: any) => {
      // Only broadcast if this is a local drawing (not a remote update)
      if (!isRemoteUpdateRef.current && event.path) {
        console.log("[Canvas] Local path created");
        onPathCreated?.(event.path);
      }
    });

    console.log("[Canvas] Canvas initialized successfully");

    // Cleanup
    return () => {
      console.log("[Canvas] Disposing canvas");
      canvas.dispose();
      canvasRef.current = null;
    };
  }, []); // Run once on mount

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;

        canvasRef.current.setDimensions({
          width: newWidth,
          height: newHeight,
        });
        canvasRef.current.renderAll();
        console.log(`[Canvas] Resized to ${newWidth}x${newHeight}`);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Update drawing mode based on isDrawingEnabled prop
   */
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.isDrawingMode = isDrawingEnabled;
      console.log("[Canvas] Drawing mode:", isDrawingEnabled);
    }
  }, [isDrawingEnabled]);

  /**
   * Update brush settings based on tool prop
   */
  useEffect(() => {
    if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
      if (tool === "pen") {
        canvasRef.current.freeDrawingBrush.color = penColor;
        canvasRef.current.freeDrawingBrush.width = strokeWidth;
      } else if (tool === "eraser") {
        // Eraser is implemented as white brush
        canvasRef.current.freeDrawingBrush.color = "#ffffff";
        canvasRef.current.freeDrawingBrush.width = 20;
      }
      console.log(
        `[Canvas] Tool: ${tool}, Color: ${canvasRef.current.freeDrawingBrush.color}, Width: ${canvasRef.current.freeDrawingBrush.width}`,
      );
    }
  }, [tool, penColor, strokeWidth]);

  /**
   * Expose methods to parent via ref
   */
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,

    clearCanvas: () => {
      if (canvasRef.current) {
        canvasRef.current.clear();
        canvasRef.current.backgroundColor = "#ffffff";
        canvasRef.current.renderAll();
        console.log("[Canvas] Canvas cleared");
      }
    },

    exportToJSON: () => {
      if (canvasRef.current) {
        const json = canvasRef.current.toJSON();
        console.log("[Canvas] Exported canvas state");
        return {
          version: "1.0",
          objects: json.objects || [],
        };
      }
      return { version: "1.0", objects: [] };
    },

    loadFromJSON: async (state: CanvasState) => {
      if (canvasRef.current) {
        isRemoteUpdateRef.current = true;
        try {
          await canvasRef.current.loadFromJSON({
            version: fabric.version,
            objects: state.objects,
          });
          canvasRef.current.renderAll();
          console.log("[Canvas] Loaded canvas state from JSON");
        } catch (error) {
          console.error("[Canvas] Error loading from JSON:", error);
        } finally {
          isRemoteUpdateRef.current = false;
        }
      }
    },

    addPath: (pathData: any) => {
      if (canvasRef.current) {
        isRemoteUpdateRef.current = true;
        try {
          // Create path from received data
          fabric.Path.fromObject(pathData).then((path: fabric.Path) => {
            if (canvasRef.current) {
              canvasRef.current.add(path);
              canvasRef.current.renderAll();
              console.log("[Canvas] Added remote path");
            }
            isRemoteUpdateRef.current = false;
          });
        } catch (error) {
          console.error("[Canvas] Error adding path:", error);
          isRemoteUpdateRef.current = false;
        }
      }
    },

    setDrawingMode: (enabled: boolean) => {
      if (canvasRef.current) {
        canvasRef.current.isDrawingMode = enabled;
      }
    },

    setBrushColor: (color: string) => {
      if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
        canvasRef.current.freeDrawingBrush.color = color;
      }
    },

    setBrushWidth: (width: number) => {
      if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
        canvasRef.current.freeDrawingBrush.width = width;
      }
    },
  }));

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas id="whiteboard-canvas" />
    </div>
  );
});

WhiteboardCanvas.displayName = "WhiteboardCanvas";

export default WhiteboardCanvas;
