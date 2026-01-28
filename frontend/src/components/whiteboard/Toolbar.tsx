/**
 * toolbar component
 *
 * provides ui controls for the whiteboard
 * handles tool selection, color picker, and canvas controls
 */

"use client";

import { useEffect, useState } from "react";

export type Tool = "pen" | "eraser" | "select";

export type ToolbarProps = {
  role: "teacher" | "student";
  currentTool: Tool;
  penColor: string;
  strokeWidth: number;
  eraserWidth: number;
  isDrawingLocked: boolean;
  isConnected: boolean;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onEraserWidthChange: (width: number) => void;
  onClear: () => void;
  onExport: () => void;
  onToggleLock?: () => void;
};

const COLORS = [
  "#000000", // black
  "#FF0000", // red
  "#00FF00", // green
  "#0000FF", // blue
  "#FFFF00", // yellow
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFA500", // orange
  "#800080", // purple
  "#A52A2A", // brown
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];
const ERASER_WIDTHS = [10, 20, 30, 40, 50];

export default function Toolbar(props: ToolbarProps) {
  const {
    role,
    currentTool,
    penColor,
    strokeWidth,
    eraserWidth,
    isDrawingLocked,
    isConnected,
    onToolChange,
    onColorChange,
    onStrokeWidthChange,
    onEraserWidthChange,
    onClear,
    onExport,
    onToggleLock,
  } = props;

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [showEraserPicker, setShowEraserPicker] = useState(false);

  const canDraw = role === "teacher" || !isDrawingLocked;
  const isDisabled = !isConnected || !canDraw;

  // close pickers when tool changes
  useEffect(() => {
    setShowColorPicker(false);
    setShowStrokePicker(false);
    setShowEraserPicker(false);
  }, [currentTool]);

  return (
    <div className="fixed top-2.5 left-2.5 bg-[#F2EFE7] p-3 rounded-lg shadow-lg border border-[#9ACBD0] z-[1000] flex flex-col gap-2 min-w-[180px] max-h-[90vh] overflow-y-auto">
      {/* connection Status */}
      <div className="flex flex-col gap-1.5">
        <div
          className={`px-2 py-1.5 rounded text-center text-sm font-bold text-[#F2EFE7] ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {isConnected ? "🟢" : "🔴"}
        </div>
        <span className="text-[#006A71] text-xs text-center">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="h-px bg-[#9ACBD0] my-1" />

      {/* Drawing Tools */}
      {canDraw && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#006A71] text-xs font-bold uppercase">
              Drawing
            </span>

            {(["pen", "eraser", "select"] as Tool[]).map((tool) => (
              <button
                key={tool}
                type="button"
                disabled={isDisabled && tool != "select"}
                onClick={() => onToolChange(tool)}
                className={`px-3 py-2 border rounded text-sm flex items-center gap-1.5 transition-all
                  ${
                    currentTool === tool
                      ? "bg-[#48A6A7] text-[#F2EFE7] font-bold border-[#48A6A7]"
                      : "bg-[#F2EFE7] text-[#006A71] border-[#9ACBD0]"
                  }
                  ${isDisabled && tool !== "select" ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {tool === "pen"
                  ? "✏️ Pen"
                  : tool === "eraser"
                    ? "🧹 Eraser"
                    : "🔲 Select"}
              </button>
            ))}
          </div>

          {/* pen controls */}
          {currentTool === "pen" && (
            <>
              {/* color picker */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setShowColorPicker((v) => !v)}
                  className="px-3 py-2 border border-[#9ACBD0] rounded bg-[#F2EFE7] text-[#006A71] text-sm flex items-center gap-2"
                >
                  <span
                    className="w-4 h-4 rounded-full border-2 border-[#006A71]"
                    style={{ backgroundColor: penColor }}
                  />
                  Color
                </button>

                {showColorPicker && (
                  <div className="grid grid-cols-5 gap-1.5 p-2 border rounded">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          onColorChange(color);
                          setShowColorPicker(false);
                        }}
                        className="w-7 h-7 rounded hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: color,
                          border:
                            color === penColor
                              ? "3px solid white"
                              : "1px solid #ccc",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* stroke width */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setShowStrokePicker((v) => !v)}
                  className="px-3 py-2 border border-[#9ACBD0] rounded bg-[#F2EFE7] text-[#006A71] text-sm"
                >
                  Width: {strokeWidth}px
                </button>

                {showStrokePicker && (
                  <div className="grid grid-cols-3 gap-1.5 p-2 border rounded">
                    {STROKE_WIDTHS.map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => {
                          onStrokeWidthChange(width);
                          setShowStrokePicker(false);
                        }}
                        className={`px-2 py-1 rounded text-xs ${
                          width === strokeWidth
                            ? "bg-[#48A6A7] text-white"
                            : "bg-[#F2EFE7] text-[#006A71]"
                        }`}
                      >
                        {width}px
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* eraser controls */}
          {currentTool === "eraser" && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => setShowEraserPicker((v) => !v)}
                className="px-3 py-2 border border-[#9ACBD0] rounded bg-[#F2EFE7] text-[#006A71] text-sm"
              >
                Eraser: {eraserWidth}px
              </button>

              {showEraserPicker && (
                <div className="grid grid-cols-3 gap-1.5 p-2 border rounded">
                  {ERASER_WIDTHS.map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => {
                        onEraserWidthChange(width);
                        setShowEraserPicker(false);
                      }}
                      className={`px-2 py-1 rounded text-xs ${
                        width === eraserWidth
                          ? "bg-[#48A6A7] text-white"
                          : "bg-[#F2EFE7] text-[#006A71]"
                      }`}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* select tool info */}
          {currentTool === "select" && (
            <div className="text-xs text-[#48A6A7] p-2 bg-[#9ACBD0]/20 rounded">
              Draw a rectangle to select an area, then click "Convert to
              Notation"
            </div>
          )}

          <div className="h-px bg-[#9ACBD0] my-1" />
        </>
      )}

      {/* canvas actions */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[#006A71] text-xs font-bold uppercase">
          Canvas
        </span>

        {role === "teacher" && (
          <button type="button" onClick={onClear} className="toolbar-btn">
            🗑️ Clear
          </button>
        )}

        <button type="button" onClick={onExport} className="toolbar-btn">
          💾 Export
        </button>
      </div>

      {/* permissions */}
      {role === "teacher" && onToggleLock && (
        <>
          <div className="h-px bg-[#9ACBD0] my-1" />
          <button
            type="button"
            onClick={onToggleLock}
            className={`px-3 py-2 rounded text-sm text-white ${
              isDrawingLocked ? "bg-[#006A71]" : "bg-[#48A6A7]"
            }`}
          >
            {isDrawingLocked ? "🔒 Locked" : "🔓 Unlocked"}
          </button>
        </>
      )}
    </div>
  );
}
