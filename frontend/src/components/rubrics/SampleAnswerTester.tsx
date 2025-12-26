"use client";

import React, { useState } from "react";
import { EvaluationRule } from "./RuleEditor";

interface RuleResult {
  rule_id: string;
  rule_type: string;
  score_awarded: number;
  max_marks: number;
  matched: boolean;
  feedback_message: string;
}

interface TestResult {
  total_score: number;
  max_score: number;
  rule_results: RuleResult[];
  feedback: string;
}

interface SampleAnswerTesterProps {
  rubricId?: string;
  evaluationRules: EvaluationRule[];
  totalMarks: number;
}

export default function SampleAnswerTester({
  rubricId,
  evaluationRules,
  totalMarks,
}: SampleAnswerTesterProps) {
  const [sampleAnswer, setSampleAnswer] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 60) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (percentage >= 60) return "bg-blue-100 dark:bg-blue-900/30";
    if (percentage >= 40) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const handleTestAnswer = async () => {
    if (!sampleAnswer.trim()) {
      setError("Please enter a sample answer to test");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      // TODO: Replace with actual API call
      // For now, simulate the response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock result - replace with actual API call
      const mockResult: TestResult = {
        total_score: 7.5,
        max_score: totalMarks,
        rule_results: evaluationRules.map((rule, index) => ({
          rule_id: rule.id,
          rule_type: rule.type,
          score_awarded: rule.marks * 0.75, // Mock: 75% score
          max_marks: rule.marks,
          matched: index % 2 === 0,
          feedback_message: rule.feedback.on_success || "Evaluation completed",
        })),
        feedback: "Overall performance analysis...",
      };

      setTestResult(mockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test answer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSampleAnswer("");
    setTestResult(null);
    setError(null);
  };

  const percentage = testResult
    ? (testResult.total_score / testResult.max_score) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Test Sample Answer
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter a sample student answer to see how your rubric would evaluate it.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="sampleAnswer"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Sample Answer
            </label>
            <textarea
              id="sampleAnswer"
              value={sampleAnswer}
              onChange={(e) => setSampleAnswer(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              rows={8}
              placeholder="Enter the student's answer here..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestAnswer}
              disabled={isLoading || !sampleAnswer.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                  Testing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Test Answer
                </>
              )}
            </button>
            {testResult && (
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {testResult && (
        <div className="space-y-6">
          {/* Score Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Test Results
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Info */}
              <div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    <span className="font-medium">Total Rules:</span>{" "}
                    {testResult.rule_results.length}
                  </p>
                  <p>
                    <span className="font-medium">Rules Matched:</span>{" "}
                    {testResult.rule_results.filter((r) => r.matched).length} /{" "}
                    {testResult.rule_results.length}
                  </p>
                  <p>
                    <span className="font-medium">Max Possible:</span>{" "}
                    {testResult.max_score} marks
                  </p>
                </div>
              </div>

              {/* Right: Score */}
              <div className="flex flex-col items-center justify-center">
                <div className={`text-5xl font-bold ${getScoreColor(percentage)}`}>
                  {percentage.toFixed(1)}%
                </div>
                <div className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                  {testResult.total_score.toFixed(1)} / {testResult.max_score} marks
                </div>
                <div
                  className={`mt-4 px-4 py-1 rounded-full text-sm font-medium ${getScoreBgColor(
                    percentage
                  )} ${getScoreColor(percentage)}`}
                >
                  {percentage >= 80
                    ? "Excellent"
                    : percentage >= 60
                    ? "Good"
                    : percentage >= 40
                    ? "Satisfactory"
                    : "Needs Improvement"}
                </div>
              </div>
            </div>
          </div>

          {/* Rule-by-Rule Results */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Rule-by-Rule Analysis
            </h2>

            {testResult.rule_results.map((result, index) => (
              <div
                key={result.rule_id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
              >
                {/* Rule Header */}
                <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Rule {index + 1}
                    </span>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                      {result.rule_type} Evaluation
                    </h3>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${getScoreColor(
                        (result.score_awarded / result.max_marks) * 100
                      )}`}
                    >
                      {result.score_awarded.toFixed(1)} / {result.max_marks}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">marks</div>
                  </div>
                </div>

                {/* Rule Content */}
                <div className="px-6 py-4 space-y-4">
                  {/* Match Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        result.matched
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                      }`}
                    >
                      {result.matched ? "✓ Matched" : "✗ Not Matched"}
                    </span>
                  </div>

                  {/* Feedback */}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-20">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Feedback
                      </span>
                    </div>
                    <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                      {result.feedback_message || "No feedback provided"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Feedback */}
          {testResult.feedback && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Overall Feedback
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-400">{testResult.feedback}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
