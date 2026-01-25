/**
 * Toolbar Component
 *
 * Provides UI controls for the whiteboard
 * Handles tool selection, color picker, and canvas controls
 */

"use client";

import { useState } from "react";

export type Tool = "pen" | "eraser";

export type ToolbarProps = {
  role: "teacher" | "student";
  currentTool: Tool;
  penColor: string;
  strokeWidth: number;
  isDrawingLocked: boolean;
  isConnected: boolean;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onClear: () => void;
  onExport: () => void;
  onToggleLock?: () => void;
};

const COLORS = [
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#A52A2A", // Brown
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

export default function Toolbar(props: ToolbarProps) {
  const {
    role,
    currentTool,
    penColor,
    strokeWidth,
    isDrawingLocked,
    isConnected,
    onToolChange,
    onColorChange,
    onStrokeWidthChange,
    onClear,
    onExport,
    onToggleLock,
  } = props;

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);

  const canDraw = role === "teacher" || !isDrawingLocked;

  return (
    <div style={styles.container}>
      {/* Connection Status */}
      <div style={styles.section}>
        <div
          style={{
            ...styles.indicator,
            backgroundColor: isConnected ? "#00ff00" : "#ff0000",
          }}
        >
          {isConnected ? "🟢" : "🔴"}
        </div>
        <span style={styles.label}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div style={styles.divider} />

      {/* Drawing Tools */}
      {canDraw && (
        <>
          <div style={styles.section}>
            <span style={styles.sectionTitle}>Drawing</span>
            <button
              style={{
                ...styles.button,
                ...(currentTool === "pen" ? styles.buttonActive : {}),
              }}
              onClick={() => onToolChange("pen")}
              title="Pen Tool"
            >
              ✏️ Pen
            </button>
            <button
              style={{
                ...styles.button,
                ...(currentTool === "eraser" ? styles.buttonActive : {}),
              }}
              onClick={() => onToolChange("eraser")}
              title="Eraser Tool"
            >
              🧹 Eraser
            </button>
          </div>

          {/* Color Picker */}
          {currentTool === "pen" && (
            <div style={styles.section}>
              <button
                style={styles.button}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <span
                  style={{
                    ...styles.colorPreview,
                    backgroundColor: penColor,
                  }}
                />
                Color
              </button>
              {showColorPicker && (
                <div style={styles.picker}>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      style={{
                        ...styles.colorSwatch,
                        backgroundColor: color,
                        border:
                          color === penColor
                            ? "3px solid #fff"
                            : "1px solid #ccc",
                      }}
                      onClick={() => {
                        onColorChange(color);
                        setShowColorPicker(false);
                      }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stroke Width Picker */}
          {currentTool === "pen" && (
            <div style={styles.section}>
              <button
                style={styles.button}
                onClick={() => setShowStrokePicker(!showStrokePicker)}
              >
                Width: {strokeWidth}px
              </button>
              {showStrokePicker && (
                <div style={styles.picker}>
                  {STROKE_WIDTHS.map((width) => (
                    <button
                      key={width}
                      style={{
                        ...styles.widthButton,
                        backgroundColor:
                          width === strokeWidth ? "#48A6A7" : "#F2EFE7",
                        color: width === strokeWidth ? "#F2EFE7" : "#006A71",
                      }}
                      onClick={() => {
                        onStrokeWidthChange(width);
                        setShowStrokePicker(false);
                      }}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={styles.divider} />
        </>
      )}

      {/* Canvas Actions */}
      <div style={styles.section}>
        <span style={styles.sectionTitle}>Canvas</span>
        {role === "teacher" && (
          <button style={styles.button} onClick={onClear} title="Clear Canvas">
            🗑️ Clear
          </button>
        )}
        <button style={styles.button} onClick={onExport} title="Export Canvas">
          💾 Export
        </button>
      </div>

      {/* Permission Controls (Teacher Only) */}
      {role === "teacher" && onToggleLock && (
        <>
          <div style={styles.divider} />
          <div style={styles.section}>
            <span style={styles.sectionTitle}>Permissions</span>
            <button
              style={{
                ...styles.button,
                backgroundColor: isDrawingLocked ? "#006A71" : "#48A6A7",
                color: "#F2EFE7",
                border: "none",
              }}
              onClick={onToggleLock}
              title="Toggle Student Drawing"
            >
              {isDrawingLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          </div>
        </>
      )}

      {/* Drawing Lock Indicator (Student) */}
      {role === "student" && isDrawingLocked && (
        <>
          <div style={styles.divider} />
          <div style={styles.section}>
            <div
              style={{
                ...styles.indicator,
                backgroundColor: "#f44336",
              }}
            >
              🔒 Drawing Locked
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    top: 10,
    left: 10,
    backgroundColor: "#F2EFE7",
    padding: "12px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,106,113,0.2)",
    border: "1px solid #9ACBD0",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "180px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    position: "relative",
  },
  sectionTitle: {
    color: "#006A71",
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: "2px",
  },
  button: {
    padding: "8px 12px",
    border: "1px solid #9ACBD0",
    borderRadius: "4px",
    backgroundColor: "#F2EFE7",
    color: "#006A71",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  buttonActive: {
    backgroundColor: "#48A6A7",
    color: "#F2EFE7",
    fontWeight: "bold",
    border: "1px solid #48A6A7",
  },
  divider: {
    height: "1px",
    backgroundColor: "#9ACBD0",
    margin: "4px 0",
  },
  indicator: {
    padding: "6px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    textAlign: "center",
    color: "#F2EFE7",
    fontWeight: "bold",
  },
  label: {
    color: "#006A71",
    fontSize: "12px",
    textAlign: "center",
  },
  colorPreview: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #006A71",
  },
  picker: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "6px",
    padding: "8px",
    backgroundColor: "#F2EFE7",
    borderRadius: "4px",
    marginTop: "4px",
    border: "1px solid #9ACBD0",
  },
  colorSwatch: {
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  widthButton: {
    padding: "6px",
    border: "1px solid #9ACBD0",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    backgroundColor: "#F2EFE7",
    color: "#006A71",
  },
};
