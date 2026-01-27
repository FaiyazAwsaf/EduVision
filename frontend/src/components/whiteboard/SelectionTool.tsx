/**
 * selection Tool Component
 * 
 * allows users to draw a rectangular selection on the canvas
 * extracts the selected region as an image for processing
 */

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

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
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const selectionRectRef = useRef<fabric.Rect | null>(null);

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

    // disable drawing mode when tool active
    canvas.isDrawingMode = false;
    canvas.selection = false;

    const getSceneCoords = (ev: fabric.TPointerEventInfo<fabric.TPointerEvent>): { x: number; y: number } => {
      if (ev.scenePoint) {
        return { x: ev.scenePoint.x, y: ev.scenePoint.y };
      }
      const p = canvas.getScenePoint(ev.e);
      return { x: p.x, y: p.y };
    };

    // mouse down: start selection
    const handleMouseDown = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {

      const { x, y } = getSceneCoords(event);
 
      setStartPoint({ x, y });
      setIsSelecting(true);

      // create selection rectangle
      const rect = new fabric.Rect({
        left: x,
        top: y,
        width: 0,
        height: 0,
        fill: 'rgba(0, 123, 255, 0.1)',
        stroke: '#007bff',
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
    const handleMouseMove = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isSelecting || !startPoint || !selectionRectRef.current) return;

        const { x, y } = getSceneCoords(event);
      const rect = selectionRectRef.current;

      // calculate rectangle dimensions
      const width = x - startPoint.x;
      const height = y - startPoint.y;

      // update rectangle (handle negative dimensions for reverse dragging)
      if (width < 0) {
        rect.set({ left: x, width: Math.abs(width) });
      } else {
        rect.set({ width });
      }

      if (height < 0) {
        rect.set({ top: y, height: Math.abs(height) });
      } else {
        rect.set({ height });
      }

      canvas.renderAll();
    };

    // mouse up: complete selection
    const handleMouseUp = () => {
      if (!isSelecting || !selectionRectRef.current) return;

      const rect = selectionRectRef.current;
      const bounds: SelectionBounds = {
        left: rect.left || 0,
        top: rect.top || 0,
        width: rect.width || 0,
        height: rect.height || 0,
      };

      if (bounds.width < 20 || bounds.height < 20) {
        console.log('[SelectionTool] Selection too small, canceling');
        canvas.remove(rect);
        canvas.renderAll();
        setIsSelecting(false);
        setStartPoint(null);
        selectionRectRef.current = null;
        return;
      }

      // extract image data from selection
      const imageData = extractImageFromBounds(canvas, bounds);

      canvas.remove(rect);
      canvas.renderAll();
      selectionRectRef.current = null;
      setIsSelecting(false);
      setStartPoint(null);

      onSelectionComplete(imageData, bounds);
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [canvas, isActive, isSelecting, startPoint, onSelectionComplete]);

  // handle ESC key to cancel selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onCancel]);

  return null; 
}

/**
 * extract image data from a specific region of the canvas
 * returns base64-encoded PNG image
 */
function extractImageFromBounds(
  canvas: fabric.Canvas,
  bounds: SelectionBounds
): string {

  // create temp canvas to extract region
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = bounds.width;
  tempCanvas.height = bounds.height;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('Failed to get canvas context');
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
    bounds.height
  );

  // convert to base64 PNG
  const imageData = tempCanvas.toDataURL('image/png');
  console.log('[SelectionTool] Extracted image data:', imageData.substring(0, 50) + '...');

  return imageData;
}