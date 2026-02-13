import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";

export type SelectionBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SelectionToolProps = {
  canvas: fabric.Canvas | null;
  isActive: boolean;
  onSelectionComplete: (imageData: string, bounds: SelectionBounds) => void;
  onCancel: () => void;
};

type Point = { x: number; y: number };
type Coordinates = Point & { screenX: number; screenY: number };

const MIN_SELECTION_SIZE = 20;
const SELECTION_STYLE = {
  fill: "rgba(72, 166, 167, 0.15)",
  stroke: "#48A6A7",
  strokeWidth: 2,
  strokeDashArray: [5, 5],
  selectable: false,
  evented: false,
};

export default function SelectionTool({
  canvas,
  isActive,
  onSelectionComplete,
  onCancel,
}: SelectionToolProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<SelectionBounds | null>(null);
  const [buttonPosition, setButtonPosition] = useState<Point | null>(null);
  const selectionRectRef = useRef<fabric.Rect | null>(null);

  const resetState = useCallback(() => {
    setSelectionComplete(false);
    setCurrentBounds(null);
    setIsSelecting(false);
    setStartPoint(null);
    setButtonPosition(null);
  }, []);

  const removeSelectionRect = useCallback(() => {
    if (canvas && selectionRectRef.current) {
      canvas.remove(selectionRectRef.current);
      canvas.renderAll();
      selectionRectRef.current = null;
    }
  }, [canvas]);

  const getCoordinates = useCallback(
    (ev: fabric.TPointerEventInfo<fabric.TPointerEvent>): Coordinates => {
      if (!canvas) throw new Error("Canvas not available");
      
      const mouseEvent = ev.e as MouseEvent;
      const scenePoint = ev.scenePoint;
      
      return {
        x: scenePoint.x,
        y: scenePoint.y,
        screenX: mouseEvent.clientX,
        screenY: mouseEvent.clientY,
      };
    },
    [canvas]
  );

  const calculateButtonPosition = useCallback(
    (bounds: SelectionBounds): Point => {
      if (!canvas) throw new Error("Canvas not available");

      const canvasEl = canvas.getElement();
      const canvasRect = canvasEl.getBoundingClientRect();
      const scaleX = canvasRect.width / canvas.getWidth();
      const scaleY = canvasRect.height / canvas.getHeight();

      return {
        x: canvasRect.left + (bounds.left + bounds.width / 2) * scaleX,
        y: canvasRect.top + (bounds.top + bounds.height) * scaleY + 10,
      };
    },
    [canvas]
  );

  const handleConvert = useCallback(() => {
    if (!canvas || !currentBounds || !selectionRectRef.current) return;

    const imageData = extractImageFromBounds(canvas, currentBounds);
    removeSelectionRect();
    resetState();
    onSelectionComplete(imageData, currentBounds);
  }, [canvas, currentBounds, onSelectionComplete, removeSelectionRect, resetState]);

  const handleCancel = useCallback(() => {
    removeSelectionRect();
    resetState();
    onCancel();
  }, [removeSelectionRect, resetState, onCancel]);

  useEffect(() => {
    if (!isActive) {
      resetState();
    }
  }, [isActive, resetState]);

  useEffect(() => {
    if (!canvas || !isActive || selectionComplete) {
      if (!isActive) removeSelectionRect();
      return;
    }

    const handleMouseDown = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      removeSelectionRect();
      
      const coords = getCoordinates(event);
      setStartPoint({ x: coords.x, y: coords.y });
      setIsSelecting(true);
      setSelectionComplete(false);
      setCurrentBounds(null);

      const rect = new fabric.Rect({
        left: coords.x,
        top: coords.y,
        width: 0,
        height: 0,
        ...SELECTION_STYLE,
      });

      canvas.add(rect);
      selectionRectRef.current = rect;
      canvas.renderAll();
    };

    const handleMouseMove = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isSelecting || !startPoint || !selectionRectRef.current) return;

      const coords = getCoordinates(event);
      const rect = selectionRectRef.current;

      const width = coords.x - startPoint.x;
      const height = coords.y - startPoint.y;

      rect.set({ width, height });
      rect.setCoords();
      canvas.renderAll();
    };

    const handleMouseUp = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isSelecting || !selectionRectRef.current) return;

      const rect = selectionRectRef.current;
      const rectLeft = rect.left || 0;
      const rectTop = rect.top || 0;
      const rectWidth = rect.width || 0;
      const rectHeight = rect.height || 0;

      const bounds: SelectionBounds = {
        left: rectWidth < 0 ? rectLeft + rectWidth : rectLeft,
        top: rectHeight < 0 ? rectTop + rectHeight : rectTop,
        width: Math.abs(rectWidth),
        height: Math.abs(rectHeight),
      };

      setIsSelecting(false);
      setStartPoint(null);

      if (bounds.width < MIN_SELECTION_SIZE || bounds.height < MIN_SELECTION_SIZE) {
        removeSelectionRect();
        return;
      }

      setButtonPosition(calculateButtonPosition(bounds));
      setCurrentBounds(bounds);
      setSelectionComplete(true);
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [
    canvas,
    isActive,
    isSelecting,
    startPoint,
    selectionComplete,
    getCoordinates,
    removeSelectionRect,
    calculateButtonPosition,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleCancel]);

  if (!isActive || !selectionComplete || !currentBounds || !buttonPosition) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: `${buttonPosition.x}px`,
        top: `${buttonPosition.y}px`,
        transform: "translateX(-50%)",
        zIndex: 2000,
      }}
      className="flex gap-2"
    >
      <button
        onClick={handleConvert}
        className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg shadow-lg hover:bg-[#006A71] transition-colors font-medium flex items-center gap-2"
      >
        <span>📝</span>
        Convert to Notation
      </button>
      <button
        onClick={handleCancel}
        className="px-4 py-2 bg-[#9ACBD0] text-[#006A71] rounded-lg shadow-lg hover:bg-[#F2EFE7] transition-colors font-medium"
      >
        Cancel
      </button>
    </div>
  );
}

function extractImageFromBounds(
  canvas: fabric.Canvas,
  bounds: SelectionBounds
): string {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = bounds.width;
  tempCanvas.height = bounds.height;
  const tempCtx = tempCanvas.getContext("2d");

  if (!tempCtx) {
    throw new Error("Failed to get canvas context");
  }

  const mainCanvasElement = canvas.getElement();
  tempCtx.drawImage(
    mainCanvasElement,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  return tempCanvas.toDataURL("image/png");
}
