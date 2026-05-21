import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPlanStatus, PlanStatus } from "../lib/api";
import ItineraryTimeline from "../components/ItineraryTimeline";
import MapView from "../components/MapView";
import StreamingStatus from "../components/StreamingStatus";
import HITLReviewPanel from "../components/HITLReviewPanel";
import { Map, List, Compass, ArrowLeft } from "lucide-react";

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
  const totalExpense = days.reduce((sum: number, d: { daily_budget?: number | string | undefined }) => sum + Number(d.daily_budget || 0), 0);
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
        <p className="text-lg" style={{ color: "var(--color-status-stop)" }}>
          {error instanceof Error ? error.message : "Plan not found"}
        </p>
      </div>
    );
  }

  const awaitingReview = data.workflow_stage === "awaiting_review";

  return (
    <div className="min-h-screen">
      <header className="shell py-4 border-b border-rule">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/plan"
              className="btn-ghost text-xs"
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <div>
              <h1 className="font-display text-xl italic text-ink">
                {awaitingReview ? "Review Your Itinerary" : "Building Your Plan..."}
              </h1>
              <p className="font-mono text-xs text-ink-mute mt-0.5">
                Session: {id?.slice(0, 8)}··· &middot; Stage: {data.workflow_stage}
              </p>
            </div>
          </div>
          {!awaitingReview && (
            <div className="flex items-center gap-2 font-mono text-xs text-ink-mute">
              <Compass size={14} className="animate-spin text-accent" />
              Processing...
            </div>
          )}
        </div>
      </header>

      <div className="shell py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 lg:w-[65%]">
            {data.draft_itinerary ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-rule pb-3">
                  <button
                    onClick={() => setShowMap(false)}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium font-mono uppercase tracking-[0.1em] transition-all ${
                      !showMap
                        ? "bg-accent text-paper"
                        : "border border-rule text-ink-2 hover:text-ink"
                    }`}
                  >
                    <List size={13} /> Timeline
                  </button>
                  <button
                    onClick={() => setShowMap(true)}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium font-mono uppercase tracking-[0.1em] transition-all ${
                      showMap
                        ? "bg-accent text-paper"
                        : "border border-rule text-ink-2 hover:text-ink"
                    }`}
                  >
                    <Map size={13} /> Map
                  </button>
                </div>
                {showMap ? (
                  <div className="h-[65vh] rounded-lg overflow-hidden border border-rule">
                    <MapView itinerary={data.draft_itinerary} className="h-full" />
                  </div>
                ) : (
                  <ItineraryTimeline itinerary={data.draft_itinerary} compact />
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-rule text-sm text-ink-mute">
                <div className="text-center">
                  <Compass size={24} className="mx-auto mb-2 text-ink-mute" />
                  Waiting for draft itinerary...
                </div>
              </div>
            )}
          </div>

          <aside className="lg:w-[35%] space-y-6">
            {awaitingReview && days.length > 0 && (
              <div className="card p-4">
                <p className="section-label text-xs mb-3">Total Expense Breakdown</p>
                <div className="space-y-2">
                  {Object.keys(budgetDetail).length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(budgetDetail).map(([k, v]) => (
                        <div key={k} className="rounded bg-paper-3/50 px-2.5 py-1.5">
                          <p className="font-mono text-[10px] uppercase text-ink-mute">{k}</p>
                          <p className="text-sm font-semibold text-accent">₹{v}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-accent">₹{totalExpense}</p>
                  )}
                  <div className="flex justify-between border-t border-rule pt-2 text-xs">
                    <span className="text-ink-mute font-mono uppercase tracking-[0.1em]">Total</span>
                    <span className="font-bold" style={{ color: "var(--color-status-go)" }}>
                      ₹{totalBudget || totalExpense}
                    </span>
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
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded" style={{ background: "var(--color-paper-3)" }} />
      <div className="h-3 w-64 rounded" style={{ background: "var(--color-paper-3)" }} />
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg" style={{ background: "var(--color-paper-3)" }} />
        ))}
      </div>
      <div className="h-32 rounded-lg" style={{ background: "var(--color-paper-3)" }} />
      <div className="h-32 rounded-lg" style={{ background: "var(--color-paper-3)" }} />
    </div>
  );
}
