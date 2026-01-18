"""
Content Formatting Service

This module handles formatting of generated content into different output formats:
- TEXT: Raw text content
- PDF: PDF document generation with Markdown parsing
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
import re

# PDF generation
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.lib.colors import HexColor

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
        Format Markdown content as PDF document.
        
        Args:
            content_text: Raw generated content (Markdown format)
            metadata: Content metadata
            
        Returns:
            PDF bytes and metadata
        """
        logger.debug("Formatting Markdown as PDF")
        
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
            
            # Custom styles for Markdown elements
            styles.add(ParagraphStyle(
                name='Justify',
                parent=styles['BodyText'],
                alignment=TA_JUSTIFY,
                fontSize=11,
                leading=16
            ))
            
            styles.add(ParagraphStyle(
                name='MarkdownH1',
                parent=styles['Heading1'],
                fontSize=20,
                textColor=HexColor('#1a73e8'),
                spaceAfter=12,
                spaceBefore=20
            ))
            
            styles.add(ParagraphStyle(
                name='MarkdownH2',
                parent=styles['Heading2'],
                fontSize=16,
                textColor=HexColor('#1a73e8'),
                spaceAfter=10,
                spaceBefore=16
            ))
            
            styles.add(ParagraphStyle(
                name='MarkdownH3',
                parent=styles['Heading3'],
                fontSize=14,
                spaceAfter=8,
                spaceBefore=12
            ))
            
            styles.add(ParagraphStyle(
                name='CodeBlock',
                parent=styles['Code'],
                fontSize=9,
                leading=12,
                leftIndent=20,
                rightIndent=20,
                textColor=HexColor('#333333'),
                backColor=HexColor('#f5f5f5')
            ))
            
            styles.add(ParagraphStyle(
                name='ListItem',
                parent=styles['BodyText'],
                fontSize=11,
                leftIndent=20,
                bulletIndent=10
            ))
            
            # Add metadata header if available
            if metadata.get('topic'):
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=22,
                    textColor=HexColor('#1a73e8'),
                    spaceAfter=12,
                    alignment=TA_CENTER,
                    fontName='Helvetica-Bold'
                )
                story.append(Paragraph(self._escape_html(metadata['topic']), title_style))
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
                    textColor=HexColor('#5f6368'),
                    alignment=TA_CENTER
                )
                story.append(Paragraph(meta_text, meta_style))
                story.append(Spacer(1, 20))
            
            # Parse and convert Markdown content
            lines = content_text.split('\n')
            i = 0
            in_code_block = False
            code_buffer = []
            
            while i < len(lines):
                line = lines[i]
                
                # Handle code blocks
                if line.strip().startswith('```'):
                    if in_code_block:
                        # End of code block
                        if code_buffer:
                            code_text = '\n'.join(code_buffer)
                            story.append(Preformatted(self._escape_html(code_text), styles['CodeBlock']))
                            story.append(Spacer(1, 12))
                        code_buffer = []
                        in_code_block = False
                    else:
                        # Start of code block
                        in_code_block = True
                    i += 1
                    continue
                
                if in_code_block:
                    code_buffer.append(line)
                    i += 1
                    continue
                
                # Skip empty lines
                if not line.strip():
                    story.append(Spacer(1, 6))
                    i += 1
                    continue
                
                # Handle headers
                if line.startswith('# '):
                    text = line[2:].strip()
                    story.append(Paragraph(self._escape_html(text), styles['MarkdownH1']))
                    story.append(Spacer(1, 8))
                elif line.startswith('## '):
                    text = line[3:].strip()
                    story.append(Paragraph(self._escape_html(text), styles['MarkdownH2']))
                    story.append(Spacer(1, 6))
                elif line.startswith('### '):
                    text = line[4:].strip()
                    story.append(Paragraph(self._escape_html(text), styles['MarkdownH3']))
                    story.append(Spacer(1, 4))
                
                # Handle lists
                elif line.strip().startswith(('- ', '* ', '+ ')):
                    text = line.strip()[2:].strip()
                    bullet_text = f"• {self._escape_html(text)}"
                    story.append(Paragraph(bullet_text, styles['ListItem']))
                    story.append(Spacer(1, 4))
                
                # Handle numbered lists
                elif re.match(r'^\d+\.\s', line.strip()):
                    text = re.sub(r'^\d+\.\s', '', line.strip())
                    story.append(Paragraph(self._escape_html(text), styles['ListItem']))
                    story.append(Spacer(1, 4))
                
                # Handle inline code
                elif '`' in line:
                    # Convert inline code to monospace
                    text = self._convert_inline_markdown(line)
                    story.append(Paragraph(text, styles['Justify']))
                    story.append(Spacer(1, 8))
                
                # Regular paragraph
                else:
                    # Collect multi-line paragraph
                    para_lines = [line]
                    j = i + 1
                    while j < len(lines) and lines[j].strip() and not self._is_markdown_element(lines[j]):
                        para_lines.append(lines[j])
                        j += 1
                    
                    para_text = ' '.join(para_lines)
                    para_text = self._convert_inline_markdown(para_text)
                    story.append(Paragraph(para_text, styles['Justify']))
                    story.append(Spacer(1, 10))
                    i = j - 1
                
                i += 1
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            logger.info(f"Generated PDF from Markdown ({len(pdf_bytes)} bytes)")
            
            return {
                'content': pdf_bytes,
                'mime_type': 'application/pdf',
                'filename': self._generate_filename(metadata, 'pdf')
            }
            
        except Exception as e:
            logger.error(f"Failed to generate PDF: {str(e)}")
            raise ContentFormatterError(f"PDF generation failed: {str(e)}")
    
    def _is_markdown_element(self, line: str) -> bool:
        """Check if line is a markdown element (header, list, code block, etc.)"""
        stripped = line.strip()
        return (
            stripped.startswith('#') or
            stripped.startswith(('- ', '* ', '+ ')) or
            stripped.startswith('```') or
            re.match(r'^\d+\.\s', stripped)
        )
    
    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters for ReportLab"""
        return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;'))
    
    def _convert_inline_markdown(self, text: str) -> str:
        """Convert inline Markdown (bold, italic, code) to ReportLab markup"""
        # Escape HTML first
        text = self._escape_html(text)
        
        # Convert **bold** to <b>bold</b>
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        
        # Convert *italic* to <i>italic</i>
        text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
        
        # Convert `code` to monospace
        text = re.sub(r'`(.+?)`', r'<font face="Courier">\1</font>', text)
        
        return text
    
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
