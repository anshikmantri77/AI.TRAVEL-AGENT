import { Plane } from "lucide-react";
import PlanWizard from "../components/PlanWizard";

export default function PlanPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-400">
          <Plane size={28} />
          TripMind
        </div>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered travel planning
        </p>
      </div>
      <PlanWizard />
    </div>
  );
}
