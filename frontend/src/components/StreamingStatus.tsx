import { useEffect, useState } from "react";
import { subscribeToStream, StreamEvent } from "../lib/api";
import { format } from "date-fns";
import { CheckCircle2, Loader2 } from "lucide-react";

interface StageState { completedAt: string | null; active: boolean }

export default function StreamingStatus({ sessionId }: { sessionId: string }) {
  const [stages, setStages] = useState<Record<string, StageState>>({});
  useEffect(() => {
    if (!sessionId) return;
    return subscribeToStream(sessionId, (event: StreamEvent) => {
      setStages((prev) => ({ ...prev, [event.data.stage]: { completedAt: event.data.timestamp, active: true } }));
    });
  }, [sessionId]);

  const steps = [
    { key: "validated", label: "Validating request" },
    { key: "research_complete", label: "Researching destination" },
    { key: "planning_complete", label: "Building itinerary" },
    { key: "awaiting_review", label: "Awaiting your review" },
    { key: "done", label: "Finalizing plan" },
  ];

  const activeIdx = steps.findIndex((s) => stages[s.key]?.active);
  const isWaiting = activeIdx < 0;

  return (
    <div className="space-y-3">
      <p className="section-label text-xs">Progress</p>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const completed = !!stages[step.key]?.completedAt;
          const active = i === activeIdx && !completed;
          const color = active ? "var(--color-accent)" : completed ? "var(--color-status-go)" : "var(--color-rule)";
          return (
            <div key={step.key} className="flex items-start gap-3 py-3 pl-4 transition-all" style={{ borderLeft: `2px solid ${color}` }}>
              {completed ? (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: "var(--color-status-go)" }} />
              ) : active ? (
                <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin text-accent" />
              ) : (
                <div className="mt-0.5 shrink-0 h-[17px] w-[17px] rounded-full border-2" style={{ borderColor: "var(--color-rule)" }} />
              )}
              <div className="min-w-0">
                <p className="text-sm" style={{ color: completed ? "var(--color-status-go)" : active ? "var(--color-ink)" : "var(--color-ink-mute)" }}>
                  {step.label}
                </p>
                {completed && stages[step.key]?.completedAt && i < 3 && (
                  <p className="font-mono text-[11px] text-ink-mute">
                    {format(new Date(stages[step.key]!.completedAt!), "HH:mm:ss")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isWaiting && (
        <p className="flex items-center gap-2 font-mono text-[11px] text-ink-mute">
          <Loader2 size={12} className="animate-spin text-accent" />
          Waiting for planner...
        </p>
      )}
    </div>
  );
}
