"use client";

import React, { useRef, useState } from "react";
import { useScriptUpload } from "@/hooks/useScriptUpload";
import evaluationAPI, { RubricSet } from "@/lib/api/evaluation";

interface ScriptUploadFormProps {
  rubricSets: RubricSet[];
  onUploadComplete: (scriptId: string) => void;
}

export default function ScriptUploadForm({
  rubricSets,
  onUploadComplete,
}: ScriptUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRubricSet, setSelectedRubricSet] = useState<string>("");
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

    if (!selectedRubricSet) {
      setErrors(["Please select a rubric set"]);
      return;
    }

    if (files.length === 0) {
      setErrors(["Please upload at least one page"]);
      return;
    }

    setIsUploading(true);

    try {
      const script = await evaluationAPI.uploadScript({
        rubric_set: selectedRubricSet,
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
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Rubric Set Selection */}
      <div>
        <label
          htmlFor="rubricSet"
          className="block text-sm font-medium text-[#9ACBD0] mb-2"
        >
          Rubric Set (Question Paper) *
        </label>
        <select
          id="rubricSet"
          value={selectedRubricSet}
          onChange={(e) => setSelectedRubricSet(e.target.value)}
          className="w-full px-4 py-3  border border-[#334155] rounded-lg text-white placeholder-[#48A6A7] focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
          required
        >
          <option value="">Select a rubric set...</option>
          {rubricSets
            .filter((rs) => rs.state === "published")
            .map((rubricSet) => (
              <option key={rubricSet.id} value={rubricSet.id}>
                {rubricSet.title} - {rubricSet.subject} (
                {rubricSet.questions?.length || 0} questions,{" "}
                {rubricSet.total_marks} marks)
              </option>
            ))}
        </select>
      </div>

      {/* Student Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="studentName"
            className="block text-sm font-medium text-[#9ACBD0] mb-2"
          >
            Student Name (Optional)
          </label>
          <input
            type="text"
            id="studentName"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter student name"
            className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-[#48A6A7] focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
          />
        </div>
        <div>
          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-[#9ACBD0] mb-2"
          >
            Student ID (Optional)
          </label>
          <input
            type="text"
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Enter student ID"
            className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-[#48A6A7] focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
          />
        </div>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-[#9ACBD0] mb-2">
          Answer Script Pages * ({fileCount}/{maxFiles})
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${
              isDragging
                ? "border-[#48A6A7] bg-[#48A6A7]/10"
                : "border-[#9ACBD0] hover:border-[#48A6A7]"
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
            className="mx-auto h-12 w-12 text-[#9ACBD0]"
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
          <p className="mt-2 text-sm text-[#48A6A7]">
            {canAddMore ? (
              <>
                <span className="font-semibold text-[#006A71]">
                  Click to upload
                </span>{" "}
                or drag and drop
              </>
            ) : (
              "Maximum files reached"
            )}
          </p>
          <p className="mt-1 text-xs text-[#9ACBD0]">
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
                className="w-full h-32 object-cover rounded-lg border border-[#9ACBD0]"
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ul className="list-disc list-inside text-sm text-red-600">
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
          className="px-6 py-2 border border-[#9ACBD0] rounded-lg text-[#48A6A7] hover:bg-[#9ACBD0]/10 transition-colors"
          disabled={isUploading || files.length === 0}
        >
          Clear All
        </button>
        <button
          type="submit"
          disabled={isUploading || files.length === 0 || !selectedRubricSet}
          className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
