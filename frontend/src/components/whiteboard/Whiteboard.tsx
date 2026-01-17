"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { PenTool, Eraser, Trash2, Home, Download } from "lucide-react";
import Link from "next/link";

type Tool = "pen" | "eraser" | "clear";

export default function Whiteboard() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [penSize, setPenSize] = useState(2);
  const [penColor, setPenColor] = useState("#006A71");

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = new fabric.Canvas("whiteboard-canvas", {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#ffffff",
    });

    // Create the brush
    const brush = new fabric.PencilBrush(canvas);
    brush.width = penSize;
    brush.color = penColor;

    canvas.freeDrawingBrush = brush;
    canvas.isDrawingMode = true;

    canvasRef.current = canvas;

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current && canvas) {
        canvas.setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        canvas.renderAll();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;

    if (tool === "pen") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = penColor;
      canvas.freeDrawingBrush.width = penSize;
    }

    if (tool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = "#ffffff";
      canvas.freeDrawingBrush.width = 20;
    }

    if (tool === "clear") {
      canvas.clear();
      canvas.backgroundColor = "#ffffff";
      canvas.renderAll();
      setTool("pen");
    }
  }, [tool, penColor, penSize]);

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the whiteboard?")) {
      setTool("clear");
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F2EFE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <PenTool className="w-6 h-6 text-[#006A71]" />
              <h1 className="text-xl font-bold text-[#006A71]">
                Interactive Whiteboard
              </h1>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#48A6A7] hover:text-[#006A71] transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Tool Selection */}
            <div className="flex items-center gap-2 border-r border-[#9ACBD0] pr-4">
              <button
                onClick={() => setTool("pen")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tool === "pen"
                    ? "bg-[#48A6A7] text-white"
                    : "bg-white border border-[#9ACBD0] text-[#48A6A7] hover:border-[#48A6A7]"
                }`}
              >
                <PenTool className="w-4 h-4" />
                Pen
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tool === "eraser"
                    ? "bg-[#48A6A7] text-white"
                    : "bg-white border border-[#9ACBD0] text-[#48A6A7] hover:border-[#48A6A7]"
                }`}
              >
                <Eraser className="w-4 h-4" />
                Eraser
              </button>
            </div>

            {/* Pen Settings */}
            {tool === "pen" && (
              <div className="flex items-center gap-3 border-r border-[#9ACBD0] pr-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[#006A71]">
                    Size:
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={penSize}
                    onChange={(e) => setPenSize(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-[#48A6A7] w-8">
                    {penSize}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[#006A71]">
                    Color:
                  </label>
                  <div className="flex gap-1">
                    {[
                      "#006A71",
                      "#48A6A7",
                      "#000000",
                      "#DC2626",
                      "#EA580C",
                      "#16A34A",
                      "#2563EB",
                      "#9333EA",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={`w-7 h-7 rounded border-2 transition-all ${
                          penColor === color
                            ? "border-[#006A71] scale-110"
                            : "border-[#9ACBD0] hover:border-[#48A6A7]"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm font-medium text-[#48A6A7] hover:border-[#48A6A7] hover:text-[#006A71] transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm font-medium text-red-500 hover:border-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-white m-4 rounded-xl border-2 border-[#9ACBD0] shadow-lg overflow-hidden"
      >
        <canvas id="whiteboard-canvas" />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-[#9ACBD0]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#48A6A7]">
            Use the tools above to draw, erase, or clear the whiteboard
          </p>
        </div>
      </footer>
    </div>
  );
}
