"""
Content Formatting Service

This module handles formatting of generated content into different output formats:
- TEXT: Raw text content
- PDF: PDF document generation
- WORKSHEET: Structured worksheet format

The formatting logic is separated from AI generation to allow:
- Independent testing of formatting
- Easy addition of new formats
- Format-specific customization
"""
import logging
from typing import Dict, Any, Optional
from io import BytesIO
import base64

# PDF generation
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER

from ..domain.enums import OutputFormat, ContentType, Style

logger = logging.getLogger(__name__)


class ContentFormatterError(Exception):
    """Base exception for content formatting errors."""
    pass


class ContentFormatter:
    """
    Service for formatting generated content into different output formats.
    
    This class handles the conversion of raw text content into formatted
    outputs suitable for different use cases (viewing, downloading, printing).
    
    Design principles:
    - Stateless operations (pure functions)
    - Format-specific logic encapsulated in separate methods
    - Extensible for new formats
    - Error handling with meaningful messages
    """
    
    def format_content(
        self,
        content_text: str,
        output_format: OutputFormat,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for content formatting.
        
        Routes to appropriate formatting method based on output format.
        
        Args:
            content_text: Raw generated content
            output_format: Desired output format
            metadata: Optional metadata about the content
            
        Returns:
            Dictionary containing:
                - content: Formatted content (string or bytes)
                - mime_type: MIME type of the formatted content
                - filename: Suggested filename
                
        Raises:
            ContentFormatterError: If formatting fails
        """
        logger.info(f"Formatting content as {output_format.value}")
        
        if not content_text or not content_text.strip():
            raise ContentFormatterError("Cannot format empty content")
        
        metadata = metadata or {}
        
        if output_format == OutputFormat.TEXT:
            return self._format_as_text(content_text, metadata)
        elif output_format == OutputFormat.PDF:
            return self._format_as_pdf(content_text, metadata)
        elif output_format == OutputFormat.WORKSHEET:
            return self._format_as_worksheet(content_text, metadata)
        else:
            raise ContentFormatterError(f"Unsupported output format: {output_format}")
    
    def _format_as_text(
        self,
        content_text: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Format content as plain text.
        
        Args:
            content_text: Raw generated content
            metadata: Content metadata
            
        Returns:
            Formatted text with metadata
        """
        logger.debug("Formatting as plain text")
        
        # Add metadata header if available
        if metadata.get('topic'):
            header = f"Topic: {metadata['topic']}\n"
            if metadata.get('content_type'):
                header += f"Type: {metadata['content_type']}\n"
            if metadata.get('difficulty'):
                header += f"Difficulty: {metadata['difficulty']}\n"
            header += "\n" + "="*60 + "\n\n"
            content_text = header + content_text
        
        return {
            'content': content_text,
            'mime_type': 'text/plain',
            'filename': self._generate_filename(metadata, 'txt')
        }
    
    def _format_as_pdf(
        self,
        content_text: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Format content as PDF document.
        
        Args:
            content_text: Raw generated content
            metadata: Content metadata
            
        Returns:
            PDF bytes and metadata
        """
        logger.debug("Formatting as PDF")
        
        try:
            # Create PDF buffer
            buffer = BytesIO()
            
            # Create document
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18
            )
            
            # Container for flowable objects
            story = []
            
            # Define styles
            styles = getSampleStyleSheet()
            styles.add(ParagraphStyle(
                name='Justify',
                parent=styles['BodyText'],
                alignment=TA_JUSTIFY
            ))
            
            # Add title if available
            if metadata.get('topic'):
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=18,
                    textColor='#1a73e8',
                    spaceAfter=12,
                    alignment=TA_CENTER
                )
                story.append(Paragraph(metadata['topic'], title_style))
                story.append(Spacer(1, 12))
            
            # Add metadata section
            if metadata.get('content_type') or metadata.get('difficulty'):
                meta_parts = []
                if metadata.get('content_type'):
                    meta_parts.append(f"Type: {metadata['content_type']}")
                if metadata.get('style'):
                    meta_parts.append(f"Style: {metadata['style']}")
                if metadata.get('difficulty'):
                    meta_parts.append(f"Difficulty: {metadata['difficulty']}")
                
                meta_text = " | ".join(meta_parts)
                meta_style = ParagraphStyle(
                    'MetaStyle',
                    parent=styles['Normal'],
                    fontSize=10,
                    textColor='#5f6368',
                    alignment=TA_CENTER
                )
                story.append(Paragraph(meta_text, meta_style))
                story.append(Spacer(1, 20))
            
            # Add horizontal line
            story.append(Spacer(1, 12))
            
            # Add content paragraphs
            # Split by double newlines to preserve paragraph structure
            paragraphs = content_text.split('\n\n')
            
            for para in paragraphs:
                if para.strip():
                    # Clean up the paragraph
                    para = para.strip().replace('\n', '<br/>')
                    
                    # Check if it looks like a heading (short, no punctuation at end)
                    if len(para) < 100 and not para.endswith(('.', '!', '?')):
                        style = styles['Heading2']
                    else:
                        style = styles['Justify']
                    
                    story.append(Paragraph(para, style))
                    story.append(Spacer(1, 12))
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            logger.info(f"Generated PDF ({len(pdf_bytes)} bytes)")
            
            return {
                'content': pdf_bytes,
                'mime_type': 'application/pdf',
                'filename': self._generate_filename(metadata, 'pdf')
            }
            
        except Exception as e:
            logger.error(f"Failed to generate PDF: {str(e)}")
            raise ContentFormatterError(f"PDF generation failed: {str(e)}")
    
    def _format_as_worksheet(
        self,
        content_text: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Format content as a structured worksheet (PDF with special formatting).
        
        Args:
            content_text: Raw generated content
            metadata: Content metadata
            
        Returns:
            Worksheet PDF bytes and metadata
        """
        logger.debug("Formatting as worksheet")
        
        try:
            # Create PDF buffer
            buffer = BytesIO()
            
            # Create document
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72
            )
            
            # Container for flowable objects
            story = []
            
            # Define styles
            styles = getSampleStyleSheet()
            
            # Title style
            title_style = ParagraphStyle(
                'WorksheetTitle',
                parent=styles['Heading1'],
                fontSize=20,
                textColor='#1a73e8',
                spaceAfter=6,
                alignment=TA_CENTER,
                bold=True
            )
            
            # Subtitle style
            subtitle_style = ParagraphStyle(
                'WorksheetSubtitle',
                parent=styles['Normal'],
                fontSize=10,
                textColor='#5f6368',
                alignment=TA_CENTER,
                spaceAfter=20
            )
            
            # Question style
            question_style = ParagraphStyle(
                'Question',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=30,
                leftIndent=20
            )
            
            # Add header
            story.append(Paragraph("EDUCATIONAL WORKSHEET", title_style))
            
            if metadata.get('topic'):
                story.append(Paragraph(metadata['topic'], subtitle_style))
            
            # Add instructions section
            story.append(Spacer(1, 12))
            instructions = Paragraph(
                "<b>Instructions:</b> Complete all problems below. "
                "Show all work for full credit. Use additional paper if needed.",
                styles['Normal']
            )
            story.append(instructions)
            story.append(Spacer(1, 20))
            
            # Add divider
            story.append(Spacer(1, 12))
            
            # Process content as structured problems/sections
            sections = content_text.split('\n\n')
            
            problem_number = 1
            for section in sections:
                if section.strip():
                    # Format as numbered problem
                    section_text = f"<b>{problem_number}.</b> {section.strip()}"
                    story.append(Paragraph(section_text, question_style))
                    
                    # Add answer space
                    story.append(Spacer(1, 40))
                    answer_space = Paragraph(
                        "_" * 80,
                        styles['Normal']
                    )
                    story.append(answer_space)
                    story.append(Spacer(1, 20))
                    
                    problem_number += 1
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            logger.info(f"Generated worksheet PDF ({len(pdf_bytes)} bytes)")
            
            return {
                'content': pdf_bytes,
                'mime_type': 'application/pdf',
                'filename': self._generate_filename(metadata, 'pdf', 'worksheet')
            }
            
        except Exception as e:
            logger.error(f"Failed to generate worksheet: {str(e)}")
            raise ContentFormatterError(f"Worksheet generation failed: {str(e)}")
    
    def _generate_filename(
        self,
        metadata: Dict[str, Any],
        extension: str,
        prefix: str = None
    ) -> str:
        """
        Generate a descriptive filename for the formatted content.
        
        Args:
            metadata: Content metadata
            extension: File extension (without dot)
            prefix: Optional prefix for filename
            
        Returns:
            Suggested filename
        """
        parts = []
        
        if prefix:
            parts.append(prefix)
        
        if metadata.get('topic'):
            # Clean topic for filename
            topic = metadata['topic'][:30]
            topic = "".join(c if c.isalnum() or c in (' ', '_', '-') else '' for c in topic)
            topic = topic.replace(' ', '_')
            parts.append(topic)
        
        if metadata.get('content_type'):
            parts.append(metadata['content_type'].lower())
        
        filename = '_'.join(parts) if parts else 'content'
        return f"{filename}.{extension}"


def get_content_formatter() -> ContentFormatter:
    """
    Factory function to get a ContentFormatter instance.
    
    Returns:
        ContentFormatter instance
    """
    return ContentFormatter()
