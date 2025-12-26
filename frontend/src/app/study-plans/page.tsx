/**
 * Study Plans Page - Phase 5: Manual Mode Only
 *
 * This page allows users to:
 * - Create study plans manually
 * - Add topics to plans
 * - Manage item status and priority
 * - Link content requests to study items
 *
 * Phase 5 Constraints:
 * - Manual mode only (no AI/analytics)
 * - No automatic weakness detection
 * - All items created with source='manual'
 *
 * [MODULE 3 INTEGRATION NOTES]
 * When Module 3 is integrated, this page should:
 * - Show AI-generated topic suggestions
 * - Display weakness confidence scores
 * - Offer analytics-driven priority recommendations
 * - Show analytics justification for suggested topics
 */

"use client";

import { useState, useEffect } from "react";
import {
  listStudyPlans,
  getStudyPlan,
  deleteStudyPlan,
} from "@/api/contentRequests";
import CreateStudyPlanForm from "@/components/CreateStudyPlanForm";
import AddStudyPlanItemForm from "@/components/AddStudyPlanItemForm";
import StudyPlanItemCard from "@/components/StudyPlanItemCard";
import { StudyPlanItemStatus } from "@/types/content";
import type { StudyPlan, StudyPlanItem } from "@/types/content";

export default function StudyPlansPage() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  // Load all study plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedPlans = await listStudyPlans();
      setPlans(loadedPlans);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load study plans"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlanDetails = async (planId: string) => {
    try {
      const plan = await getStudyPlan(planId);
      setSelectedPlan(plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load plan details"
      );
    }
  };

  const handleCreatePlan = (newPlan: StudyPlan) => {
    setPlans([newPlan, ...plans]);
    setShowCreateForm(false);
    setSelectedPlan(newPlan);
  };

  const handleAddItem = (newItem: StudyPlanItem) => {
    if (selectedPlan) {
      setSelectedPlan({
        ...selectedPlan,
        items: [...selectedPlan.items, newItem],
      });
    }
    setShowAddItemForm(false);
  };

  const handleUpdateItem = (updatedItem: StudyPlanItem) => {
    if (selectedPlan) {
      setSelectedPlan({
        ...selectedPlan,
        items: selectedPlan.items.map((item) =>
          item.id === updatedItem.id ? updatedItem : item
        ),
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (selectedPlan) {
      setSelectedPlan({
        ...selectedPlan,
        items: selectedPlan.items.filter((item) => item.id !== itemId),
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this study plan and all its items?"
      )
    ) {
      return;
    }

    try {
      await deleteStudyPlan(planId);
      setPlans(plans.filter((p) => p.id !== planId));
      if (selectedPlan?.id === planId) {
        setSelectedPlan(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    }
  };

  // Filter items by status
  const pendingItems =
    selectedPlan?.items.filter(
      (i) => i.status === StudyPlanItemStatus.PENDING
    ) || [];
  const inProgressItems =
    selectedPlan?.items.filter(
      (i) => i.status === StudyPlanItemStatus.IN_PROGRESS
    ) || [];
  const completedItems =
    selectedPlan?.items.filter(
      (i) => i.status === StudyPlanItemStatus.COMPLETED
    ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Study Plans</h1>
              <p className="text-gray-600 mt-1">
                Manual Mode - Create and manage your study topics manually
              </p>
            </div>
            <div>
              <button
                onClick={() => (window.location.href = "/")}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors mr-4"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                + New Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Create Plan Form Modal */}
        {showCreateForm && (
          <div className="fixed bg-black/30 backdrop-blur-sm inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl text-black font-bold mb-4">
                Create New Study Plan
              </h2>
              <CreateStudyPlanForm
                onSuccess={handleCreatePlan}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-600 mt-4">Loading study plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No study plans yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plans List */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold text-black mb-4">
                Your Plans
              </h2>
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPlan?.id === plan.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                    onClick={() => loadPlanDetails(plan.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {plan.items.length}{" "}
                          {plan.items.length === 1 ? "item" : "items"}
                        </p>
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Manual Mode
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Details */}
            <div className="lg:col-span-2">
              {selectedPlan ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedPlan.name}
                      </h2>
                      <p className="text-gray-600 text-sm mt-1">
                        Created{" "}
                        {new Date(selectedPlan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddItemForm(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                    >
                      + Add Topic
                    </button>
                  </div>

                  {/* Add Item Form */}
                  {showAddItemForm && (
                    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3">
                        Add New Topic
                      </h3>
                      <AddStudyPlanItemForm
                        planId={selectedPlan.id}
                        onSuccess={handleAddItem}
                        onCancel={() => setShowAddItemForm(false)}
                      />
                    </div>
                  )}

                  {/* Items by Status */}
                  {selectedPlan.items.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                      <p className="text-gray-600 mb-4">
                        No topics yet. Add your first topic to get started!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Pending Items */}
                      {pendingItems.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            📋 Pending ({pendingItems.length})
                          </h3>
                          <div className="space-y-3">
                            {pendingItems.map((item) => (
                              <StudyPlanItemCard
                                key={item.id}
                                item={item}
                                onUpdate={handleUpdateItem}
                                onDelete={handleDeleteItem}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* In Progress Items */}
                      {inProgressItems.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            🔄 In Progress ({inProgressItems.length})
                          </h3>
                          <div className="space-y-3">
                            {inProgressItems.map((item) => (
                              <StudyPlanItemCard
                                key={item.id}
                                item={item}
                                onUpdate={handleUpdateItem}
                                onDelete={handleDeleteItem}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Completed Items */}
                      {completedItems.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            ✅ Completed ({completedItems.length})
                          </h3>
                          <div className="space-y-3">
                            {completedItems.map((item) => (
                              <StudyPlanItemCard
                                key={item.id}
                                item={item}
                                onUpdate={handleUpdateItem}
                                onDelete={handleDeleteItem}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                  <p className="text-gray-600">
                    Select a plan from the list to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
