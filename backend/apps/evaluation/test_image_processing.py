import sys
import cv2
from pathlib import Path
from image_processing import (
    sharpen_image,
    binarize_image,
    equalize_histogram,
    preprocess_script_image,
)


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
    
    # 1. Sharpening + Histogram Equalization
    sharpened_equalized = equalize_histogram(sharpen_image(image.copy()))
    sharpened_equalized_path = output_dir / f"{base_name}_1_sharp_equalized.png"
    cv2.imwrite(str(sharpened_equalized_path), sharpened_equalized)
    print(f"✓ Saved sharpened + equalized: {sharpened_equalized_path}")

    # 2. Sharpening + Binarization (Adaptive)
    sharpened_then_binary = binarize_image(sharpen_image(image.copy()), method="adaptive")
    sharpened_binary_path = output_dir / f"{base_name}_2_sharp_binary.png"
    cv2.imwrite(str(sharpened_binary_path), sharpened_then_binary)
    print(f"✓ Saved sharpened + binary: {sharpened_binary_path}")

    # 3. Sharpening + Histogram Equalization + Binarization (Adaptive)
    sharp_equalized_binary = binarize_image(
        equalize_histogram(sharpen_image(image.copy())),
        method="adaptive",
    )
    sharp_equalized_binary_path = output_dir / f"{base_name}_3_sharp_equalized_binary.png"
    cv2.imwrite(str(sharp_equalized_binary_path), sharp_equalized_binary)
    print(f"✓ Saved sharpened + equalized + binary: {sharp_equalized_binary_path}")

    # 4. Histogram Equalization + Binarization (Adaptive)
    equalized_binary = binarize_image(equalize_histogram(image.copy()), method="adaptive")
    equalized_binary_path = output_dir / f"{base_name}_4_equalized_binary.png"
    cv2.imwrite(str(equalized_binary_path), equalized_binary)
    print(f"✓ Saved equalized + binary: {equalized_binary_path}")

    # 5. Using the complete pipeline
    with open(input_path, 'rb') as f:
        image_bytes = f.read()
    
    processed_bytes = preprocess_script_image(
        image_bytes,
        sharpen=True,
        equalize=True,
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
    print(f"  2. {base_name}_1_sharp_equalized.png - Sharpened + Equalized")
    print(f"  3. {base_name}_2_sharp_binary.png - Sharpened + Binary")
    print(f"  4. {base_name}_3_sharp_equalized_binary.png - Sharpened + Equalized + Binary")
    print(f"  5. {base_name}_4_equalized_binary.png - Equalized + Binary")
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
