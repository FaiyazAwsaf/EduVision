import json
import logging
import os
import re
import tempfile

import google.generativeai as genai
from .image_processing import preprocess_script_image

logger = logging.getLogger(__name__)


class OCRExtractionService:
    def __init__(self, model, safety_settings):
        self.model = model
        self.safety_settings = safety_settings

    def _strip_code_fences(self, text: str) -> str:
        text = (text or "").strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    def _extract_json_block(self, text: str) -> str:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1]
        return text

    def _parse_ocr_json(self, raw_text: str) -> dict:
        cleaned = self._strip_code_fences(raw_text)
        candidates = [cleaned, self._extract_json_block(cleaned)]

        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

            repaired = re.sub(r'(?<!\\)\\(?!["\\/bfnrtu])', r"\\\\", candidate)
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

        raise ValueError("Could not parse OCR JSON response")

    def _preprocess_image_for_ocr(self, image_path: str) -> str:
        try:
            with open(image_path, "rb") as image_file:
                original_bytes = image_file.read()

            processed_bytes = preprocess_script_image(
                original_bytes,
                sharpen=True,
                equalize=True,
                equalize_method="clahe",
                denoise=True,
                binarize=True,
                binarization_method="adaptive",
                adaptive_block_size=15,
                adaptive_c=3,
            )

            fd, temp_path = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            with open(temp_path, "wb") as output_file:
                output_file.write(processed_bytes)
            return temp_path
        except Exception as e:
            logger.warning(f"Image preprocessing failed, using original image: {e}")
            return image_path

    def _fallback_plain_text_ocr(self, image_path: str) -> dict:
        image_file = genai.upload_file(image_path)
        prompt = """
        You are an OCR assistant.
        Extract all visible text exactly as written.
        Keep line breaks.
        If unreadable, write [illegible].
        Return ONLY plain text.
        """
        response = self.model.generate_content(
            [prompt, image_file],
            generation_config=genai.GenerationConfig(
                response_mime_type="text/plain",
                temperature=0.0,
            ),
            safety_settings=self.safety_settings,
        )

        text = (response.text or "").strip()
        return {
            "extracted_text": text,
            "equations": [],
            "question_numbers_found": [],
            "has_diagrams": False,
            "confidence": 0.5 if text else 0.0,
            "notes": "Fallback plain-text OCR used",
        }

    def extract_text_from_pages(self, script) -> dict:
        pages_content = []

        for page in script.pages.all().order_by("page_number"):
            processed_path = None
            try:
                image_path = page.image.path
                processed_path = self._preprocess_image_for_ocr(image_path)

                extraction_prompt = """
                You are an expert at reading handwritten mathematical answers.
                Extract ALL text and mathematical content from this handwritten answer sheet.

                Instructions:
                1. Extract all handwritten text exactly as written
                2. For mathematical equations, describe them in plain text or use double backslashes for LaTeX (e.g., \\\\frac{1}{2})
                3. Identify question numbers if visible
                4. Note any diagrams or figures present
                5. Preserve the structure and flow of the answer

                IMPORTANT: In your JSON response, use double backslashes (\\\\) for any LaTeX commands to ensure valid JSON.
                For example, use \\\\frac{1}{2} not \\frac{1}{2}

                Return your response in this JSON format:
                {
                    "extracted_text": "full extracted text with equations",
                    "equations": ["equation1", "equation2"],
                    "question_numbers_found": ["1", "2a", etc.],
                    "has_diagrams": true/false,
                    "confidence": 0.0-1.0,
                    "notes": "any observations about legibility or issues"
                }

                Respond ONLY with valid JSON, no additional text.
                """

                image_file = genai.upload_file(processed_path)
                response = self.model.generate_content(
                    [extraction_prompt, image_file],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                    safety_settings=self.safety_settings,
                )

                try:
                    result = self._parse_ocr_json(response.text)
                except Exception as parse_err:
                    logger.warning(
                        f"OCR JSON parse failed on page {page.page_number}: {parse_err}. Using fallback OCR."
                    )
                    result = self._fallback_plain_text_ocr(processed_path)

                extracted_text = result.get("extracted_text", "") or ""
                equations = result.get("equations", []) or []
                question_numbers = result.get("question_numbers_found", []) or []

                try:
                    confidence = float(result.get("confidence", 0.0))
                except (TypeError, ValueError):
                    confidence = 0.0
                confidence = max(0.0, min(1.0, confidence))

                page.extracted_text = extracted_text
                page.extracted_equations = equations
                page.ocr_confidence = confidence
                page.processing_notes = result.get("notes", "")
                page.save()

                pages_content.append(
                    {
                        "page_number": page.page_number,
                        "text": extracted_text,
                        "equations": equations,
                        "question_numbers": question_numbers,
                        "confidence": confidence,
                    }
                )

            except Exception as e:
                logger.error(f"Error extracting text from page {page.page_number}: {str(e)}")
                pages_content.append(
                    {
                        "page_number": page.page_number,
                        "text": "",
                        "equations": [],
                        "error": str(e),
                    }
                )
            finally:
                if processed_path and processed_path != page.image.path and os.path.exists(processed_path):
                    try:
                        os.unlink(processed_path)
                    except Exception:
                        pass

        full_text = "\n\n".join([f"--- Page {p['page_number']} ---\n{p['text']}" for p in pages_content])

        return {
            "pages": pages_content,
            "full_text": full_text,
        }
