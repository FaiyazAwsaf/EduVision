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

def create_equation_solver_prompt() -> str:
    prompt = """
            You are a mathematical solver expert. Analyze this handwritten mathematical equation 
            and solve/evaluate it. Return the result in a structured format.
            
            INPUT: A handwritten mathematical equation (e.g., "2x + 5 = 13", "∫ x² dx", "sin(π/3)")
            
            TASK: 
            1. Convert the equation to proper LaTeX notation
            2. Solve or evaluate the equation (for grade 12 math level)
            
            RETURN FORMAT (JSON):
            {
                "original_latex": "the original equation in LaTeX (e.g., 2x + 5 = 13)",
                "solution_latex": "the solution/answer in LaTeX (e.g., x = 4)",
                "evaluation_type": "solve | simplify | differentiate | integrate | evaluate"
            }
            
            RULES:
            - Return ONLY the JSON, no explanations or markdown
            - Use proper LaTeX syntax (\\frac{}{}, \\sqrt{}, ^{}, _{}, etc.)
            - For solutions, include the answer variable if applicable (e.g., x = 4, not just 4)
            - If unsolvable, return solution_latex as "Cannot be solved"
            - Evaluate trigonometric values numerically when appropriate (round to 2 decimals)
            - For integrals, return the indefinite integral with + C
            - For derivatives, return dy/dx = ...
            
            EXAMPLES:
            Input: "2x + 5 = 13"
            {"original_latex": "2x + 5 = 13", "solution_latex": "x = 4", "evaluation_type": "solve"}
            
            Input: "sin(π/3)"
            {"original_latex": "\\sin(\\frac{\\pi}{3})", "solution_latex": "\\frac{\\sqrt{3}}{2}", "evaluation_type": "evaluate"}
            
            Input: "d/dx (x^3 + 2x)"
            {"original_latex": "\\frac{d}{dx}(x^3 + 2x)", "solution_latex": "3x^2 + 2", "evaluation_type": "differentiate"}
            """
    return prompt