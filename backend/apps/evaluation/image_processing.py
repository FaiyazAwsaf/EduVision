import cv2
import numpy as np
from PIL import Image
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

def equalize_histogram(image: np.ndarray) -> np.ndarray:
    """
    Apply histogram equalization to improve contrast.

    For color images, equalizes the luminance channel only.

    Args:
        image: Input image as numpy array (grayscale or BGR)

    Returns:
        Contrast-enhanced image as numpy array
    """
    if len(image.shape) == 2:
        equalized = cv2.equalizeHist(image)
        logger.debug("Applied histogram equalization (grayscale)")
        return equalized

    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    y_channel, cr_channel, cb_channel = cv2.split(ycrcb)
    y_channel = cv2.equalizeHist(y_channel)
    merged = cv2.merge((y_channel, cr_channel, cb_channel))
    equalized = cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)
    logger.debug("Applied histogram equalization (luminance)")
    return equalized


def equalize_histogram_clahe(
    image: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: tuple = (8, 8)
) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization).

    CLAHE is often more stable than global equalization for uneven lighting.

    Args:
        image: Input image as numpy array (grayscale or BGR)
        clip_limit: Threshold for contrast limiting
        tile_grid_size: Size of grid for histogram equalization

    Returns:
        Contrast-enhanced image as numpy array
    """
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    if len(image.shape) == 2:
        equalized = clahe.apply(image)
        logger.debug("Applied CLAHE (grayscale)")
        return equalized

    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    y_channel, cr_channel, cb_channel = cv2.split(ycrcb)
    y_channel = clahe.apply(y_channel)
    merged = cv2.merge((y_channel, cr_channel, cb_channel))
    equalized = cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)
    logger.debug("Applied CLAHE (luminance)")
    return equalized


def denoise_image(
    image: np.ndarray,
    strength: int = 10,
    color_strength: int = 10,
    template_window_size: int = 7,
    search_window_size: int = 21
) -> np.ndarray:
    """
    Reduce noise using non-local means denoising.

    Args:
        image: Input image as numpy array (grayscale or BGR)
        strength: Filter strength for luminance component
        color_strength: Filter strength for color components
        template_window_size: Size in pixels of the template patch
        search_window_size: Size in pixels of the window used to compute weighted average

    Returns:
        Denoised image as numpy array
    """
    if len(image.shape) == 2:
        denoised = cv2.fastNlMeansDenoising(
            image,
            None,
            h=strength,
            templateWindowSize=template_window_size,
            searchWindowSize=search_window_size,
        )
        logger.debug("Applied grayscale denoising")
        return denoised

    denoised = cv2.fastNlMeansDenoisingColored(
        image,
        None,
        h=strength,
        hColor=color_strength,
        templateWindowSize=template_window_size,
        searchWindowSize=search_window_size,
    )
    logger.debug("Applied color denoising")
    return denoised


def binarize_image(
    image: np.ndarray,
    method: str = "adaptive",
    block_size: int = 11,
    c_value: int = 2
) -> np.ndarray:
    """
    Convert image to binary (black and white) using thresholding.
    
    Binarization helps separate text from background, especially useful
    for documents with varying lighting conditions.
    
    Args:
        image: Input image as numpy array (grayscale or BGR)
        method: Thresholding method - "adaptive", "otsu", or "simple"
        block_size: Neighborhood size for adaptive threshold (must be odd)
        c_value: Constant subtracted from weighted mean (adaptive only)
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
        if block_size < 3:
            block_size = 3
        if block_size % 2 == 0:
            block_size += 1
        # Adaptive Gaussian thresholding
        # blockSize: Size of pixel neighborhood (must be odd)
        # C: Constant subtracted from weighted mean
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=block_size,
            C=c_value
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
    equalize: bool = False,
    equalize_method: str = "global",
    denoise: bool = False,
    binarize: bool = True,
    binarization_method: str = "adaptive",
    adaptive_block_size: int = 11,
    adaptive_c: int = 2,
    max_dimension: int | None = None,
) -> bytes:
    """
    Complete preprocessing pipeline for answer script images.
    
    Applies sharpening and binarization to enhance image quality
    before OCR extraction.
    
    Args:
        image_bytes: Input image as bytes
        sharpen: Whether to apply sharpening
        equalize: Whether to apply histogram equalization
        equalize_method: "global" or "clahe" (only used if equalize=True)
        denoise: Whether to apply denoising
        binarize: Whether to apply binarization
        binarization_method: Method for binarization ("adaptive", "otsu", "simple")
        adaptive_block_size: Neighborhood size for adaptive threshold
        adaptive_c: Constant subtracted from weighted mean
        max_dimension: Optional longest-edge cap (pixels) for faster processing
    
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

        if max_dimension and max_dimension > 0:
            height, width = image.shape[:2]
            longest_edge = max(height, width)
            if longest_edge > max_dimension:
                scale = max_dimension / float(longest_edge)
                new_width = max(1, int(width * scale))
                new_height = max(1, int(height * scale))
                image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
                logger.debug(
                    f"Resized image for preprocessing from {width}x{height} to {new_width}x{new_height}"
                )
        
        # Apply sharpening
        if sharpen:
            image = sharpen_image(image)

        # Apply histogram equalization
        if equalize:
            if equalize_method == "clahe":
                image = equalize_histogram_clahe(image)
            else:
                image = equalize_histogram(image)

        # Apply denoising
        if denoise:
            image = denoise_image(image)
        
        # Apply binarization
        if binarize:
            image = binarize_image(
                image,
                method=binarization_method,
                block_size=adaptive_block_size,
                c_value=adaptive_c,
            )
        
        # Convert back to bytes (PNG format)
        success, encoded_image = cv2.imencode('.png', image)
        
        if not success:
            logger.error("Failed to encode processed image")
            return image_bytes  # Return original if encode fails
        
        processed_bytes = encoded_image.tobytes()
        logger.info(
            "Successfully preprocessed image: "
            f"sharpen={sharpen}, equalize={equalize}, equalize_method={equalize_method}, "
            f"denoise={denoise}, binarize={binarize}"
        )
        
        return processed_bytes
        
    except Exception as e:
        logger.error(f"Error in image preprocessing: {str(e)}")
        return image_bytes  # Return original image on error


def preprocess_pil_image(
    pil_image: Image.Image,
    sharpen: bool = True,
    equalize: bool = False,
    equalize_method: str = "global",
    denoise: bool = False,
    binarize: bool = True,
    binarization_method: str = "adaptive",
    adaptive_block_size: int = 11,
    adaptive_c: int = 2
) -> Image.Image:
    """
    Preprocess a PIL Image object.
    
    Args:
        pil_image: Input PIL Image
        sharpen: Whether to apply sharpening
        equalize: Whether to apply histogram equalization
        equalize_method: "global" or "clahe" (only used if equalize=True)
        denoise: Whether to apply denoising
        binarize: Whether to apply binarization
        binarization_method: Method for binarization
        adaptive_block_size: Neighborhood size for adaptive threshold
        adaptive_c: Constant subtracted from weighted mean
    
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

        # Apply histogram equalization
        if equalize:
            if equalize_method == "clahe":
                image_array = equalize_histogram_clahe(image_array)
            else:
                image_array = equalize_histogram(image_array)

        # Apply denoising
        if denoise:
            image_array = denoise_image(image_array)
        
        # Apply binarization
        if binarize:
            image_array = binarize_image(
                image_array,
                method=binarization_method,
                block_size=adaptive_block_size,
                c_value=adaptive_c,
            )
        
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