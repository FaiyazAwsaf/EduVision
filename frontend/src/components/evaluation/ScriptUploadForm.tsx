"use client";

import React, { useRef, useState, useEffect } from "react";
import { useScriptUpload } from "@/hooks/useScriptUpload";
import {
  getRubricSets,
  uploadScript,
  type RubricSetListItem,
} from "@/api/evaluation";
import {
  getClasses,
  getSections,
  getStudents,
  type SchoolClass,
  type SchoolSection,
  type StudentProfile,
} from "@/api/school";

interface ScriptUploadFormProps {
  rubricSets: RubricSetListItem[];
  onUploadComplete: (scriptId: string) => void;
}

export default function ScriptUploadForm({
  rubricSets,
  onUploadComplete,
}: ScriptUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRubricSet, setSelectedRubricSet] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Cascading student selection state
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<SchoolSection[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedStudentUserId, setSelectedStudentUserId] = useState<string>("");
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

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

  // Load classes on mount
  useEffect(() => {
    getClasses().then(setClasses).catch(() => {});
  }, []);

  // Load sections when class changes
  useEffect(() => {
    setSections([]);
    setSelectedSectionId("");
    setStudents([]);
    setSelectedStudentUserId("");
    if (!selectedClassId) return;
    setLoadingSections(true);
    getSections(Number(selectedClassId))
      .then(setSections)
      .catch(() => {})
      .finally(() => setLoadingSections(false));
  }, [selectedClassId]);

  // Load students when section changes
  useEffect(() => {
    setStudents([]);
    setSelectedStudentUserId("");
    if (!selectedSectionId) return;
    setLoadingStudents(true);
    getStudents({ section: Number(selectedSectionId) })
      .then(setStudents)
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, [selectedSectionId]);

  const selectedStudent = students.find(
    (s) => s.user_id === selectedStudentUserId,
  );

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

    if (!selectedStudentUserId) {
      setErrors(["Please select a student"]);
      return;
    }

    if (files.length === 0) {
      setErrors(["Please upload at least one page"]);
      return;
    }

    setIsUploading(true);

    try {
      const script = await uploadScript({
        rubric_set: selectedRubricSet || undefined,
        student_user_id: selectedStudentUserId,
        pages: files,
      });

      clearFiles();
      setSelectedClassId("");
      setSelectedSectionId("");
      setSelectedStudentUserId("");
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
          className="block text-sm font-medium text-secondary mb-2"
        >
          Rubric Set (Question Paper)
        </label>
        <select
          id="rubricSet"
          value={selectedRubricSet}
          onChange={(e) => setSelectedRubricSet(e.target.value)}
          className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-primary focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">Select a rubric set...</option>
          {rubricSets
            .filter((rs) => rs.state === "published")
            .map((rubricSet) => (
              <option key={rubricSet.id} value={rubricSet.id}>
                {rubricSet.title} - {rubricSet.subject} (
                {rubricSet.question_count} questions, {rubricSet.total_marks}{" "}
                marks)
              </option>
            ))}
        </select>
      </div>

      {/* Student Selection — Cascading: Class → Section → Student */}
      <div>
        <h3 className="text-sm font-medium text-secondary mb-3">
          Select Student *
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Class */}
          <div>
            <label
              htmlFor="classSelect"
              className="block text-xs font-medium text-secondary mb-1"
            >
              Class
            </label>
            <select
              id="classSelect"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-primary focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.name}
                  {cls.stream ? ` (${cls.stream})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Section (appears after class is selected) */}
          <div>
            <label
              htmlFor="sectionSelect"
              className="block text-xs font-medium text-secondary mb-1"
            >
              Section
            </label>
            <select
              id="sectionSelect"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClassId || loadingSections}
              className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-primary focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedClassId
                  ? "Select a class first"
                  : loadingSections
                    ? "Loading sections..."
                    : "Select section..."}
              </option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Student (appears after section is selected) */}
          <div>
            <label
              htmlFor="studentSelect"
              className="block text-xs font-medium text-secondary mb-1"
            >
              Student
            </label>
            <select
              id="studentSelect"
              value={selectedStudentUserId}
              onChange={(e) => setSelectedStudentUserId(e.target.value)}
              disabled={!selectedSectionId || loadingStudents}
              className="w-full px-4 py-3 border border-[#334155] rounded-lg text-white placeholder-primary focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedSectionId
                  ? "Select a section first"
                  : loadingStudents
                    ? "Loading students..."
                    : students.length === 0
                      ? "No students in this section"
                      : "Select student..."}
              </option>
              {students.map((student) => (
                <option key={student.user_id} value={student.user_id}>
                  {student.first_name} {student.last_name} (@{student.username})
                  {student.roll_number ? ` — Roll: ${student.roll_number}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected student info card */}
        {selectedStudent && (
          <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-700/40 rounded-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
              {selectedStudent.first_name?.charAt(0)}
              {selectedStudent.last_name?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {selectedStudent.first_name} {selectedStudent.last_name}
              </p>
              <p className="text-xs text-secondary">
                @{selectedStudent.username}
                {selectedStudent.roll_number &&
                  ` • Roll: ${selectedStudent.roll_number}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">
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
                ? "border-primary bg-primary/10"
                : "border-secondary hover:border-primary"
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
            className="mx-auto h-12 w-12 text-secondary"
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
          <p className="mt-2 text-sm text-primary">
            {canAddMore ? (
              <>
                <span className="font-semibold text-primary-dark">
                  Click to upload
                </span>{" "}
                or drag and drop
              </>
            ) : (
              "Maximum files reached"
            )}
          </p>
          <p className="mt-1 text-xs text-secondary">
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
                className="w-full h-32 object-cover rounded-lg border border-secondary"
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
          className="px-6 py-2 border border-secondary rounded-lg text-primary hover:bg-secondary/10 transition-colors"
          disabled={isUploading || files.length === 0}
        >
          Clear All
        </button>
        <button
          type="submit"
          disabled={isUploading || files.length === 0 || !selectedStudentUserId}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
