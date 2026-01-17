"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

type Tool = "pen" | "eraser" | "clear";

export default function Whiteboard() {
    const canvasRef = useRef<fabric.Canvas | null>(null);
    const [tool, setTool] = useState<Tool>("pen");

    useEffect(() => {
        const canvas = new fabric.Canvas("whiteboard-canvas", {
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: "#ffffff",
        });

        // ✅ Explicitly create the brush
        const brush = new fabric.PencilBrush(canvas);
        brush.width = 2;
        brush.color = "#000000";

        canvas.freeDrawingBrush = brush;
        canvas.isDrawingMode = true;

        canvasRef.current = canvas;

        return () => {
            canvas.dispose();
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.freeDrawingBrush) return;

        if (tool === "pen") {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush.color = "#000000";
            canvas.freeDrawingBrush.width = 2;
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
    }, [tool]);

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: 10,
                    left: 10,
                    zIndex: 100,
                    background: "#f5f5f5",
                    padding: "8px",
                    borderRadius: "6px",
                }}
            >
                <button onClick={() => setTool("pen")}>Pen</button>{" "}
                <button onClick={() => setTool("eraser")}>Eraser</button>{" "}
                <button onClick={() => setTool("clear")}>Clear</button>
            </div>

            <canvas id="whiteboard-canvas" />
        </>
    );
}
