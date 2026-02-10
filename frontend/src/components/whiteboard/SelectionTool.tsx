/**
 * selection tool component
 *
 * allows users to draw a rectangular selection on the canvas
 * extracts the selected region as an image for processing
 * shows a convert button after selection is made
 */

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

export default function SelectionTool({
  canvas,
  isActive,
  onSelectionComplete,
  onCancel,
}: SelectionToolProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<SelectionBounds | null>(
    null,
  );
  // store screen position for button placement
  const [buttonPosition, setButtonPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const selectionRectRef = useRef<fabric.Rect | null>(null);

  // reset selection state when tool becomes inactive
  useEffect(() => {
    if (!isActive) {
      setSelectionComplete(false);
      setCurrentBounds(null);
      setIsSelecting(false);
      setStartPoint(null);
      setButtonPosition(null);
    }
  }, [isActive]);

  // handle convert button click
  const handleConvert = useCallback(() => {
    if (!canvas || !currentBounds || !selectionRectRef.current) return;

    // extract image data from selection
    const imageData = extractImageFromBounds(canvas, currentBounds);

    // remove selection rectangle
    canvas.remove(selectionRectRef.current);
    canvas.renderAll();
    selectionRectRef.current = null;

    // reset state
    setSelectionComplete(false);
    setCurrentBounds(null);
    setButtonPosition(null);

    // trigger conversion
    onSelectionComplete(imageData, currentBounds);
  }, [canvas, currentBounds, onSelectionComplete]);

  // handle cancel
  const handleCancel = useCallback(() => {
    if (canvas && selectionRectRef.current) {
      canvas.remove(selectionRectRef.current);
      canvas.renderAll();
      selectionRectRef.current = null;
    }
    setSelectionComplete(false);
    setCurrentBounds(null);
    setButtonPosition(null);
    setIsSelecting(false);
    setStartPoint(null);
    onCancel();
  }, [canvas, onCancel]);

  useEffect(() => {
    if (!canvas || !isActive) {
      // clean up selection rectangle if tool deactivated
      if (selectionRectRef.current && canvas) {
        canvas.remove(selectionRectRef.current);
        canvas.renderAll();
        selectionRectRef.current = null;
      }
      return;
    }

    // only set up mouse handlers if not in selection complete state
    if (selectionComplete) return;

    // get the canvas element for coordinate calculations
    const canvasEl = canvas.getElement();

    // get pointer coordinates relative to canvas
    // in fabric.js 7, we need to use the pointer property from the event
    const getCoordinates = (
      ev: fabric.TPointerEventInfo<fabric.TPointerEvent>,
    ): {
      canvasX: number;
      canvasY: number;
      screenX: number;
      screenY: number;
    } => {
      const mouseEvent = ev.e as MouseEvent;

      // screen position (for button placement)
      const screenX = mouseEvent.clientX;
      const screenY = mouseEvent.clientY;

      // get canvas bounding rect
      const rect = canvasEl.getBoundingClientRect();

      // calculate canvas coordinates accounting for any CSS scaling
      const scaleX = canvas.getWidth() / rect.width;
      const scaleY = canvas.getHeight() / rect.height;

      const canvasX = (mouseEvent.clientX - rect.left) * scaleX;
      const canvasY = (mouseEvent.clientY - rect.top) * scaleY;

      return {
        canvasX,
        canvasY,
        screenX,
        screenY,
      };
    };

    // mouse down: start selection
    const handleMouseDown = (
      event: fabric.TPointerEventInfo<fabric.TPointerEvent>,
    ) => {
      // clear any existing selection rectangle
      if (selectionRectRef.current) {
        canvas.remove(selectionRectRef.current);
        selectionRectRef.current = null;
      }

      const { canvasX, canvasY } = getCoordinates(event);

      setStartPoint({ x: canvasX, y: canvasY });
      setIsSelecting(true);
      setSelectionComplete(false);
      setCurrentBounds(null);

      // create selection rectangle
      const rect = new fabric.Rect({
        left: canvasX,
        top: canvasY,
        width: 0,
        height: 0,
        fill: "rgba(72, 166, 167, 0.15)",
        stroke: "#48A6A7",
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      });

      canvas.add(rect);
      selectionRectRef.current = rect;
      canvas.renderAll();
    };

    // mouse move: update selection rectangle
    // track the last screen position for button placement
    let lastScreenX = 0;
    let lastScreenY = 0;

    const handleMouseMove = (
      event: fabric.TPointerEventInfo<fabric.TPointerEvent>,
    ) => {
      if (!isSelecting || !startPoint || !selectionRectRef.current) return;

      const { canvasX, canvasY, screenX, screenY } = getCoordinates(event);
      const rect = selectionRectRef.current;

      // calculate rectangle bounds (handle dragging in any direction)
      const left = Math.min(startPoint.x, canvasX);
      const top = Math.min(startPoint.y, canvasY);
      const width = Math.abs(canvasX - startPoint.x);
      const height = Math.abs(canvasY - startPoint.y);

      // update all rectangle properties at once
      rect.set({ left, top, width, height });
      rect.setCoords();

      // track screen position for button
      lastScreenX = screenX;
      lastScreenY = screenY;

      canvas.renderAll();
    };

    // mouse up: complete selection and show convert button
    const handleMouseUp = (
      event: fabric.TPointerEventInfo<fabric.TPointerEvent>,
    ) => {
      if (!isSelecting || !selectionRectRef.current) return;

      const rect = selectionRectRef.current;
      const bounds: SelectionBounds = {
        left: rect.left || 0,
        top: rect.top || 0,
        width: rect.width || 0,
        height: rect.height || 0,
      };

      // get final screen position for button placement
      const { screenX, screenY } = getCoordinates(event);

      setIsSelecting(false);
      setStartPoint(null);

      if (bounds.width < 20 || bounds.height < 20) {
        console.log("[SelectionTool] selection too small, canceling");
        canvas.remove(rect);
        canvas.renderAll();
        selectionRectRef.current = null;
        return;
      }

      // calculate button position based on canvas element position
      const canvasEl = canvas.getElement();
      const canvasRect = canvasEl.getBoundingClientRect();

      // position button below the selection rectangle
      // convert canvas coordinates to screen coordinates
      const scaleX = canvasRect.width / canvas.getWidth();
      const scaleY = canvasRect.height / canvas.getHeight();

      const buttonX =
        canvasRect.left + (bounds.left + bounds.width / 2) * scaleX;
      const buttonY =
        canvasRect.top + (bounds.top + bounds.height) * scaleY + 10;

      setButtonPosition({ x: buttonX, y: buttonY });

      // keep the rectangle visible and show convert button
      setCurrentBounds(bounds);
      setSelectionComplete(true);
      console.log(
        "[SelectionTool] selection complete, waiting for user action",
      );
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [canvas, isActive, isSelecting, startPoint, selectionComplete]);

  // handle ESC key to cancel selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleCancel]);

  // render convert button when selection is complete
  if (!isActive || !selectionComplete || !currentBounds || !buttonPosition) {
    return null;
  }

  // position the button near the selection using screen coordinates
  const buttonStyle = {
    position: "fixed" as const,
    left: `${buttonPosition.x}px`,
    top: `${buttonPosition.y}px`,
    transform: "translateX(-50%)",
    zIndex: 2000,
  };

  return (
    <div style={buttonStyle} className="flex gap-2">
      <button
        onClick={handleConvert}
        className="px-4 py-2 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition-colors font-medium flex items-center gap-2"
      >
        <span>📝</span>
        Convert to Notation
      </button>
      <button
        onClick={handleCancel}
        className="px-4 py-2 bg-secondary text-primary-dark rounded-lg shadow-lg hover:bg-background transition-colors font-medium"
      >
        Cancel
      </button>
    </div>
  );
}

/**
 * extract image data from a specific region of the canvas
 * returns base64-encoded PNG image
 */
function extractImageFromBounds(
  canvas: fabric.Canvas,
  bounds: SelectionBounds,
): string {
  // create temp canvas to extract region
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = bounds.width;
  tempCanvas.height = bounds.height;
  const tempCtx = tempCanvas.getContext("2d");

  if (!tempCtx) {
    throw new Error("Failed to get canvas context");
  }

  // get main canvas element
  const mainCanvasElement = canvas.getElement();

  // draw selected region onto temporary canvas
  tempCtx.drawImage(
    mainCanvasElement,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  // convert to base64 PNG
  const imageData = tempCanvas.toDataURL("image/png");
  console.log(
    "[SelectionTool] Extracted image data:",
    imageData.substring(0, 50) + "...",
  );

  return imageData;
}
