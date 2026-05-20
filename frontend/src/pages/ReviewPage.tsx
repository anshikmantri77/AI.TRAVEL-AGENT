import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPlanStatus, PlanStatus } from "../lib/api";
import ItineraryTimeline from "../components/ItineraryTimeline";
import MapView from "../components/MapView";
import StreamingStatus from "../components/StreamingStatus";
import HITLReviewPanel from "../components/HITLReviewPanel";
import { Map, List } from "lucide-react";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading, error } = useQuery<PlanStatus>({
    queryKey: ["plan", id],
    queryFn: () => getPlanStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const stage = query.state.data?.workflow_stage;
      if (stage === "awaiting_review" || stage === "completed") return false;
      return 3000;
    },
  });

  const draftItinerary = data?.draft_itinerary;
  const totalBudget = draftItinerary?.total_budget_used;
  const days = draftItinerary?.days ?? [];
  const totalExpense = days.reduce((sum: number, d: { daily_budget?: number | undefined }) => sum + (d.daily_budget || 0), 0);
  const budgetDetail: Record<string, number> = {};
  for (const d of days) {
    if (d.budget_detail) {
      for (const [k, v] of Object.entries(d.budget_detail)) {
        const val = typeof v === "number" ? v : 0;
        budgetDetail[k] = (budgetDetail[k] || 0) + val;
      }
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg text-red-400">
          {error instanceof Error ? error.message : "Plan not found"}
        </p>
      </div>
    );
  }

  const awaitingReview = data.workflow_stage === "awaiting_review";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-100">
          {awaitingReview ? "Review Your Itinerary" : "Building Your Plan..."}
        </h1>
        <p className="text-xs text-gray-500">
          Session: {id} · Stage: {data.workflow_stage}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 lg:w-[60%]">
          {data.draft_itinerary ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMap(false)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    !showMap
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <List size={14} /> Timeline
                </button>
                <button
                  onClick={() => setShowMap(true)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    showMap
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Map size={14} /> Map
                </button>
              </div>
              {showMap ? (
                <div className="h-[70vh]">
                  <MapView itinerary={data.draft_itinerary} className="h-full" />
                </div>
              ) : (
                <ItineraryTimeline itinerary={data.draft_itinerary} compact />
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-700 text-sm text-gray-500">
              Waiting for draft itinerary...
            </div>
          )}
        </div>

        <aside className="lg:w-[40%] space-y-6">
          {awaitingReview && days.length > 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Expense Breakdown
              </h3>
              <div className="mt-3 space-y-2">
                {Object.keys(budgetDetail).length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(budgetDetail).map(([k, v]) => (
                      <div key={k} className="rounded bg-gray-800/50 px-2.5 py-1.5">
                        <p className="text-[10px] uppercase text-gray-500">{k}</p>
                        <p className="text-sm font-semibold text-yellow-400">₹{v}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-yellow-400">₹{totalExpense}</p>
                )}
                <div className="flex justify-between border-t border-gray-700 pt-2 text-xs">
                  <span className="text-gray-400">Total</span>
                  <span className="font-bold text-green-400">₹{totalBudget || totalExpense}</span>
                </div>
              </div>
            </div>
          )}
          <StreamingStatus sessionId={id!} />
          {awaitingReview && (
            <HITLReviewPanel sessionId={id!} />
          )}
        </aside>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-gray-800" />
      <div className="h-3 w-64 rounded bg-gray-800" />
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-800" />
        ))}
      </div>
      <div className="h-32 rounded-xl bg-gray-800" />
      <div className="h-32 rounded-xl bg-gray-800" />
    </div>
  );
}
