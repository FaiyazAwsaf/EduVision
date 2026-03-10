"""
Prompt Builder for Context-Aware AI Generation (Phase 4)

This module handles prompt construction with optional learning context.
Prompts degrade gracefully when context is not provided.

IMPORTANT: This is MANUAL context, not inferred or analytics-driven.
All personalization comes from explicit user input.

Extension Points (Module 3):
- Auto-populate context from performance analytics
- Dynamic prompt optimization based on success rates
- Personalized explanation styles from user preferences
"""
import logging
from typing import Optional, List
from ..domain.content_request import ContentRequest
from ..domain.enums import ContentType, Style, Difficulty

logger = logging.getLogger(__name__)


def build_system_prompt(role: str = 'student') -> str:
    """
    Build the base system prompt for educational content generation.
    Teacher prompts emphasize classroom-ready material.
    Student prompts emphasize learning.
    """
    off_topic_guard = """\n
CRITICAL RULE — TOPIC RELEVANCE CHECK:
Before generating any content, evaluate whether the requested topic is genuinely
related to academics, education, or learning. If the topic is clearly unrelated
(e.g. weather, time, jokes, personal questions, news, sports scores, shopping,
recipes, greetings, or any non-educational query), you MUST respond with ONLY
the following text and nothing else:

[OFF_TOPIC]

Do NOT generate any educational content for off-topic requests. Do NOT explain
why. Just return [OFF_TOPIC].

If the topic IS educational, proceed normally with the content generation below.
"""

    if role == 'teacher':
        return """You are an expert educational content creator helping teachers build
classroom-ready materials. Your goal is to create professional, structured content
that teachers can directly use in their lessons.

Guidelines:
- Create clear, well-structured educational materials
- Include teacher notes and delivery suggestions where appropriate
- Ensure content aligns with curriculum standards
- Use proper formatting (headers, lists, emphasis)
- Support mathematical notation when needed
- Make content engaging and age-appropriate for the target class
- Include assessment-ready elements (questions, rubrics) when relevant""" + off_topic_guard
    
    return """You are an expert educational content creator specializing in clear, 
accurate, and pedagogically sound explanations. Your goal is to help students 
learn effectively by providing well-structured content tailored to their needs.

Guidelines:
- Use clear, precise language appropriate for the student level
- Break down complex concepts into manageable chunks
- Include relevant examples and explanations
- Use proper formatting (headers, lists, emphasis)
- Support mathematical notation when needed
- Be thorough but concise
- Focus on understanding, not just memorization""" + off_topic_guard


def build_context_aware_prompt(
    request: ContentRequest,
    learning_context: Optional[object] = None
) -> str:
    """
    Build a complete user prompt with optional learning context.
    
    This is the main prompt builder that combines:
    1. Base request (topic, content type, style)
    2. Optional learning context (goal, weaknesses, depth, time)
    
    The prompt GRACEFULLY DEGRADES if context is missing.
    AI generation works fine without context - it's just less personalized.
    
    Args:
        request: Content request with topic and preferences
        learning_context: Optional LearningContextModel instance (Phase 4)
        
    Returns:
        Complete user prompt string
        
    Extension Points:
    - Add context from Module 3 analytics
    - Include performance history
    - Inject adaptive difficulty adjustments
    """
    # Start with base request
    prompt_parts = []
    
    # Topic and content type
    prompt_parts.append(f"Topic: {request.topic}")
    prompt_parts.append(f"Content Type: {request.content_type.value}")
    prompt_parts.append(f"Style: {request.style.value}")
    
    # Add subject context if available (Phase B)
    if hasattr(request, 'subject') and request.subject:
        prompt_parts.insert(0, f"Subject: {request.subject}")
    
    # Add class/section context if available (Phase B)
    if hasattr(request, 'target_class_name') and request.target_class_name:
        audience = f"Target audience: {request.target_class_name}"
        if hasattr(request, 'target_section_name') and request.target_section_name:
            audience += f", Section {request.target_section_name}"
        prompt_parts.append(audience)
    
    if request.difficulty:
        prompt_parts.append(f"Difficulty Level: {request.difficulty.value}")
    
    if request.notes:
        prompt_parts.append(f"\nAdditional Context: {request.notes}")
    
    # Add curriculum context if a curriculum topic is linked
    curriculum_section = _build_curriculum_context(request)
    if curriculum_section:
        prompt_parts.append("\n" + curriculum_section)
        logger.info("Including curriculum context in prompt")

    # Add learning context if provided (Phase 4: Manual inputs)
    if learning_context:
        context_section = _build_learning_context_section(learning_context)
        if context_section:
            prompt_parts.append("\n" + context_section)
            logger.info("Including learning context in prompt")
    
    # Combine all parts
    full_prompt = "\n".join(prompt_parts)
    
    # Add content-type-specific instructions
    type_instructions = _get_type_specific_instructions(request.content_type)
    if type_instructions:
        full_prompt += "\n\n" + type_instructions
    
    return full_prompt


def _build_learning_context_section(learning_context: object) -> str:
    """
    Build prompt section from learning context (Phase 4).
    
    IMPORTANT: All context is USER-PROVIDED, not inferred.
    This function translates manual inputs into prompt instructions.
    
    Args:
        learning_context: LearningContextModel instance
        
    Returns:
        Formatted context section for prompt
        
    Extension Points (Module 3):
    - Replace manual context with analytics-driven insights
    - Add performance-based adjustments
    - Include error pattern analysis
    """
    context_parts = []
    
    # Learning goal
    if hasattr(learning_context, 'target_goal') and learning_context.target_goal:
        goal_text = _format_goal_for_prompt(learning_context.target_goal)
        context_parts.append(f"Learning Goal: {goal_text}")
    
    # Self-reported weaknesses (manual input)
    if hasattr(learning_context, 'self_reported_weaknesses') and learning_context.self_reported_weaknesses:
        weaknesses = learning_context.get_weaknesses_list()
        if weaknesses:
            weakness_text = ", ".join(weaknesses)
            context_parts.append(
                f"Focus Areas: The student wants extra emphasis on: {weakness_text}"
            )
    
    # Preferred explanation depth
    if hasattr(learning_context, 'preferred_depth') and learning_context.preferred_depth:
        depth_text = _format_depth_for_prompt(learning_context.preferred_depth)
        context_parts.append(f"Explanation Depth: {depth_text}")
    
    # Time constraint
    if hasattr(learning_context, 'time_constraint') and learning_context.time_constraint:
        time_text = _format_time_for_prompt(learning_context.time_constraint)
        context_parts.append(f"Time Available: {time_text}")
    
    # Additional notes
    if hasattr(learning_context, 'notes') and learning_context.notes:
        context_parts.append(f"Student Notes: {learning_context.notes}")
    
    if context_parts:
        header = "\n=== Personalization Context (User-Provided) ==="
        return header + "\n" + "\n".join(context_parts)
    
    return ""


def _format_goal_for_prompt(goal: str) -> str:
    """Convert goal enum to natural language for prompt."""
    goal_map = {
        'REVISION': 'Review and reinforce previously learned material',
        'CONCEPT_CLARITY': 'Build deep understanding of fundamental concepts',
        'EXAM_PREP': 'Prepare for examination with focused practice',
        'PRACTICE': 'Apply knowledge through practical exercises'
    }
    return goal_map.get(goal, goal)


def _format_depth_for_prompt(depth: str) -> str:
    """Convert depth preference to prompt instruction."""
    depth_map = {
        'SHALLOW': 'Provide a quick overview with key points only',
        'NORMAL': 'Provide standard-depth explanations with examples',
        'DEEP': 'Provide in-depth explanations with detailed examples and edge cases'
    }
    return depth_map.get(depth, depth_map['NORMAL'])


def _format_time_for_prompt(time_constraint: str) -> str:
    """Convert time constraint to content scope instruction."""
    time_map = {
        'QUICK': '10-15 minutes (concise, essential points only)',
        'NORMAL': '30-45 minutes (comprehensive but focused)',
        'EXTENSIVE': '60+ minutes (thorough coverage with details)'
    }
    return time_map.get(time_constraint, time_map['NORMAL'])


def _get_type_specific_instructions(content_type: ContentType) -> str:
    """
    Get content-type-specific formatting instructions.
    
    These are independent of learning context.
    """
    instructions = {
        ContentType.SUMMARY: """
Format as a well-structured summary with:
- Clear section headers
- Key concepts highlighted
- Logical flow from basics to advanced
- Concise explanations
        """,
        
        ContentType.WORKED_EXAMPLES: """
Format with 2-3 complete worked examples:
1. State the problem clearly
2. Show all solution steps with explanations
3. Highlight key insights or common mistakes
4. Provide the final answer
        """,
        
        ContentType.FORMULA_SHEET: """
Format as a comprehensive formula reference:
1. Formula name/title
2. The formula clearly written
3. Definition of all variables
4. When to use it
5. Important notes or constraints
        """,
        
        ContentType.LESSON_PLAN: """
Format as a structured lesson plan with:
1. Learning Objectives (2-4 clear, measurable objectives)
2. Prerequisites / Prior Knowledge
3. Materials Needed
4. Lesson Structure:
   - Introduction / Hook (5-10 min)
   - Main Teaching Activities with time allocations
   - Guided Practice
   - Independent Practice
   - Closure / Assessment
5. Differentiation strategies for mixed-ability classes
6. Assessment / Exit Ticket questions
        """,
        
        ContentType.QUIZ_GENERATOR: """
Generate a quiz with:
1. 10-15 questions of mixed types (MCQ, short answer, true/false)
2. Clear question numbering
3. For MCQ: 4 options each with one correct answer
4. Include an Answer Key at the end
5. Vary difficulty across questions (easy → medium → hard)
6. Map questions to specific learning objectives
        """,
        
        ContentType.WORKSHEET_BUILDER: """
Create a student worksheet with:
1. Title and instructions at the top
2. A brief concept review/reminder box
3. 8-12 practice problems of increasing difficulty
4. Space indicators for student work (e.g., "Show your work below")
5. A challenge/extension problem at the end
6. Include an Answer Key section at the end
        """,
        
        ContentType.TOPIC_EXPLANATION: """
Create a comprehensive topic explanation suitable for classroom use:
1. Start with a clear definition and real-world relevance
2. Break the topic into key sub-concepts
3. Provide 2-3 worked examples per sub-concept
4. Include diagrams/visual descriptions where helpful
5. Add "Check Your Understanding" questions throughout
6. End with a summary of key takeaways
        """,
    }
    
    return instructions.get(content_type, "").strip()


def _build_curriculum_context(request: ContentRequest) -> str:
    """
    Build prompt section from a linked curriculum topic.

    When a content request is linked to a CourseTopic, we enrich the prompt
    with course objectives and course outcomes so the AI aligns its output
    with the curriculum scope.
    """
    # The ORM attribute is set on the domain object when loaded via repository
    curriculum_topic_id = getattr(request, "curriculum_topic_id", None)
    if not curriculum_topic_id:
        return ""

    try:
        from apps.curriculum.models import CourseTopic

        topic = (
            CourseTopic.objects.select_related("course_outline")
            .get(pk=curriculum_topic_id)
        )
    except CourseTopic.DoesNotExist:
        return ""

    parts = ["\n=== Curriculum Alignment ==="]
    parts.append(f"Course: {topic.course_outline.title}")

    objectives = topic.course_outline.course_objectives
    if objectives:
        parts.append("Course Objectives:")
        for idx, obj in enumerate(objectives, 1):
            parts.append(f"  {idx}. {obj}")

    if topic.course_outcomes:
        parts.append(f"Target Course Outcomes: {', '.join(topic.course_outcomes)}")

    parts.append(
        "Ensure the generated content is scoped to this course's curriculum "
        "and aligns with the objectives and outcomes listed above."
    )

    return "\n".join(parts)
