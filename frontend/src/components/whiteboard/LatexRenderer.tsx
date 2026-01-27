/**
 * LaTeX renderer component
 *
 * renders LaTeX notation as typed math expressions
 * uses KaTeX (specific for mathematical rendering)
 */

import { useEffect, useRef } from "react";
import katex from 'katex';
import 'katex/dist/katex.min.css'

export type LatexObject = {
    id : string;
    latex : string;
    left : number;
    top : number;
    width : number;
    height : number;
    fontSize : number;
};

export type LatexRendererProps = {
    objects : LatexObject[];
    onObjectClick? : (id: string) => void;
}

export default function LatexRenderer({ objects, onObjectClick } : LatexRendererProps) {
    return (
        <div className="absolte top-0 left-0 w-full h-full pointer-events-none z-10">
            {objects.map((obj) => (
                <LatexItem key={obj.id} object={obj} onClick={onObjectClick}/>
            ))}
        </div>
    );
}

function LatexItem({
    object,
    onClick,
} : {
    object : LatexObject;
    onClick? : (id:string) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            try{
                // latex from katex
                katex.render(object.latex, containerRef.current,{
                    throwOnError : false,
                    displayMode : true,
                    output : 'html',
                });
            }
            catch(error){
               console.error('[LaTeX] Rendering error: ', error);
               
               if (containerRef.current){
                containerRef.current.textContent = object.latex;
               }
            }
        }
    }, [object.latex]);

    return (
        <div 
            ref={containerRef}
            className="absolute bg-white bg-opacity-90 p-2 rounded shadow-md border border-gray-300 pointer-events-auto cursor-pointer hover:bg-opacity-100 transition-all" 
            style={{
                left : `${object.left}px`,
                top : `${object.top}px`,
                fontSize : `${object.fontSize}px`,
                minWidth : `${object.width}px`,
                minHeight : `${object.height}px`,
            }}
            onClick={() => onClick?.(object.id)}
        />
    );
}