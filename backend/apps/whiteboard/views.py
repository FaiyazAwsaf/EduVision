import os
import json
import base64
import google.generativeai as genai
from rest_framework import status
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .services.prompt_builder import create_math_prompt, create_text_prompt

genai.configure(api_key=os.environ.get("GEMINI_API_KEY_2"))

@csrf_exempt
@require_http_methods(["POST"])
def convert_to_latex(request):

    """
    convert handwritten math/text to LaTeX using Gemini Vision API
    
    expected request body:
    {
        "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
        "type": "math" | "text"
    }
    
    returns:
    {
        "success": true,
        "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
        "error": null
    }
    """

    try:
        # parse json body
        data = json.loads(request.body)
        image_data = data.get("image")
        conversion_type = data.get("type", "math")

        model = genai.GenerativeModel("gemini-2.5-flash")

        if not image_data:
            return JsonResponse(
                {
                "success": False,
                "latex": None,
                "error": "Image data not provided",
                },
                status = status.HTTP_400_BAD_REQUEST,
            )
            
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]

        image_bytes = base64.b64decode(image_data)
        
        if conversion_type == "math":
            prompt = create_math_prompt()
        else:
            prompt = create_text_prompt()

        image_parts = [
            {
                "mime_type": "image/png",
                "data": image_bytes,
            }
        ]

        response = model.generate_content([prompt, image_parts[0]])
        
        latex_output = response.text.strip()

        if latex_output.startswith("```"):
            latex_output = latex_output.split("```")[1]
            
            if latex_output.startswith("latex"):
                latex_output = latex_output[5:]
            
            latex_output = latex_output.strip()
        
        # return success response
        return JsonResponse(
            {
                "success": True,
                "latex": latex_output,
                "error": None,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return JsonResponse(
            {
            "success": False,
            "latex": None,
            "error": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )