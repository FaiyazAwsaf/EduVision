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
    const response = await fetch(`${API_BASE_URL}/api/whiteboard/convert/`, {
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