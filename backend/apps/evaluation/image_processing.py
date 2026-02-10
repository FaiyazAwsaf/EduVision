"""
Image Preprocessing Module for Answer Script Evaluation

This module provides image preprocessing techniques to enhance OCR accuracy
for answer scripts that may have poor quality, bad lighting, or unclear handwriting.
"""

import cv2
import numpy as np
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)


def sharpen_image(image: np.ndarray) -> np.ndarray:
    """
    Apply image sharpening using a convolution kernel.
    
    Uses an unsharp masking technique with a sharpening kernel:
    [[ 0, -1,  0],
     [-1,  5, -1],
     [ 0, -1,  0]]
    
    Args:
        image: Input image as numpy array (grayscale or BGR)
    
    Returns:
        Sharpened image as numpy array
    """
    # Define sharpening kernel
    kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ], dtype=np.float32)
    
    # Apply kernel using filter2D
    sharpened = cv2.filter2D(image, -1, kernel)
    
    logger.debug("Applied image sharpening")
    return sharpened


def binarize_image(image: np.ndarray, method: str = "adaptive") -> np.ndarray:
    """
    Convert image to binary (black and white) using thresholding.
    
    Binarization helps separate text from background, especially useful
    for documents with varying lighting conditions.
    
    Args:
        image: Input image as numpy array (grayscale or BGR)
        method: Thresholding method - "adaptive", "otsu", or "simple"
            - "adaptive": Adaptive threshold (best for varying lighting)
            - "otsu": Otsu's method (good for bimodal histograms)
            - "simple": Simple global threshold
    
    Returns:
        Binarized image as numpy array
    """
    # Convert to grayscale if color image
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    if method == "adaptive":
        # Adaptive Gaussian thresholding
        # blockSize: Size of pixel neighborhood (must be odd)
        # C: Constant subtracted from weighted mean
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=11,
            C=2
        )
        logger.debug("Applied adaptive threshold binarization")
        
    elif method == "otsu":
        # Otsu's thresholding (automatically finds optimal threshold)
        _, binary = cv2.threshold(
            gray,
            0,
            255,
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        logger.debug("Applied Otsu threshold binarization")
        
    else:  # simple
        # Simple global threshold at 127
        _, binary = cv2.threshold(
            gray,
            127,
            255,
            cv2.THRESH_BINARY
        )
        logger.debug("Applied simple threshold binarization")
    
    return binary


def preprocess_script_image(
    image_bytes: bytes,
    sharpen: bool = True,
    binarize: bool = True,
    binarization_method: str = "adaptive"
) -> bytes:
    """
    Complete preprocessing pipeline for answer script images.
    
    Applies sharpening and binarization to enhance image quality
    before OCR extraction.
    
    Args:
        image_bytes: Input image as bytes
        sharpen: Whether to apply sharpening
        binarize: Whether to apply binarization
        binarization_method: Method for binarization ("adaptive", "otsu", "simple")
    
    Returns:
        Preprocessed image as bytes (PNG format)
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            logger.error("Failed to decode image")
            return image_bytes  # Return original if decode fails
        
        # Apply sharpening
        if sharpen:
            image = sharpen_image(image)
        
        # Apply binarization
        if binarize:
            image = binarize_image(image, method=binarization_method)
        
        # Convert back to bytes (PNG format)
        success, encoded_image = cv2.imencode('.png', image)
        
        if not success:
            logger.error("Failed to encode processed image")
            return image_bytes  # Return original if encode fails
        
        processed_bytes = encoded_image.tobytes()
        logger.info(f"Successfully preprocessed image: sharpen={sharpen}, binarize={binarize}")
        
        return processed_bytes
        
    except Exception as e:
        logger.error(f"Error in image preprocessing: {str(e)}")
        return image_bytes  # Return original image on error


def preprocess_pil_image(
    pil_image: Image.Image,
    sharpen: bool = True,
    binarize: bool = True,
    binarization_method: str = "adaptive"
) -> Image.Image:
    """
    Preprocess a PIL Image object.
    
    Args:
        pil_image: Input PIL Image
        sharpen: Whether to apply sharpening
        binarize: Whether to apply binarization
        binarization_method: Method for binarization
    
    Returns:
        Preprocessed PIL Image
    """
    try:
        # Convert PIL to OpenCV format
        image_array = np.array(pil_image)
        
        # Convert RGB to BGR if needed (OpenCV uses BGR)
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Apply sharpening
        if sharpen:
            image_array = sharpen_image(image_array)
        
        # Apply binarization
        if binarize:
            image_array = binarize_image(image_array, method=binarization_method)
        
        # Convert back to PIL
        # If grayscale (binarized), convert to RGB for consistency
        if len(image_array.shape) == 2:
            processed_pil = Image.fromarray(image_array, mode='L')
        else:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
            processed_pil = Image.fromarray(image_array)
        
        logger.info("Successfully preprocessed PIL image")
        return processed_pil
        
    except Exception as e:
        logger.error(f"Error preprocessing PIL image: {str(e)}")
        return pil_image  # Return original on error