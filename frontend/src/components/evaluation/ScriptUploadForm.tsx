"use client";

import React, { useRef, useState } from "react";
import { useScriptUpload } from "@/hooks/useScriptUpload";
import evaluationAPI, { QuestionPaper } from "@/lib/api/evaluation";

interface ScriptUploadFormProps {
  questionPapers: QuestionPaper[];
  onUploadComplete: (scriptId: string) => void;
}

export default function ScriptUploadForm({
  questionPapers,
  onUploadComplete,
}: ScriptUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPaper, setSelectedPaper] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const {
    files,
    previews,
    isDragging,
    addFiles,
    removeFile,
    clearFiles,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    canAddMore,
    fileCount,
    maxFiles,
  } = useScriptUpload({ maxFiles: 10 });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const uploadErrors = addFiles(e.target.files);
      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!selectedPaper) {
      setErrors(["Please select a question paper"]);
      return;
    }

    if (files.length === 0) {
      setErrors(["Please upload at least one page"]);
      return;
    }

    setIsUploading(true);

    try {
      const script = await evaluationAPI.uploadScript({
        question_paper: selectedPaper,
        student_name: studentName || undefined,
        student_id: studentId || undefined,
        pages: files,
      });

      clearFiles();
      setStudentName("");
      setStudentId("");
      onUploadComplete(script.id);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Upload failed. Please try again.",
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Question Paper Selection */}
      <div>
        <label
          htmlFor="questionPaper"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Question Paper *
        </label>
        <select
          id="questionPaper"
          value={selectedPaper}
          onChange={(e) => setSelectedPaper(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          required
        >
          <option value="">Select a question paper...</option>
          {questionPapers.map((paper) => (
            <option key={paper.id} value={paper.id}>
              {paper.title} - {paper.subject} (Class {paper.class_level})
            </option>
          ))}
        </select>
      </div>

      {/* Student Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="studentName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Student Name (Optional)
          </label>
          <input
            type="text"
            id="studentName"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter student name"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Student ID (Optional)
          </label>
          <input
            type="text"
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Enter student ID"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Answer Script Pages * ({fileCount}/{maxFiles})
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }
            ${!canAddMore ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={!canAddMore}
          />
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {canAddMore ? (
              <>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Click to upload
                </span>{" "}
                or drag and drop
              </>
            ) : (
              "Maximum files reached"
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            PNG, JPG, WEBP up to 10MB each (max 10 pages)
          </p>
        </div>
      </div>

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Page ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                Page {index + 1}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={clearFiles}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          disabled={isUploading || files.length === 0}
        >
          Clear All
        </button>
        <button
          type="submit"
          disabled={isUploading || files.length === 0 || !selectedPaper}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Upload Script
            </>
          )}
        </button>
      </div>
    </form>
  );
}
