import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Gem,
  Users,
  Briefcase,
  Send,
  MapPin,
  Calendar,
  Mountain,
  Utensils,
  Landmark,
  Sunset,
  Heart,
  PartyPopper,
  Compass,
} from "lucide-react";
import { createPlan, TravelRequest, TRIP_PURPOSES, INTEREST_OPTIONS } from "../lib/api";

const PERSONAS = [
  {
    id: "backpacker",
    label: "Backpacker",
    icon: Package,
    desc: "Budget hostels, free attractions, street food",
  },
  {
    id: "luxury",
    label: "Luxury",
    icon: Gem,
    desc: "5-star hotels, fine dining, private tours",
  },
  {
    id: "family",
    label: "Family",
    icon: Users,
    desc: "Kid-friendly activities, safe areas, pools",
  },
  {
    id: "business",
    label: "Business",
    icon: Briefcase,
    desc: "Business districts, co-working, networking",
  },
];

const PURPOSE_ICONS: Record<string, typeof Mountain> = {
  adventure: Mountain,
  food: Utensils,
  culture: Landmark,
  relax: Sunset,
  honeymoon: Heart,
  bachelor_party: PartyPopper,
};

const STEPS = ["Purpose", "Destination", "Budget", "Style"];
const STEP_DESC = [
  "What kind of journey?",
  "Where & when?",
  "How much?",
  "Who are you?",
];

export default function PlanWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const panelRef = useRef<HTMLDivElement>(null);

  const [purpose, setPurpose] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [numTravelers, setNumTravelers] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);

  const [persona, setPersona] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: TravelRequest) => createPlan(body),
    onSuccess: (data) => {
      navigate(`/plan/${data.session_id}/review`);
    },
  });

  useEffect(() => {
    if (panelRef.current && typeof panelRef.current.scrollTo === "function") {
      panelRef.current.scrollTo(0, 0);
    }
  }, [step]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!purpose) e.purpose = "Please select a trip purpose";
    }
    if (s === 2) {
      if (!dest.trim()) e.destination = "Destination is required";
      if (!origin.trim()) e.origin = "Departure city is required";
      if (!startDate) e.start_date = "Start date is required";
      if (!endDate) e.end_date = "End date is required";
      if (startDate && endDate && startDate >= endDate)
        e.end_date = "End date must be after start date";
    }
    if (s === 3) {
      const min = parseFloat(budgetMin);
      const max = parseFloat(budgetMax);
      if (!budgetMin || isNaN(min) || min <= 0)
        e.budget_min = "Valid minimum budget required";
      if (!budgetMax || isNaN(max) || max <= 0)
        e.budget_max = "Valid maximum budget required";
      if (min >= max) e.budget_max = "Max must be greater than min";
      if (interests.length === 0) e.interests = "Select at least one interest";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setDirection("forward");
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setDirection("back");
    setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!validateStep(step)) return;
    mutation.mutate({
      destination: dest.trim(),
      origin: origin.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      budget_min: parseFloat(budgetMin),
      budget_max: parseFloat(budgetMax),
      num_travelers: numTravelers,
      interests,
      agent_persona: persona,
      trip_purpose: purpose,
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator step={step} direction={direction} />

      <div
        ref={panelRef}
        className="mt-8 space-y-8 min-h-[360px]"
      >
        <header>
          <p className="section-label text-xs">{STEPS[step - 1]}</p>
          <h2 className="mt-2 font-display text-3xl italic text-ink">
            {STEP_DESC[step - 1]}
          </h2>
        </header>

        {step === 1 && (
          <div className="space-y-4" key="step1">
            <div className="grid grid-cols-2 gap-3">
              {TRIP_PURPOSES.map((p) => {
                const selected = purpose === p.id;
                const Icon = PURPOSE_ICONS[p.id] || Mountain;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurpose(selected ? null : p.id)}
                    className={`card p-4 text-left transition-all ${
                      selected
                        ? "border-accent ring-1 ring-accent"
                        : "hover:border-ink-mute"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} className={selected ? "text-accent" : "text-ink-mute"} />
                      <span className="text-sm font-semibold">{p.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-mute">{p.desc}</p>
                  </button>
                );
              })}
            </div>
            {errors.purpose && (
              <p className="text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.purpose}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5" key="step2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Destination *</label>
                <div className="relative">
                  <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input
                    className="input-field pl-9"
                    placeholder="e.g. Jaipur"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                  />
                </div>
                {errors.destination && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.destination}</p>}
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Departing from *</label>
                <div className="relative">
                  <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input
                    className="input-field pl-9"
                    placeholder="e.g. Mumbai"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  />
                </div>
                {errors.origin && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.origin}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Start Date *</label>
                <div className="relative">
                  <Calendar size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input
                    type="date"
                    className="input-field pl-9"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                {errors.start_date && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.start_date}</p>}
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">End Date *</label>
                <div className="relative">
                  <Calendar size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input
                    type="date"
                    className="input-field pl-9"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                {errors.end_date && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.end_date}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5" key="step3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Budget (Min) ₹</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  placeholder="5000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
                {errors.budget_min && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.budget_min}</p>}
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Budget (Max) ₹</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  placeholder="25000"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
                {errors.budget_max && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.budget_max}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">Travelers</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-paper-3 text-ink-2 hover:border-ink-mute disabled:opacity-40"
                  disabled={numTravelers <= 1}
                  onClick={() => setNumTravelers(Math.max(1, numTravelers - 1))}
                >−</button>
                <span className="w-8 text-center text-lg font-semibold font-mono">{numTravelers}</span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-paper-3 text-ink-2 hover:border-ink-mute disabled:opacity-40"
                  disabled={numTravelers >= 20}
                  onClick={() => setNumTravelers(Math.min(20, numTravelers + 1))}
                >+</button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">
                Interests <span className="text-ink-mute normal-case">— {interests.length}/10 selected</span>
              </label>
              <div className="flex flex-wrap gap-1.5 border border-rule rounded-lg bg-paper-3/50 p-3 max-h-48 overflow-y-auto">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = interests.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleInterest(opt)}
                      disabled={!selected && interests.length >= 10}
                      className={`chip ${
                        selected ? "chip-active" : "chip-inactive"
                      } disabled:opacity-30`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {errors.interests && <p className="mt-1 text-xs" style={{ color: "var(--color-status-stop)" }}>{errors.interests}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4" key="step4">
            <p className="text-sm text-ink-2">Pick a travel style — or skip for a balanced recommendation.</p>
            <div className="grid grid-cols-2 gap-3">
              {PERSONAS.map((p) => {
                const selected = persona === p.id;
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersona(selected ? null : p.id)}
                    className={`card p-4 text-left transition-all ${
                      selected
                        ? "border-accent ring-1 ring-accent"
                        : "hover:border-ink-mute"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={20} className={selected ? "text-accent" : "text-ink-mute"} />
                      <span className="font-semibold text-sm">{p.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-mute">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-rule pt-6">
        {step > 1 ? (
          <button onClick={prevStep} className="btn-ghost">
            <ArrowLeft size={15} /> Back
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button onClick={nextStep} className="btn-primary">
            Next <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Compass size={15} className="animate-spin" /> Planning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={15} /> Plan My Trip
              </span>
            )}
          </button>
        )}
      </div>

      {mutation.isError && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-status-stop)" }}>
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Something went wrong"}
        </p>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: number; direction?: "forward" | "back" }) {
  return (
    <nav aria-label="Steps" className="flex items-center gap-2 text-xs font-mono">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                active
                  ? "bg-accent text-paper shadow-[0_0_12px_var(--color-accent)]"
                  : done
                    ? "text-ink-2 border border-ink-mute"
                    : "border border-rule text-ink-mute"
              }`}
            >
              {done ? "✓" : idx}
            </div>
            <span
              className={`hidden sm:inline transition-colors ${
                active ? "text-ink" : "text-ink-mute"
              }`}
            >
              {label}
            </span>
            {idx < 4 && <div className="h-px w-5 sm:w-8 bg-rule" />}
          </div>
        );
      })}
    </nav>
  );
}
