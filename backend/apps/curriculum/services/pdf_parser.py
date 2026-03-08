"""
PDF Text Extraction Service

Uses pdfplumber to extract raw text from uploaded course outline PDFs.
The extracted text is then sent to the AI extractor for structured parsing.
"""
import logging
from io import BytesIO
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file) -> str:
    """
    Extract all text from a PDF file using pdfplumber.

    Args:
        file: A Django FieldFile, InMemoryUploadedFile, or file-like object.

    Returns:
        Concatenated text from all pages.

    Raises:
        ValueError: If the PDF cannot be read or is empty.
    """
    try:
        # Read file bytes – handles both FieldFile and in-memory uploads
        if hasattr(file, "read"):
            file.seek(0)
            pdf_bytes = file.read()
            file.seek(0)
        else:
            pdf_bytes = file

        pages_text: list[str] = []

        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            if not pdf.pages:
                raise ValueError("PDF has no pages")

            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)

        full_text = "\n\n".join(pages_text)

        if not full_text.strip():
            raise ValueError("No readable text found in the PDF")

        logger.info(
            "Extracted %d characters from %d pages",
            len(full_text),
            len(pages_text),
        )
        return full_text

    except pdfplumber.exceptions.PSException as exc:
        logger.error("pdfplumber failed to parse PDF: %s", exc)
        raise ValueError(f"Could not parse the PDF file: {exc}") from exc
