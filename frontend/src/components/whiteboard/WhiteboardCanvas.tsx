/**
 * whiteboard canvas component
 *
 * production-grade canvas component using fabric.js
 * handles drawing, eraser, canvas state management
 * broadcasts events to remote peers via websocket
 */

"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import * as fabric from "fabric";

/**
 * fabric.js path serialization options
 * accepts any object that fabric.Path.fromObject can deserialize
 */
type PathOptions = Record<string, any>;

/**
 * canvas state export format
 */
export type CanvasState = {
  version: string;
  objects: PathOptions[];
};

/**
 * props for whiteboard canvas component
 */
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

/**
 * imperative handle for whiteboard canvas
 * exposes canvas methods to parent components
 */
export type WhiteboardCanvasHandle = {
  getCanvas: () => fabric.Canvas | null;
  clearCanvas: () => void;
  exportToJSON: () => CanvasState;
  loadFromJSON: (state: CanvasState) => Promise<void>;
  addPath: (pathData: PathOptions) => void;
  setDrawingMode: (enabled: boolean) => void;
  setBrushColor: (color: string) => void;
  setBrushWidth: (width: number) => void;
};

/**
 * whiteboard canvas component using fabric.js
 * manages drawing surface and path synchronization
 */
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

  // ============================================================
  // state management
  // ============================================================

  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdateRef = useRef(false);

  // ============================================================
  // canvas initialization
  // ============================================================

  /**
   * initialize fabric.js canvas on component mount
   * sets up canvas dimensions, brush, and event listeners
   */
  useEffect(() => {
    if (!containerRef.current) return;

    console.log("[Canvas] initializing fabric.js canvas...");

    const canvas = new fabric.Canvas("whiteboard-canvas", {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#ffffff",
      isDrawingMode: isDrawingEnabled,
      selection: false,
      renderOnAddRemove: true,
    });

    // initialize brush
    const brush = new fabric.PencilBrush(canvas);
    brush.width = strokeWidth;
    brush.color = penColor;
    canvas.freeDrawingBrush = brush;
    canvas.renderAll();

    canvasRef.current = canvas;

    // notify parent component
    onCanvasReady?.(canvas);

    // listen for path:created events (when user finishes drawing a stroke)
    canvas.on("path:created", (event) => {
      const obj = event.path;

      if(!obj){
        console.log("[Canvas] path:created event has no path object");
        return;
      }

      if(obj instanceof fabric.Path){
        console.log("[Canvas] path created event fired, calling onPathCreated");
        onPathCreated?.(obj);
      } else {
        console.warn("[Canvas] path:created event object is not a fabric.Path", obj);
      }
    });

    console.log("[Canvas] canvas initialized successfully");

    // cleanup
    return () => {
      console.log("[Canvas] disposing canvas");
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [onPathCreated]);

  // ============================================================
  // window resize handler
  // ============================================================

  /**
   * handle canvas resize when window is resized
   * maintains responsive dimensions
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
        console.log(`[Canvas] resized to ${newWidth}x${newHeight}`);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ============================================================
  // drawing mode handler
  // ============================================================

  /**
   * update drawing mode based on isDrawingEnabled prop
   * enables/disables drawing on canvas
   */
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.isDrawingMode = isDrawingEnabled;
      console.log("[Canvas] drawing mode:", isDrawingEnabled);
    }
  }, [isDrawingEnabled]);

  // ============================================================
  // brush settings handler
  // ============================================================

  /**
   * update brush settings based on tool prop
   * switches between pen and eraser modes
   */
  useEffect(() => {
    if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
      if (tool === "pen") {
        canvasRef.current.freeDrawingBrush.color = penColor;
        canvasRef.current.freeDrawingBrush.width = strokeWidth;
      } else if (tool === "eraser") {
        // eraser is implemented as white brush
        canvasRef.current.freeDrawingBrush.color = "#ffffff";
        canvasRef.current.freeDrawingBrush.width = 20;
      }
      console.log(
        `[Canvas] tool: ${tool}, color: ${canvasRef.current.freeDrawingBrush.color}, width: ${canvasRef.current.freeDrawingBrush.width}`
      );
    }
  }, [tool, penColor, strokeWidth]);

  // ============================================================
  // imperative handle methods
  // ============================================================

  /**
   * expose canvas methods and state to parent component
   * allows parent to control canvas programmatically
   */
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,

    clearCanvas: () => {
      if (canvasRef.current) {
        canvasRef.current.clear();
        canvasRef.current.backgroundColor = "#ffffff";
        canvasRef.current.renderAll();
        console.log("[Canvas] canvas cleared");
      }
    },

    exportToJSON: () => {
      if (canvasRef.current) {
        const json = canvasRef.current.toJSON();
        console.log("[Canvas] exported canvas state");
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
          console.log("[Canvas] loaded canvas state from json");
        } catch (error) {
          console.error("[Canvas] error loading from json:", error);
        } finally {
          isRemoteUpdateRef.current = false;
        }
      }
    },

    addPath: (pathData: PathOptions) => {
      if (canvasRef.current) {
        isRemoteUpdateRef.current = true;
        try {
          console.log("[Canvas] attempting to add remote path:", pathData);
          console.log("[Canvas] current canvas object count before add:", canvasRef.current.getObjects().length);

          // create path from received data
          fabric.Path.fromObject(pathData).then((path: fabric.Path) => {
            if (canvasRef.current) {
              canvasRef.current.add(path);
              canvasRef.current.renderAll();
              console.log("[Canvas] added remote path successfully");
              console.log("[Canvas] current canvas object count after add:", canvasRef.current.getObjects().length);
            }
            isRemoteUpdateRef.current = false;
          }).catch((error) => {
            console.error("[Canvas] error creating path from object:", error);
            isRemoteUpdateRef.current = false;
          });
        } catch (error) {
          console.error("[Canvas] error adding path:", error);
          isRemoteUpdateRef.current = false;
        }
      } else {
        console.warn("[Canvas] cannot add path - canvas ref is null");
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

  // ============================================================
  // render
  // ============================================================

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas id="whiteboard-canvas" />
    </div>
  );
});

WhiteboardCanvas.displayName = "WhiteboardCanvas";

export default WhiteboardCanvas;
