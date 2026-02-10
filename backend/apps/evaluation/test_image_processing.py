"""
Test script for image preprocessing functions.

Usage:
    python test_image_processing.py <input_image_path>

Example:
    python test_image_processing.py /path/to/answer_script.jpg
"""

import sys
import cv2
from pathlib import Path
from image_processing import sharpen_image, binarize_image, preprocess_script_image


def test_preprocessing(input_path: str):
    """
    Process an image and save multiple versions to compare results.
    """
    # Read input image
    image = cv2.imread(input_path)
    
    if image is None:
        print(f"Error: Could not read image from {input_path}")
        return
    
    print(f"Input image size: {image.shape}")
    
    # Get output directory (same as input)
    input_file = Path(input_path)
    output_dir = input_file.parent
    base_name = input_file.stem
    
    # Save original
    original_path = output_dir / f"{base_name}_0_original.png"
    cv2.imwrite(str(original_path), image)
    print(f"✓ Saved original: {original_path}")
    
    # 1. Sharpening only
    sharpened = sharpen_image(image.copy())
    sharpened_path = output_dir / f"{base_name}_1_sharpened.png"
    cv2.imwrite(str(sharpened_path), sharpened)
    print(f"✓ Saved sharpened: {sharpened_path}")
    
    # 2. Binarization only (Adaptive)
    binary_adaptive = binarize_image(image.copy(), method="adaptive")
    binary_adaptive_path = output_dir / f"{base_name}_2_binary_adaptive.png"
    cv2.imwrite(str(binary_adaptive_path), binary_adaptive)
    print(f"✓ Saved binary (adaptive): {binary_adaptive_path}")
    
    # 3. Binarization only (Otsu)
    binary_otsu = binarize_image(image.copy(), method="otsu")
    binary_otsu_path = output_dir / f"{base_name}_3_binary_otsu.png"
    cv2.imwrite(str(binary_otsu_path), binary_otsu)
    print(f"✓ Saved binary (otsu): {binary_otsu_path}")
    
    # 4. Both: Sharpening + Adaptive Binarization
    sharpened_then_binary = binarize_image(sharpen_image(image.copy()), method="adaptive")
    both_path = output_dir / f"{base_name}_4_sharpened_binary.png"
    cv2.imwrite(str(both_path), sharpened_then_binary)
    print(f"✓ Saved sharpened + binary: {both_path}")
    
    # 5. Using the complete pipeline
    with open(input_path, 'rb') as f:
        image_bytes = f.read()
    
    processed_bytes = preprocess_script_image(
        image_bytes,
        sharpen=True,
        binarize=True,
        binarization_method="adaptive"
    )
    
    pipeline_path = output_dir / f"{base_name}_5_pipeline.png"
    with open(pipeline_path, 'wb') as f:
        f.write(processed_bytes)
    print(f"✓ Saved pipeline result: {pipeline_path}")
    
    print("\n" + "="*60)
    print("Processing complete! Check the output files:")
    print(f"  Directory: {output_dir}")
    print("\nFiles created:")
    print(f"  1. {base_name}_0_original.png - Original image")
    print(f"  2. {base_name}_1_sharpened.png - Sharpening only")
    print(f"  3. {base_name}_2_binary_adaptive.png - Adaptive threshold")
    print(f"  4. {base_name}_3_binary_otsu.png - Otsu threshold")
    print(f"  5. {base_name}_4_sharpened_binary.png - Sharpened + Binary")
    print(f"  6. {base_name}_5_pipeline.png - Complete pipeline")
    print("="*60)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_image_processing.py <input_image_path>")
        print("\nExample:")
        print("  python test_image_processing.py answer_script.jpg")
        sys.exit(1)
    
    input_path = sys.argv[1]
    
    if not Path(input_path).exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)
    
    test_preprocessing(input_path)
