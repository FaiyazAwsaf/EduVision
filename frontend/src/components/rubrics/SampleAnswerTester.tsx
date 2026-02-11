"use client";

import React, { useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { EvaluationRule } from "./RuleEditor";
import { testRubric } from "@/api/rubrics";

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
    if (percentage >= 80) return "text-primary-dark";
    if (percentage >= 60) return "text-primary";
    if (percentage >= 40) return "text-secondary";
    return "text-red-600";
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return "bg-primary-dark/10";
    if (percentage >= 60) return "bg-primary/10";
    if (percentage >= 40) return "bg-secondary/20";
    return "bg-red-100";
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
      const result = await testRubric(
        {
          evaluation_rules: evaluationRules,
          total_marks: totalMarks,
        },
        sampleAnswer,
      );

      setTestResult(result);
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
      <div className="bg-white rounded-xl border border-secondary p-6">
        <h2 className="text-xl font-semibold text-primary-dark mb-4">
          Test Sample Answer
        </h2>
        <p className="text-sm text-primary mb-4">
          Enter a sample student answer to see how your rubric would evaluate
          it.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="sampleAnswer"
              className="block text-sm font-medium text-primary-dark mb-2"
            >
              Sample Answer
            </label>
            <textarea
              id="sampleAnswer"
              value={sampleAnswer}
              onChange={(e) => setSampleAnswer(e.target.value)}
              className="w-full px-4 py-2 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark"
              rows={8}
              placeholder="Enter the student's answer here..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestAnswer}
              disabled={isLoading || !sampleAnswer.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
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
                  Testing...
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
                className="px-6 py-2 border border-secondary text-primary-dark rounded-lg hover:bg-background transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {testResult && (
        <div className="space-y-6">
          {/* Score Summary Card */}
          <div className="bg-white rounded-xl border border-secondary p-6">
            <h2 className="text-xl font-semibold text-primary-dark mb-6">
              Test Results
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Info */}
              <div>
                <div className="space-y-2 text-sm text-primary">
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
                <div
                  className={`text-5xl font-bold ${getScoreColor(percentage)}`}
                >
                  {percentage.toFixed(1)}%
                </div>
                <div className="mt-2 text-lg text-primary">
                  {testResult.total_score.toFixed(1)} / {testResult.max_score}{" "}
                  marks
                </div>
                <div
                  className={`mt-4 px-4 py-1 rounded-full text-sm font-medium ${getScoreBgColor(
                    percentage,
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
            <h2 className="text-xl font-semibold text-primary-dark">
              Rule-by-Rule Analysis
            </h2>

            {testResult.rule_results.map((result, index) => (
              <div
                key={result.rule_id}
                className="bg-white rounded-xl border border-secondary overflow-hidden"
              >
                {/* Rule Header */}
                <div className="bg-background px-6 py-4 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium text-primary">
                      Rule {index + 1}
                    </span>
                    <h3 className="text-lg font-medium text-primary-dark capitalize">
                      {result.rule_type} Evaluation
                    </h3>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${getScoreColor(
                        (result.score_awarded / result.max_marks) * 100,
                      )}`}
                    >
                      {result.score_awarded.toFixed(1)} / {result.max_marks}
                    </div>
                    <div className="text-xs text-primary">marks</div>
                  </div>
                </div>

                {/* Rule Content */}
                <div className="px-6 py-4 space-y-4">
                  {/* Match Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        result.matched
                          ? "bg-primary-dark/10 text-primary-dark"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.matched ? (
                        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Matched</span>
                      ) : (
                        <span className="flex items-center gap-1"><XIcon className="w-3 h-3" /> Not Matched</span>
                      )}
                    </span>
                  </div>

                  {/* Feedback */}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-20">
                      <span className="text-sm font-medium text-primary-dark">
                        Feedback
                      </span>
                    </div>
                    <div className="flex-1 text-sm text-primary">
                      {result.feedback_message || "No feedback provided"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Feedback */}
          {testResult.feedback && (
            <div className="bg-white rounded-xl border border-secondary p-6">
              <h2 className="text-xl font-semibold text-primary-dark mb-4">
                Overall Feedback
              </h2>
              <div className="prose max-w-none">
                <pre className="text-sm text-primary whitespace-pre-wrap font-sans">
                  {testResult.feedback}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
