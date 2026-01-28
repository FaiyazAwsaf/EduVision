def create_math_prompt() -> str:
    prompt = """
            You are a mathematical notation expert. Analyze this handwritten mathematical expression 
            and convert it to LaTeX notation. 
            
            Rules:
            - Return ONLY the LaTeX code, no explanations
            - Use proper LaTeX syntax (e.g., \\frac{}{}, \\sqrt{}, ^{}, _{})
            - For inline math, don't include $ delimiters
            - Be precise with spacing and grouping
            - If you see multiple expressions, separate them with spaces
            
            Example outputs:
            - "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
            - "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"
            - "E = mc^2"
            """
    return prompt

def create_text_prompt() -> str:
    prompt = """
            You are a handwriting recognition expert. Analyze this handwritten text 
            and convert it to plain text.
            
            Rules:
            - Return ONLY the text content, no explanations
            - Preserve line breaks if multiple lines exist
            - Fix obvious spelling errors
            - Maintain capitalization as written
            """
    return prompt