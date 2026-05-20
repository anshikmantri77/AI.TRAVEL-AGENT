import { useState } from "react";
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

export default function PlanWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (validateStep(step)) setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

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

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400";
  const errorClass = "mt-1 text-xs text-red-400";

  if (step === 1) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <StepIndicator step={1} />
        <p className="text-sm text-gray-400">
          What kind of trip are you planning?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {TRIP_PURPOSES.map((p) => {
            const selected = purpose === p.id;
            const Icon = PURPOSE_ICONS[p.id] || Mountain;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPurpose(selected ? null : p.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-blue-500 bg-blue-900/30 ring-1 ring-blue-500"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={18} className={selected ? "text-blue-400" : "text-gray-400"} />
                  <span className="text-sm font-semibold">{p.label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{p.desc}</p>
              </button>
            );
          })}
        </div>
        {errors.purpose && <p className="text-xs text-red-400">{errors.purpose}</p>}
        <div className="flex justify-end">
          <button onClick={nextStep} className="btn-primary">
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <StepIndicator step={2} />
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Destination *</label>
            <div className="relative">
              <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="e.g. Paris, France"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              />
            </div>
            {errors.destination && <p className={errorClass}>{errors.destination}</p>}
          </div>
          <div>
            <label className={labelClass}>Departure City (Origin) *</label>
            <div className="relative">
              <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="e.g. Mumbai"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            {errors.origin && <p className={errorClass}>{errors.origin}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <div className="relative">
                <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  className={`${inputClass} pl-9`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              {errors.start_date && <p className={errorClass}>{errors.start_date}</p>}
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <div className="relative">
                <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  className={`${inputClass} pl-9`}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {errors.end_date && <p className={errorClass}>{errors.end_date}</p>}
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <button onClick={prevStep} className="btn-ghost">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={nextStep} className="btn-primary">
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <StepIndicator step={3} />
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Budget Min (₹)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
            />
            {errors.budget_min && <p className={errorClass}>{errors.budget_min}</p>}
          </div>
          <div>
            <label className={labelClass}>Budget Max (₹)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            />
            {errors.budget_max && <p className={errorClass}>{errors.budget_max}</p>}
          </div>
          <div>
            <label className={labelClass}>Number of Travelers</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                disabled={numTravelers <= 1}
                onClick={() => setNumTravelers(Math.max(1, numTravelers - 1))}
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold">{numTravelers}</span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                disabled={numTravelers >= 20}
                onClick={() => setNumTravelers(Math.min(20, numTravelers + 1))}
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Interests (tap to select, 1–10)</label>
            <div className="flex flex-wrap gap-1.5 border border-gray-700 rounded-lg bg-gray-800/30 p-3 max-h-48 overflow-y-auto">
              {INTEREST_OPTIONS.map((opt) => {
                const selected = interests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInterest(opt)}
                    disabled={!selected && interests.length >= 10}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    } disabled:opacity-30`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {interests.length}/10 selected
            </p>
            {errors.interests && <p className={errorClass}>{errors.interests}</p>}
          </div>
        </div>
        <div className="flex justify-between">
          <button onClick={prevStep} className="btn-ghost">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={nextStep} className="btn-primary">
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <StepIndicator step={4} />
        <p className="text-sm text-gray-400">
          Pick a travel style (optional — default will be used if none selected)
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PERSONAS.map((p) => {
            const selected = persona === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(selected ? null : p.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-blue-500 bg-blue-900/30 ring-1 ring-blue-500"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={20} className={selected ? "text-blue-400" : "text-gray-400"} />
                  <span className="font-semibold text-sm">{p.label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{p.desc}</p>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between">
          <button onClick={prevStep} className="btn-ghost">
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner /> Planning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={16} /> Plan My Trip
              </span>
            )}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-400">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Something went wrong"}
          </p>
        )}
      </div>
    );
  }

  return null;
}

function StepIndicator({ step }: { step: number }) {
  const labels = ["Trip Purpose", "Destination & Dates", "Budget & Interests", "Travel Style"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-blue-600 text-white"
                  : done
                    ? "bg-green-700 text-white"
                    : "bg-gray-700 text-gray-400"
              }`}
            >
              {done ? "✓" : idx}
            </div>
            <span className={active ? "text-gray-200" : "text-gray-500"}>{label}</span>
            {idx < 4 && <div className="h-px w-6 bg-gray-700" />}
          </div>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
