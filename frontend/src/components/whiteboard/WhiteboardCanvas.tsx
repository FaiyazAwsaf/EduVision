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
  eraserWidth?: number;
  tool?: "pencil" | "pen" | "fountain" | "marker" | "eraser" | "select";
  onCanvasReady?: (canvas: fabric.Canvas) => void;
  onPathCreated?: (path: fabric.Path) => void;
  onSelectionReady?: (imageData: string, bounds: { left: number; top: number; width: number; height: number }) => void;
};

/**
 * imperative handle for whiteboard canvas
 * exposes canvas methods to parent components
 */
export type WhiteboardCanvasHandle = {
  getCanvas: () => fabric.Canvas | null;
  clearCanvas: () => void;
  clearRegion: (bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) => void;
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

/**
 * configure brush settings based on tool type
 * centralizes brush behavior logic
 */
function configureBrush(
  canvas: fabric.Canvas,
  tool: "pencil" | "pen" | "fountain" | "marker" | "eraser" | "select",
  penColor: string,
  strokeWidth: number,
  eraserWidth: number,
) {
  if (!canvas.freeDrawingBrush) return;

  const brush = canvas.freeDrawingBrush;

  switch (tool) {
    case "pencil": {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      brush.color = penColor;
      brush.width = strokeWidth * 0.7;
      (brush as any).opacity = 0.35;
      console.log(
        `[Canvas] tool: pencil, color: ${penColor}, width: ${strokeWidth * 0.7}, opacity: 0.35`,
      );
      break;
    }

    case "fountain": {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      brush.color = penColor;
      brush.width = strokeWidth * 1.6;
      (brush as any).opacity = 1.0;
      if ("decimate" in brush) {
        (brush as any).decimate = 0.3;
      }
      console.log(
        `[Canvas] tool: fountain, color: ${penColor}, width: ${strokeWidth * 1.6}, opacity: 1.0`,
      );
      break;
    }

    case "marker": {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      brush.color = penColor;
      brush.width = strokeWidth * 2.0;
      (brush as any).opacity = 0.45;
      console.log(
        `[Canvas] tool: marker, color: ${penColor}, width: ${strokeWidth * 2.0}, opacity: 0.45`,
      );
      break;
    }

    case "pen": {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      brush.color = penColor;
      brush.width = strokeWidth * 1.3;
      (brush as any).opacity = 1.0;
      if ("decimate" in brush) {
        (brush as any).decimate = 0.5;
      }
      if ("shadowBlur" in brush) {
        (brush as any).shadowBlur = 1.5;
      }
      console.log(
        `[Canvas] tool: pen, color: ${penColor}, width: ${strokeWidth * 1.3}, opacity: 1.0`,
      );
      break;
    }

    case "eraser": {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      console.log("[Canvas] tool: eraser (click to delete)");
      break;
    }

    case "select": {
      // 🔲 Select Tool: freehand lasso (drawing disabled)
      canvas.isDrawingMode = false;
      canvas.selection = false;
      console.log("[Canvas] tool: select (lasso - drawing disabled)");
      break;
    }

    default:
      console.warn(`[Canvas] unknown tool: ${tool}`);
  }
}

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
    eraserWidth = 20,
    tool = "pen",
    onCanvasReady,
    onPathCreated,
    onSelectionReady,
  } = props;

  // ============================================================
  // state management
  // ============================================================

  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const htmlCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRemoteUpdateRef = useRef(false);
  // store callback in ref to avoid canvas recreation when callback changes
  const onPathCreatedRef = useRef(onPathCreated);
  const onSelectionReadyRef = useRef(onSelectionReady);

  // keep the ref in sync with the prop
  useEffect(() => {
    onPathCreatedRef.current = onPathCreated;
    onSelectionReadyRef.current = onSelectionReady;
  }, [onPathCreated, onSelectionReady]);

  // ============================================================
  // canvas initialization
  // ============================================================

  /**
   * initialize fabric.js canvas on component mount
   * sets up canvas dimensions, brush, and event listeners
   */
  useEffect(() => {
    if (!containerRef.current || !htmlCanvasRef.current) return;

    console.log("[Canvas] initializing fabric.js canvas...");

    // Use container dimensions if available, otherwise fallback to viewport
    let canvasWidth = containerRef.current.clientWidth;
    let canvasHeight = containerRef.current.clientHeight;
    
    // Fallback to window dimensions if container dimensions are not yet available
    if (canvasWidth === 0 || canvasHeight === 0) {
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      console.log("[Canvas] using window dimensions as fallback:", canvasWidth, "x", canvasHeight);
    }

    console.log("[Canvas] initializing with dimensions:", canvasWidth, "x", canvasHeight);

    const canvas = new fabric.Canvas(htmlCanvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
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

    // Add ResizeObserver to handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && canvasRef.current) {
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        if (newWidth > 0 && newHeight > 0) {
          const currentWidth = canvasRef.current.getWidth();
          const currentHeight = canvasRef.current.getHeight();
          
          // Only resize if dimensions actually changed
          if (newWidth !== currentWidth || newHeight !== currentHeight) {
            canvasRef.current.setDimensions({ width: newWidth, height: newHeight });
            canvasRef.current.renderAll();
            console.log(`[Canvas] resized from ${currentWidth}x${currentHeight} to ${newWidth}x${newHeight}`);
          }
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);

    // listen for path:created events (when user finishes drawing a stroke)
    canvas.on("path:created", (event) => {
      const obj = event.path;

      if (!obj) {
        console.log("[Canvas] path:created event has no path object");
        return;
      }

      if (obj instanceof fabric.Path) {
        console.log("[Canvas] path created event fired, calling onPathCreated");
        // use ref to call the latest callback without causing re-render dependencies
        onPathCreatedRef.current?.(obj);
      } else {
        console.warn(
          "[Canvas] path:created event object is not a fabric.Path",
          obj,
        );
      }
    });

    console.log("[Canvas] canvas initialized successfully");

    // cleanup
    return () => {
      console.log("[Canvas] disposing canvas");
      resizeObserver.disconnect();
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
   * switches between all tool modes
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    configureBrush(canvas, tool, penColor, strokeWidth, eraserWidth);
  }, [tool, penColor, strokeWidth, eraserWidth]);

  // ============================================================
  // lasso selection handler
  // ============================================================

  /**
   * handle lasso selection tool
   * allows freehand drawing of selection boundary
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tool || tool !== "select") {
      return;
    }

    let isDrawingLasso = false;
    let lassoPath: fabric.Path | null = null;
    let tempPath: fabric.Path | null = null;
    const lassoPoints: Array<{ x: number; y: number }> = [];

    // Helper function to check if point is inside polygon (point-in-polygon algorithm)
    const isPointInPolygon = (
      point: { x: number; y: number },
      polygon: Array<{ x: number; y: number }>,
    ): boolean => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x,
          yi = polygon[i].y;
        const xj = polygon[j].x,
          yj = polygon[j].y;

        const intersect =
          yi > point.y !== yj > point.y &&
          point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    // Helper function to check if bounding box intersects with lasso
    const boundingBoxIntersectsLasso = (
      bounds: { left: number; top: number; width: number; height: number },
      lasso: { x: number; y: number }[],
    ): boolean => {
      if (lasso.length < 3) return false;

      const corners = [
        { x: bounds.left, y: bounds.top },
        { x: bounds.left + bounds.width, y: bounds.top },
        { x: bounds.left, y: bounds.top + bounds.height },
        {
          x: bounds.left + bounds.width,
          y: bounds.top + bounds.height,
        },
      ];

      // Check if any corner is inside polygon
      for (const corner of corners) {
        if (isPointInPolygon(corner, lasso)) {
          return true;
        }
      }

      // Check if any polygon point is inside bounding box
      for (const point of lasso) {
        if (
          point.x >= bounds.left &&
          point.x <= bounds.left + bounds.width &&
          point.y >= bounds.top &&
          point.y <= bounds.top + bounds.height
        ) {
          return true;
        }
      }

      return false;
    };

    // Helper function to create SVG path from points
    const createPathFromPoints = (points: Array<{ x: number; y: number }>) => {
      if (points.length === 0) return "";
      const pathData = points
        .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      return pathData;
    };

    const handleMouseDown = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!tool || tool !== "select") return;

      isDrawingLasso = true;
      lassoPoints.length = 0;

      const point = event.scenePoint;
      lassoPoints.push({ x: point.x, y: point.y });
    };

    const handleMouseMove = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingLasso) return;

      const point = event.scenePoint;

      // Add point if it's far enough from the last one (to avoid too many points)
      if (lassoPoints.length === 0 || 
          Math.hypot(
            point.x - lassoPoints[lassoPoints.length - 1].x,
            point.y - lassoPoints[lassoPoints.length - 1].y,
          ) > 5) {
        lassoPoints.push({ x: point.x, y: point.y });
      }

      // Remove old temporary path
      if (tempPath) {
        canvas.remove(tempPath);
        tempPath = null;
      }

      // Create new temporary path with lasso outline
      if (lassoPoints.length > 1) {
        const pathData = createPathFromPoints(lassoPoints);
        tempPath = new fabric.Path(pathData, {
          stroke: "#48A6A7",
          strokeWidth: 2,
          fill: "rgba(72, 166, 167, 0.1)",
          selectable: false,
          evented: false,
          objectCaching: false,
        });
        canvas.add(tempPath);
        canvas.renderAll();
      }
    };

    const handleMouseUp = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingLasso || lassoPoints.length < 3) {
        isDrawingLasso = false;
        if (tempPath) {
          canvas.remove(tempPath);
          tempPath = null;
        }
        canvas.renderAll();
        lassoPoints.length = 0;
        return;
      }

      isDrawingLasso = false;

      // Remove temporary path
      if (tempPath) {
        canvas.remove(tempPath);
        tempPath = null;
      }

      // Close the path
      const lastPoint = lassoPoints[lassoPoints.length - 1];
      const firstPoint = lassoPoints[0];

      if (
        Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y) >
        10
      ) {
        lassoPoints.push(firstPoint);
      }

      // Find all objects that intersect with the lasso
      const objects = canvas.getObjects();
      const selectedObjects: fabric.FabricObject[] = [];

      objects.forEach((obj) => {
        const bounds = obj.getBoundingRect();
        if (
          boundingBoxIntersectsLasso(bounds, lassoPoints)
        ) {
          selectedObjects.push(obj);
        }
      });

      // Create active selection if objects found
      if (selectedObjects.length > 0) {
        const activeSelection = new fabric.ActiveSelection(selectedObjects, {
          canvas,
        });
        canvas.setActiveObject(activeSelection);
        
        // Get bounding box of selected objects
        const bounds = activeSelection.getBoundingRect();
        
        // Use Fabric.js's built-in toDataURL with cropping
        const imageData = canvas.toDataURL({
          format: "png",
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          multiplier: 1,
        });
        
        // Call selection ready callback
        onSelectionReadyRef.current?.(imageData, {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        });
        
        canvas.renderAll();
        console.log(
          `[Canvas] Lasso selection: ${selectedObjects.length} objects selected`,
        );
      } else {
        canvas.discardActiveObject();
        canvas.renderAll();
        console.log("[Canvas] Lasso selection: no objects selected");
      }

      lassoPoints.length = 0;
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      if (tempPath) {
        canvas.remove(tempPath);
      }
    };
  }, [tool]);

  /**
   * handle eraser tool
   * allows clicking on objects to delete them
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tool !== "eraser") {
      return;
    }

    const handleEraserMouseDown = (
      event: fabric.TPointerEventInfo<fabric.TPointerEvent>,
    ) => {
      // Get the pointer position in scene coordinates
      const pointer = event.scenePoint;
      
      // Find the topmost object at the click position
      let clickedObject: fabric.FabricObject | null = null;
      const objects = canvas.getObjects();
      
      // Iterate from top to bottom (reverse order) to find topmost object
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.containsPoint(pointer)) {
          clickedObject = obj;
          break;
        }
      }

      if (clickedObject) {
        canvas.remove(clickedObject);
        canvas.renderAll();
        console.log("[Canvas] Object erased");
      }
    };

    canvas.on("mouse:down", handleEraserMouseDown);

    return () => {
      canvas.off("mouse:down", handleEraserMouseDown);
    };
  }, [tool]);

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

    clearRegion: (bounds: {
      left: number;
      top: number;
      width: number;
      height: number;
    }) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const objects = canvas.getObjects();
      const objectsToRemove: fabric.FabricObject[] = [];

      // find objects that intersect with the bounds
      objects.forEach((obj) => {
        const objBounds = obj.getBoundingRect();

        // check if object intersects with selection bounds
        const intersects = !(
          objBounds.left > bounds.left + bounds.width ||
          objBounds.left + objBounds.width < bounds.left ||
          objBounds.top > bounds.top + bounds.height ||
          objBounds.top + objBounds.height < bounds.top
        );

        if (intersects) {
          objectsToRemove.push(obj);
        }
      });

      // remove intersecting objects
      objectsToRemove.forEach((obj) => {
        canvas.remove(obj);
      });

      canvas.renderAll();
      console.log(
        `[Canvas] cleared ${objectsToRemove.length} objects in region`,
      );
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
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("[Canvas] loadFromJSON skipped - canvas ref is null");
        return;
      }

      // Guard against malformed persisted state.
      const safeObjects = Array.isArray(state?.objects) ? state.objects : [];

      isRemoteUpdateRef.current = true;
      try {
        await canvas.loadFromJSON({
          version: fabric.version,
          objects: safeObjects,
        });

        // Bail out if canvas was disposed/replaced while async load was running.
        if (canvasRef.current !== canvas) {
          return;
        }

        canvas.backgroundColor = "#ffffff";
        canvas.renderAll();
        console.log("[Canvas] loaded canvas state from json");
      } catch (error) {
        console.error("[Canvas] error loading from json:", error);
      } finally {
        isRemoteUpdateRef.current = false;
      }
    },

    addPath: (pathData: PathOptions) => {
      if (canvasRef.current) {
        isRemoteUpdateRef.current = true;
        try {
          console.log("[Canvas] attempting to add remote path:", pathData);
          console.log(
            "[Canvas] current canvas object count before add:",
            canvasRef.current.getObjects().length,
          );

          // create path from received data
          fabric.Path.fromObject(pathData)
            .then((path: fabric.Path) => {
              if (canvasRef.current) {
                canvasRef.current.add(path);
                canvasRef.current.renderAll();
                console.log("[Canvas] added remote path successfully");
                console.log(
                  "[Canvas] current canvas object count after add:",
                  canvasRef.current.getObjects().length,
                );
              }
              isRemoteUpdateRef.current = false;
            })
            .catch((error) => {
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
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'auto', touchAction: 'none' }}>
      <canvas ref={htmlCanvasRef} id="whiteboard-canvas" />
    </div>
  );
});

WhiteboardCanvas.displayName = "WhiteboardCanvas";

export default WhiteboardCanvas;
