"use client";

import React, { useState, useRef } from "react";
import evaluationAPI, { QuestionPaper } from "@/lib/api/evaluation";

interface PDFUploadFormProps {
  onSuccess: (paper: QuestionPaper) => void;
  onCancel?: () => void;
  existingPaperId?: string; // For adding rubrics to existing paper
}

export default function PDFUploadForm({
  onSuccess,
  onCancel,
  existingPaperId,
}: PDFUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [paperType, setPaperType] = useState<
    "question" | "rubric" | "combined"
  >("combined");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [classLevel, setClassLevel] = useState("9");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setError("Please select a PDF file");
        return;
      }
      setFile(selectedFile);
      setError(null);

      // Auto-fill title from filename if empty
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.pdf$/i, "");
        setTitle(nameWithoutExt.replace(/_/g, " "));
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith(".pdf")) {
        setError("Please drop a PDF file");
        return;
      }
      setFile(droppedFile);
      setError(null);

      if (!title) {
        const nameWithoutExt = droppedFile.name.replace(/\.pdf$/i, "");
        setTitle(nameWithoutExt.replace(/_/g, " "));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setProgress("Uploading PDF...");

    try {
      let paper: QuestionPaper;

      if (existingPaperId) {
        // Upload rubric to existing paper
        setProgress("Extracting rubrics with AI...");
        paper = await evaluationAPI.uploadRubricPDF(existingPaperId, file);
      } else {
        // Create new paper from PDF
        setProgress("Extracting questions and rubrics with AI...");
        paper = await evaluationAPI.uploadQuestionPaperPDF({
          pdf: file,
          paper_type: paperType,
          title: title || undefined,
          subject,
          class_level: classLevel,
        });
      }

      setProgress("Done!");
      onSuccess(paper);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setIsSubmitting(false);
      setProgress(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File Upload Area */}
      <div className="bg-white rounded-xl p-6 border border-[#9ACBD0]">
        <h2 className="text-lg font-semibold text-[#006A71] mb-4">
          {existingPaperId
            ? "Upload Marking Scheme PDF"
            : "Upload Question Paper PDF"}
        </h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            file
              ? "border-[#48A6A7] bg-[#48A6A7]/10"
              : "border-[#9ACBD0] hover:border-[#48A6A7]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
          />

          {file ? (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#48A6A7]/20 rounded-full">
                <svg
                  className="w-8 h-8 text-[#006A71]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-[#006A71]">
                  {file.name}
                </p>
                <p className="text-sm text-[#48A6A7]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove File
              </button>
            </div>
          ) : (
            <label htmlFor="pdf-upload" className="cursor-pointer">
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F2EFE7] rounded-full">
                  <svg
                    className="w-8 h-8 text-[#9ACBD0]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-medium text-[#006A71]">
                    Drop your PDF here or click to browse
                  </p>
                  <p className="text-sm text-[#48A6A7] mt-1">
                    Supports question papers with marking schemes
                  </p>
                </div>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Paper Options (only for new papers) */}
      {!existingPaperId && (
        <div className="bg-white rounded-xl p-6 border border-[#9ACBD0]">
          <h2 className="text-lg font-semibold text-[#006A71] mb-4">
            Paper Details
          </h2>

          <div className="space-y-4">
            {/* Paper Type */}
            <div>
              <label className="block text-sm font-medium text-[#006A71] mb-2">
                PDF Content Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    value: "combined",
                    label: "Questions + Rubrics",
                    desc: "Full paper with marking scheme",
                  },
                  {
                    value: "question",
                    label: "Questions Only",
                    desc: "Questions without rubrics",
                  },
                  {
                    value: "rubric",
                    label: "Rubrics Only",
                    desc: "Marking scheme only",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setPaperType(option.value as typeof paperType)
                    }
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      paperType === option.value
                        ? "border-[#48A6A7] bg-[#48A6A7]/5"
                        : "border-[#9ACBD0] hover:border-[#48A6A7]"
                    }`}
                  >
                    <p
                      className={`font-medium ${
                        paperType === option.value
                          ? "text-[#006A71]"
                          : "text-[#48A6A7]"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-[#9ACBD0] mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#006A71] mb-1">
                  Title (Optional - will be extracted from PDF)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave empty to extract from PDF"
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-[#006A71] mb-1">
                  Subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                </select>
              </div>

              {/* Class Level */}
              <div>
                <label className="block text-sm font-medium text-[#006A71] mb-1">
                  Class Level
                </label>
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                >
                  <option value="9">Class 9</option>
                  <option value="10">Class 10</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-500 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {progress && (
        <div className="bg-[#48A6A7]/10 border border-[#48A6A7] rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="animate-spin w-5 h-5 text-[#48A6A7] mr-2"
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
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-[#006A71]">{progress}</span>
          </div>
        </div>
      )}

      {/* AI Note */}
      <div className="bg-[#F2EFE7] border border-[#9ACBD0] rounded-lg p-4">
        <div className="flex">
          <svg
            className="w-5 h-5 text-[#48A6A7] mr-2 mt-0.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-[#006A71] font-medium">AI Extraction</p>
            <p className="text-[#48A6A7] text-sm mt-1">
              Questions and rubrics will be extracted using AI (Gemini). Please
              review the extracted content after upload to ensure accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-[#9ACBD0] rounded-lg text-[#48A6A7] hover:bg-[#F2EFE7] transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!file || isSubmitting}
          className="px-6 py-2.5 bg-[#48A6A7] hover:bg-[#006A71] disabled:bg-[#9ACBD0] text-white rounded-lg transition-colors flex items-center"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin w-4 h-4 mr-2"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
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
              {existingPaperId ? "Upload Rubric PDF" : "Extract & Create Paper"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
