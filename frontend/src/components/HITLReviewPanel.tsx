import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { submitReview } from "../lib/api";
import { ThumbsUp, AlertTriangle, Edit3, Loader2, X, CornerDownLeft } from "lucide-react";

interface Props { sessionId: string; onDone?: () => void }

export default function HITLReviewPanel({ sessionId, onDone }: Props) {
  const navigate = useNavigate();
  const [action, setAction] = useState<"approve" | "reject" | "modify" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [modifications, setModifications] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const clearPanel = () => { setAction(null); setFeedback(""); setModifications(""); setError(""); };

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const body: Parameters<typeof submitReview>[1] = { action: action! };
      if (feedback.trim()) body.feedback = feedback.trim();
      if (modifications.trim()) {
        try { body.modifications = JSON.parse(modifications.trim()); }
        catch { setError("Modifications must be valid JSON"); setSubmitting(false); return; }
      }
      const result = await submitReview(sessionId, body);
      if (result.workflow_stage === "completed" && result.final_plan) {
        onDone?.();
        navigate(`/plan/${sessionId}/final`);
      } else clearPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review submission failed");
    } finally { setSubmitting(false); }
  }, [action, feedback, modifications, sessionId, navigate, onDone]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (action) {
        if (e.key === "Escape") clearPanel();
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        return;
      }
      if (e.key === "a" || e.key === "A") setAction("approve");
      if (e.key === "r" || e.key === "R") setAction("reject");
      if (e.key === "m" || e.key === "M") setAction("modify");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [action, handleSubmit]);

  const BtnClass = (selected: boolean, _color: string) =>
    `flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-all ${
      selected ? "ring-1" : "hover:opacity-80"
    }`;

  return (
    <div className="space-y-4">
      <p className="section-label text-xs">Review &amp; Approve</p>

      <div className="space-y-2">
        <button onClick={() => setAction("approve")} disabled={!!action}
          className={BtnClass(action === "approve", "green")}
          style={{
            borderColor: action === "approve" ? "var(--color-status-go)" : "var(--color-rule)",
            background: action === "approve" ? "oklch(45% 0.18 145 / 0.15)" : "var(--color-paper-2)",
            color: "var(--color-status-go)",
          }}>
          <ThumbsUp size={17} /> Approve Plan <span className="ml-auto font-mono text-[10px] uppercase text-ink-mute">A</span>
        </button>
        <button onClick={() => setAction("reject")} disabled={!!action}
          className={BtnClass(action === "reject", "yellow")}
          style={{
            borderColor: action === "reject" ? "oklch(60% 0.15 80)" : "var(--color-rule)",
            background: action === "reject" ? "oklch(45% 0.15 80 / 0.15)" : "var(--color-paper-2)",
            color: "oklch(65% 0.15 80)",
          }}>
          <AlertTriangle size={17} /> Request Changes <span className="ml-auto font-mono text-[10px] uppercase text-ink-mute">R</span>
        </button>
        <button onClick={() => setAction("modify")} disabled={!!action}
          className={BtnClass(action === "modify", "blue")}
          style={{
            borderColor: action === "modify" ? "var(--color-focus)" : "var(--color-rule)",
            background: action === "modify" ? "oklch(45% 0.18 230 / 0.15)" : "var(--color-paper-2)",
            color: "oklch(70% 0.18 230)",
          }}>
          <Edit3 size={17} /> Modify Details <span className="ml-auto font-mono text-[10px] uppercase text-ink-mute">M</span>
        </button>
      </div>

      {action && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm italic text-ink">
              {action === "approve" ? "Confirm Approval" : action === "reject" ? "Request Changes" : "Modify Details"}
            </span>
            <button onClick={clearPanel} className="text-ink-mute hover:text-ink"><X size={15} /></button>
          </div>
          {action !== "approve" && (
            <>
              <textarea
                className="input-field resize-none"
                rows={3} placeholder="Describe your feedback..."
                value={feedback} onChange={(e) => setFeedback(e.target.value)}
                autoFocus
              />
              {action === "modify" && (
                <textarea
                  className="input-field font-mono resize-none"
                  rows={4} placeholder='{"key": "value"}'
                  value={modifications} onChange={(e) => setModifications(e.target.value)}
                />
              )}
            </>
          )}
          {error && <p className="text-xs" style={{ color: "var(--color-status-stop)" }}>{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="btn-primary w-full justify-center">
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting...</>
              : <><CornerDownLeft size={14} /> Submit</>}
          </button>
          <p className="text-[10px] text-ink-mute font-mono">
            {action === "approve" ? "Press A again or click submit" : "Press ⌘Enter to submit or Esc to cancel"}
          </p>
        </div>
      )}
    </div>
  );
}
