import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getFinalPlan, getExportUrl, FinalPlan, flightSearchUrl, trainSearchUrl, busSearchUrl, skyScannerUrl } from "../lib/api";
import ItineraryTimeline from "../components/ItineraryTimeline";
import MapView from "../components/MapView";
import PricingPanel from "../components/PricingPanel";
import { FileDown, Calendar, ArrowLeft, Plane, Train, Bus, ExternalLink, Search, Compass } from "lucide-react";

type BookingTab = "skyscanner" | "google" | "train" | "bus";

export default function FinalPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<BookingTab>("skyscanner");

  const { data, isLoading, error } = useQuery<FinalPlan>({
    queryKey: ["final", id],
    queryFn: () => getFinalPlan(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="flex items-center justify-center gap-2 text-ink-mute">
          <Compass size={18} className="animate-spin text-accent" />
          Loading finalized plan...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg" style={{ color: "var(--color-status-stop)" }}>
          {error instanceof Error ? error.message : "Final plan not found"}
        </p>
      </div>
    );
  }

  const fp = data.final_plan;
  const dest = fp.destination;
  const origin = fp.travel_request?.origin || "";
  const itinerary = fp.itinerary;
  const startDate = fp.travel_request?.start_date;
  const endDate = fp.travel_request?.end_date;
  const travelers = fp.travel_request?.num_travelers;

  const TAB_ICONS: Record<BookingTab, typeof Plane> = {
    skyscanner: Search,
    google: Plane,
    train: Train,
    bus: Bus,
  };

  const TAB_LABELS: Record<BookingTab, string> = {
    skyscanner: "SkyScanner",
    google: "Google Flights",
    train: "IRCTC Trains",
    bus: "RedBus",
  };

  return (
    <div className="min-h-screen">
      <header className="shell py-4 border-b border-rule">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/plan/${id}/review`} className="btn-ghost text-xs">
              <ArrowLeft size={14} /> Back
            </Link>
            <a href="/plan" className="font-display text-xl font-bold tracking-tight text-ink hover:no-underline">
              <span className="text-accent">✱ </span>Wayfinder
            </a>
          </div>
          <div className="flex items-center gap-2 rounded px-3 py-1 font-mono text-xs text-ink-mute border border-rule">
            <Compass size={12} className="text-accent" />
            {fp.revision_count} revision{fp.revision_count !== 1 ? "s" : ""}
          </div>
        </div>
      </header>

      <div className="shell py-6">
        {/* Destination header */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-label text-xs mb-2">Your Journey</p>
              <h1 className="font-display text-4xl italic text-ink">
                {dest}
              </h1>
              {itinerary?.trip_summary && (
                <p className="mt-2 max-w-xl text-sm text-ink-2 leading-relaxed">
                  {itinerary.trip_summary}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={getExportUrl(id!, "pdf")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-xs"
              >
                <FileDown size={14} />
                PDF
              </a>
              <a
                href={getExportUrl(id!, "ical")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono uppercase tracking-[0.1em] border border-rule text-ink-2 hover:text-ink transition-colors"
              >
                <Calendar size={14} />
                iCal
              </a>
            </div>
          </div>

          {/* Origin info */}
          {origin && (
            <div className="mt-4 pt-4 border-t border-rule">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-mute mb-3">
                <span className="text-accent">✦</span> Departing from {origin}
                {startDate && ` · ${new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                {endDate && ` — ${new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              </p>

              {/* Booking tabs */}
              <div className="flex gap-1 border-b border-rule pb-0.5">
                {(Object.keys(TAB_LABELS) as BookingTab[]).map((tab) => {
                  const Icon = TAB_ICONS[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-[0.1em] transition-all rounded-t ${
                        activeTab === tab
                          ? "bg-accent/10 text-accent border-b-2 border-accent"
                          : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      <Icon size={13} />
                      {TAB_LABELS[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="mt-3 p-3 rounded-lg bg-paper-3/50 border border-rule">
                {activeTab === "skyscanner" && (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-2">Compare flights across all airlines on SkyScanner</p>
                    <a
                      href={skyScannerUrl(origin, dest, startDate, endDate, travelers)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                      style={{
                        background: "var(--color-accent)",
                        color: "var(--color-paper)",
                      }}
                    >
                      <Search size={14} /> Search on SkyScanner <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                {activeTab === "google" && (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-2">Search flights on Google Flights</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={flightSearchUrl(origin, dest, startDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                        style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}
                      >
                        <Plane size={14} /> {origin} → {dest} <ExternalLink size={12} />
                      </a>
                      {startDate && endDate && (
                        <a
                          href={flightSearchUrl(dest, origin, endDate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                          style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}
                        >
                          <Plane size={14} /> {dest} → {origin} (Return) <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "train" && (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-2">Book trains on IRCTC</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={trainSearchUrl(origin, dest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                        style={{ background: "oklch(45% 0.15 145 / 0.2)", color: "oklch(65% 0.18 145)", border: "1px solid oklch(45% 0.15 145 / 0.3)" }}
                      >
                        <Train size={14} /> {origin} → {dest} <ExternalLink size={12} />
                      </a>
                      <a
                        href={trainSearchUrl(dest, origin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                        style={{ background: "oklch(45% 0.15 145 / 0.2)", color: "oklch(65% 0.18 145)", border: "1px solid oklch(45% 0.15 145 / 0.3)" }}
                      >
                        <Train size={14} /> {dest} → {origin} <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
                {activeTab === "bus" && (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-2">Book buses on RedBus</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={busSearchUrl(origin, dest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                        style={{ background: "oklch(45% 0.15 60 / 0.2)", color: "oklch(65% 0.18 60)", border: "1px solid oklch(45% 0.15 60 / 0.3)" }}
                      >
                        <Bus size={14} /> {origin} → {dest} <ExternalLink size={12} />
                      </a>
                      <a
                        href={busSearchUrl(dest, origin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold font-mono uppercase tracking-[0.1em] transition-all"
                        style={{ background: "oklch(45% 0.15 60 / 0.2)", color: "oklch(65% 0.18 60)", border: "1px solid oklch(45% 0.15 60 / 0.3)" }}
                      >
                        <Bus size={14} /> {dest} → {origin} <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-6">
          <PricingPanel sessionId={id!} />
        </div>

        {/* Map */}
        {itinerary && (
          <>
            <div className="mt-6 h-72 overflow-hidden rounded-lg border border-rule">
              <MapView itinerary={itinerary} className="h-full" origin={origin} />
            </div>

            {/* Timeline */}
            <div className="mt-6">
              <p className="section-label text-xs mb-4">Itinerary</p>
              <ItineraryTimeline itinerary={itinerary} origin={origin} destination={dest} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
