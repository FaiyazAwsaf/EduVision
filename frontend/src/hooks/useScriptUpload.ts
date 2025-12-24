"use client";

import { useState, useCallback } from "react";

interface UploadState {
  files: File[];
  previews: string[];
  isDragging: boolean;
}

interface UseScriptUploadOptions {
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSizeBytes?: number;
}

export function useScriptUpload(options: UseScriptUploadOptions = {}) {
  const {
    maxFiles = 10,
    acceptedTypes = ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes = 10 * 1024 * 1024, // 10MB
  } = options;

  const [state, setState] = useState<UploadState>({
    files: [],
    previews: [],
    isDragging: false,
  });

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return `Invalid file type. Accepted: ${acceptedTypes.join(", ")}`;
      }
      if (file.size > maxSizeBytes) {
        return `File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`;
      }
      return null;
    },
    [acceptedTypes, maxSizeBytes]
  );

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const filesArray = Array.from(newFiles);
      const errors: string[] = [];

      setState((prev) => {
        const currentCount = prev.files.length;
        const availableSlots = maxFiles - currentCount;

        if (availableSlots <= 0) {
          errors.push(`Maximum ${maxFiles} files allowed`);
          return prev;
        }

        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        for (const file of filesArray.slice(0, availableSlots)) {
          const error = validateFile(file);
          if (error) {
            errors.push(`${file.name}: ${error}`);
          } else {
            validFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
          }
        }

        return {
          ...prev,
          files: [...prev.files, ...validFiles],
          previews: [...prev.previews, ...newPreviews],
        };
      });

      return errors;
    },
    [maxFiles, validateFile]
  );

  const removeFile = useCallback((index: number) => {
    setState((prev) => {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(prev.previews[index]);

      return {
        ...prev,
        files: prev.files.filter((_, i) => i !== index),
        previews: prev.previews.filter((_, i) => i !== index),
      };
    });
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const newFiles = [...prev.files];
      const newPreviews = [...prev.previews];

      const [movedFile] = newFiles.splice(fromIndex, 1);
      const [movedPreview] = newPreviews.splice(fromIndex, 1);

      newFiles.splice(toIndex, 0, movedFile);
      newPreviews.splice(toIndex, 0, movedPreview);

      return {
        ...prev,
        files: newFiles,
        previews: newPreviews,
      };
    });
  }, []);

  const clearFiles = useCallback(() => {
    setState((prev) => {
      // Revoke all object URLs
      prev.previews.forEach(URL.revokeObjectURL);
      return {
        files: [],
        previews: [],
        isDragging: false,
      };
    });
  }, []);

  const setDragging = useCallback((isDragging: boolean) => {
    setState((prev) => ({ ...prev, isDragging }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files) {
        return addFiles(e.dataTransfer.files);
      }
      return [];
    },
    [addFiles, setDragging]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    [setDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
    },
    [setDragging]
  );

  return {
    files: state.files,
    previews: state.previews,
    isDragging: state.isDragging,
    addFiles,
    removeFile,
    reorderFiles,
    clearFiles,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    canAddMore: state.files.length < maxFiles,
    fileCount: state.files.length,
    maxFiles,
  };
}
