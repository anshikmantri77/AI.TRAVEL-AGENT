import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { submitReview } from "../lib/api";
import {
  ThumbsUp,
  AlertTriangle,
  Edit3,
  Loader2,
  X,
  CornerDownLeft,
} from "lucide-react";

interface Props {
  sessionId: string;
  onDone?: () => void;
}

export default function HITLReviewPanel({ sessionId, onDone }: Props) {
  const navigate = useNavigate();
  const [action, setAction] = useState<"approve" | "reject" | "modify" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [modifications, setModifications] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const clearPanel = () => {
    setAction(null);
    setFeedback("");
    setModifications("");
    setError("");
  };

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const body: Parameters<typeof submitReview>[1] = { action: action! };
      if (feedback.trim()) body.feedback = feedback.trim();
      if (modifications.trim()) {
        try {
          body.modifications = JSON.parse(modifications.trim()) as Record<
            string,
            unknown
          >;
        } catch {
          setError("Modifications must be valid JSON");
          setSubmitting(false);
          return;
        }
      }
      const result = await submitReview(sessionId, body);
      if (
        result.workflow_stage === "completed" &&
        result.final_plan
      ) {
        onDone?.();
        navigate(`/plan/${sessionId}/final`);
      } else {
        clearPanel();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review submission failed");
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Review &amp; Approve
      </h3>

      <div className="space-y-2">
        <button
          onClick={() => setAction("approve")}
          disabled={!!action}
          className="flex w-full items-center gap-3 rounded-xl border border-green-800/40 bg-green-900/20 px-4 py-3 text-left text-sm font-semibold text-green-300 transition-colors hover:bg-green-900/40 disabled:opacity-40"
        >
          <ThumbsUp size={18} />
          Approve Plan
          <span className="ml-auto text-xs text-gray-500">A</span>
        </button>
        <button
          onClick={() => setAction("reject")}
          disabled={!!action}
          className="flex w-full items-center gap-3 rounded-xl border border-yellow-800/40 bg-yellow-900/20 px-4 py-3 text-left text-sm font-semibold text-yellow-300 transition-colors hover:bg-yellow-900/40 disabled:opacity-40"
        >
          <AlertTriangle size={18} />
          Request Changes
          <span className="ml-auto text-xs text-gray-500">R</span>
        </button>
        <button
          onClick={() => setAction("modify")}
          disabled={!!action}
          className="flex w-full items-center gap-3 rounded-xl border border-blue-800/40 bg-blue-900/20 px-4 py-3 text-left text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-900/40 disabled:opacity-40"
        >
          <Edit3 size={18} />
          Modify Details
          <span className="ml-auto text-xs text-gray-500">M</span>
        </button>
      </div>

      {action && (
        <div className="space-y-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold capitalize text-gray-200">
              {action === "approve"
                ? "Confirm Approval"
                : action === "reject"
                  ? "Request Changes"
                  : "Modify Details"}
            </span>
            <button
              onClick={clearPanel}
              className="text-gray-500 hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
          {action !== "approve" && (
            <>
              <textarea
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Describe your feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                autoFocus
              />
              {action === "modify" && (
                <textarea
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={4}
                  placeholder='{"key": "value"}'
                  value={modifications}
                  onChange={(e) => setModifications(e.target.value)}
                />
              )}
            </>
          )}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit
                <CornerDownLeft size={14} />
              </>
            )}
          </button>
          <p className="text-xs text-gray-500">
            {action === "approve"
              ? "Press A again or click submit"
              : "Press ⌘Enter to submit or Esc to cancel"}
          </p>
        </div>
      )}
    </div>
  );
}
