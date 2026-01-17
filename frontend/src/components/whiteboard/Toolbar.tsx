"use client";

export default function Toolbar({
    setTool,
}: {
    setTool: (tool: string) => void;
}) {
    return (
        <div style={{ position: "fixed", top: 10, left: 10, zIndex: 10 }}>
            <button onClick={() => setTool("pen")}>Pen</button>
            <button onClick={() => setTool("eraser")}>Eraser</button>
            <button onClick={() => setTool("rect")}>Rectangle</button>
            <button onClick={() => setTool("text")}>Text</button>
            <button onClick={() => setTool("clear")}>Clear</button>
        </div>
    );
}
