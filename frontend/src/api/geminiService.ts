/**
 *
 * gemini API service
 * handles communication with backend for handwriting-to-LaTeX conversion
 */

import { API_BASE_URL } from "@/config/api";

export type ConversionType = "math" | "text";

export type ConversionResponse = {
  success: boolean;
  latex: string | null;
  error: string | null;
};

export type EquationEvaluationResponse = {
  success: boolean;
  original_latex: string | null;
  solution_latex: string | null;
  evaluation_type: string | null;
  error: string | null;
};

/**
 * two params -
 * @param imageData - b64 encoded img data
 * @param type - conversion type (math or text)
 * @returns Promise with either latex string or error
 */

export async function convertHandwritingToLatex(
  imageData: string,
  type: ConversionType = "math",
): Promise<ConversionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/whiteboard/convert/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageData,
        type,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status : ${response.status}`);
    }

    const data: ConversionResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[Gemini Service] Error:", error);

    return {
      success: false,
      latex: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Evaluate/solve a handwritten mathematical equation
 * @param imageData - b64 encoded img data of the equation
 * @returns Promise with original and solution LaTeX or error
 */
export async function evaluateHandwrittenEquation(
  imageData: string,
): Promise<EquationEvaluationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/whiteboard/evaluate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: EquationEvaluationResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[Gemini Service] Evaluation error:", error);

    return {
      success: false,
      original_latex: null,
      solution_latex: null,
      evaluation_type: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}