import { useEffect, useState } from "react";
import { subscribeToStream, StreamEvent } from "../lib/api";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";



interface StageState {
  completedAt: string | null;
  active: boolean;
}

export default function StreamingStatus({ sessionId }: { sessionId: string }) {
  const [stages, setStages] = useState<Record<string, StageState>>({});
  useEffect(() => {
    if (!sessionId) return;
    const cleanup = subscribeToStream(sessionId, (event: StreamEvent) => {
      setStages((prev) => ({
        ...prev,
        [event.data.stage]: {
          completedAt: event.data.timestamp,
          active: true,
        },
      }));
    });
    return cleanup;
  }, [sessionId]);

  const steps = [
    { key: "validated", label: "Validating request" },
    { key: "research_complete", label: "Researching destination" },
    { key: "planning_complete", label: "Building itinerary" },
    { key: "awaiting_review", label: "Awaiting your review" },
    { key: "done", label: "Finalizing plan" },
  ];

  const currentIdx = steps.findIndex((s) => stages[s.key]?.active);
  const activeIdx = currentIdx >= 0 ? currentIdx : -1;
  const isWaiting = activeIdx < 0;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Progress
      </h3>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const completed = !!stages[step.key]?.completedAt;
          const active = i === activeIdx && !completed;
      return (
            <div
              key={step.key}
              className={`flex items-start gap-3 border-l-2 py-3 pl-4 transition-all duration-300 ${
                active
                  ? "border-blue-500"
                  : completed
                    ? "border-green-500"
                    : "border-gray-700"
              }`}
            >
              {completed ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400" />
              ) : active ? (
                <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-blue-400" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-gray-600" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm ${
                    completed
                      ? "text-green-300"
                      : active
                        ? "text-blue-200"
                        : "text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
                {completed && stages[step.key]?.completedAt && i < 3 && (
                  <p className="text-xs text-gray-500">
                    {format(new Date(stages[step.key]!.completedAt!), "HH:mm:ss")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isWaiting && (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          Waiting for planner...
        </p>
      )}
    </div>
  );
}
