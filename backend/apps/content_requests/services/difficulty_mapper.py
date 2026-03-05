"""
Difficulty Auto-Suggestion Mapper

Maps class levels to suggested difficulty levels for content generation.
Teachers can override the suggestion.
"""
from ..domain.enums import Difficulty


def suggest_difficulty(class_name: str) -> str:
    """
    Suggest a difficulty level based on class name.
    
    Mapping:
    - Classes 1-5 → EASY
    - Classes 6-8 → MEDIUM
    - Classes 9-12 → HARD
    
    Args:
        class_name: Class name string (e.g., "Class 5", "10", "Class 12 Science")
        
    Returns:
        Suggested difficulty value string
    """
    # Extract numeric part from class name
    import re
    numbers = re.findall(r'\d+', str(class_name))
    
    if not numbers:
        return Difficulty.MEDIUM.value
    
    class_num = int(numbers[0])
    
    if class_num <= 5:
        return Difficulty.EASY.value
    elif class_num <= 8:
        return Difficulty.MEDIUM.value
    else:
        return Difficulty.HARD.value
