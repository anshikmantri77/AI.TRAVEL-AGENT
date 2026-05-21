import PlanWizard from "../components/PlanWizard";

export default function PlanPage() {
  return (
    <div className="min-h-screen">
      <div className="shell pt-8 pb-4">
        <div className="flex items-baseline justify-between border-b border-rule pb-4">
          <a href="/plan" className="font-display text-2xl font-bold tracking-tight text-ink hover:no-underline">
            <span className="text-accent">✱ </span>Wayfinder
          </a>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
            Plan your journey
          </span>
        </div>
      </div>

      <div className="shell py-8">
        <PlanWizard />
      </div>
    </div>
  );
}
