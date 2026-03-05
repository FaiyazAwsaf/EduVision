"use client";

import React from "react";
import { X, Upload, FileUp, Loader2 } from "lucide-react";

interface ConfirmPublishModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPublishModal({
  onConfirm,
  onCancel,
}: ConfirmPublishModalProps) {
  return (
    <div className="fixed inset-0 bg-primary-dark/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-secondary max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-primary-dark mb-4">
          Confirm Publish
        </h3>
        <p className="text-primary mb-6">
          Are you sure you want to publish this rubric set?
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-primary hover:text-primary-dark hover:bg-background rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Confirm Publish
          </button>
        </div>
      </div>
    </div>
  );
}

interface UploadDocumentModalProps {
  uploadedFile: File | null;
  isParsing: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onParse: () => void;
  onClose: () => void;
}

export function UploadDocumentModal({
  uploadedFile,
  isParsing,
  onFileSelect,
  onRemoveFile,
  onParse,
  onClose,
}: UploadDocumentModalProps) {
  return (
    <div className="fixed inset-0 bg-primary-dark/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-secondary max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-primary-dark">
            Upload Rubric Document
          </h3>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-primary text-sm mb-4">
            Upload a PDF document containing questions and marking schemes. The
            system will automatically extract the rubric information.
          </p>

          <div className="border-2 border-dashed border-secondary rounded-lg p-8 text-center">
            <FileUp className="w-12 h-12 mx-auto text-secondary mb-3" />

            {uploadedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary-dark">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-secondary">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={onRemoveFile}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-primary mb-2">
                  Drop your PDF file here or click to browse
                </p>
                <label className="inline-block cursor-pointer">
                  <span className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm">
                    Select PDF File
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={onFileSelect}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-primary hover:text-primary-dark hover:bg-background rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onParse}
            disabled={!uploadedFile || isParsing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Parse Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
