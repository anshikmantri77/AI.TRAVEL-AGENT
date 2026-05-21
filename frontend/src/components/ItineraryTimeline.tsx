import { format, parseISO } from "date-fns";
import {
  Sun, CloudSun, Moon, Hotel, Wallet, Train, Car, Footprints, Bus, Plane, ExternalLink, Sparkles
} from "lucide-react";
import { DraftItinerary, DayPlan, bookingUrl, googleMapsUrl, flightSearchUrl, trainSearchUrl, busSearchUrl } from "../lib/api";

const MODE_ICONS: Record<string, typeof Car> = { cab: Car, taxi: Car, metro: Train, bus: Bus, walk: Footprints };

function costDisplay(cost: number | undefined | null): string {
  if (cost == null) return "";
  return `₹${cost}`;
}

function ModeIcon({ mode }: { mode: string }) {
  const Icon = MODE_ICONS[mode.toLowerCase()] || Car;
  return <Icon size={11} />;
}

function ActivityCell({
  icon, label, slot,
}: {
  icon: React.ReactNode;
  label: string;
  slot: { activity?: string; duration?: string; cost?: number; google_maps_link?: string; booking_link?: string } | undefined | null;
}) {
  if (!slot || !slot.activity) {
    return (
      <div className="rounded-lg bg-paper-3/30 p-2.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-mute">
          {icon} {label}
        </div>
        <p className="mt-1 text-xs italic text-ink-mute">—</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-paper-3/50 p-2.5 transition-colors hover:bg-paper-3/70">
      <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-2">
        {icon} {label}
      </div>
      <a
        href={slot.google_maps_link || googleMapsUrl(slot.activity)}
        target="_blank" rel="noopener noreferrer"
        className="mt-1 block text-sm font-medium text-accent hover:text-accent-2"
      >
        {slot.activity} <ExternalLink size={10} className="inline" />
      </a>
      <div className="mt-0.5 flex gap-3 font-mono text-[11px] text-ink-mute">
        {slot.duration && <span>{slot.duration}</span>}
        {slot.cost != null && <span>{costDisplay(slot.cost)}</span>}
      </div>
    </div>
  );
}

function DayCard({ day, origin, destination, totalDays }: { day: DayPlan; origin?: string; destination?: string; totalDays?: number }) {
  let dateDisplay = day.date;
  try { dateDisplay = format(parseISO(day.date), "EEE, MMM d"); } catch {}

  const hasEnriched = day.budget_detail || (day.travel_costs?.length ?? 0) > 0 || (day.extra_activities?.length ?? 0) > 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg italic text-accent">Day {day.day}</span>
            <span className="font-mono text-xs text-ink-mute">{dateDisplay}</span>
          </div>
          <p className="text-sm text-ink-2 mt-0.5">{day.theme}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1 font-mono text-xs font-semibold text-accent">
          <Wallet size={13} />
          {costDisplay(day.daily_budget)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        <ActivityCell icon={<Sun size={13} />} label="Morning" slot={day.morning} />
        <ActivityCell icon={<CloudSun size={13} />} label="Afternoon" slot={day.afternoon} />
        <ActivityCell icon={<Moon size={13} />} label="Evening" slot={day.evening} />
      </div>

      {hasEnriched && (
        <div className="border-t border-rule px-4 py-3 space-y-3">
          {day.day === 1 && origin && destination && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                Book Your Travel to {destination}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <a href={flightSearchUrl(origin, destination, day.date)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}>
                  <Plane size={11} /> Flights <ExternalLink size={8} />
                </a>
                <a href={trainSearchUrl(origin, destination)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 145 / 0.2)", color: "oklch(65% 0.18 145)", border: "1px solid oklch(45% 0.15 145 / 0.3)" }}>
                  <Train size={11} /> Trains <ExternalLink size={8} />
                </a>
                <a href={busSearchUrl(origin, destination)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 60 / 0.2)", color: "oklch(65% 0.18 60)", border: "1px solid oklch(45% 0.15 60 / 0.3)" }}>
                  <Bus size={11} /> Buses <ExternalLink size={8} />
                </a>
              </div>
            </div>
          )}

          {day.travel_costs && day.travel_costs.length > 0 && (day.day !== 1 || !origin) && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">Local Travel</p>
              <div className="space-y-0.5">
                {day.travel_costs.map((tc, i) => (
                  <div key={i} className="flex items-center gap-2 rounded bg-paper-3/40 px-2.5 py-1.5 text-xs text-ink-2">
                    <ModeIcon mode={tc.mode} />
                    <span className="text-ink-mute">{tc.from}</span>
                    <span className="text-ink-mute/50">→</span>
                    <span className="text-ink-mute">{tc.to}</span>
                    <span className="ml-auto font-medium" style={{ color: "var(--color-status-go)" }}>{costDisplay(tc.cost_inr)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day.extra_activities && day.extra_activities.length > 0 && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">Extra Activities Nearby</p>
              <div className="flex flex-wrap gap-1">
                {day.extra_activities.map((act, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-2 border border-rule">
                    <Sparkles size={10} className="text-accent" />
                    {act}
                  </span>
                ))}
              </div>
            </div>
          )}

          {day.budget_detail && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">Budget Breakdown</p>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(day.budget_detail).map(([key, val]) => (
                  <div key={key} className="rounded bg-paper-3/40 px-2 py-1.5 text-center">
                    <p className="font-mono text-[9px] uppercase text-ink-mute">{key}</p>
                    <p className="text-xs font-medium text-accent">{costDisplay(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day.day === totalDays && origin && destination && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">
                Return Travel to {origin}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <a href={flightSearchUrl(destination, origin, day.date)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}>
                  <Plane size={11} /> Flights <ExternalLink size={8} />
                </a>
                <a href={trainSearchUrl(destination, origin)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 145 / 0.2)", color: "oklch(65% 0.18 145)", border: "1px solid oklch(45% 0.15 145 / 0.3)" }}>
                  <Train size={11} /> Trains <ExternalLink size={8} />
                </a>
                <a href={busSearchUrl(destination, origin)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
                  style={{ background: "oklch(45% 0.15 60 / 0.2)", color: "oklch(65% 0.18 60)", border: "1px solid oklch(45% 0.15 60 / 0.3)" }}>
                  <Bus size={11} /> Buses <ExternalLink size={8} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {(day.accommodation?.name || day.accommodation?.cost_per_night != null) && (
        <div className="flex items-center gap-2 border-t border-rule px-4 py-2.5 text-xs text-ink-2">
          <Hotel size={13} className="text-ink-mute" />
          <span>
            <a
              href={day.accommodation.google_maps_link || googleMapsUrl(day.accommodation.name || "")}
              target="_blank" rel="noopener noreferrer"
              className="hover:text-accent"
            >
              <strong className="text-ink">{day.accommodation.name || "—"}</strong>
            </a>
            {day.accommodation.cost_per_night != null && (
              <span className="text-ink-mute"> · {costDisplay(day.accommodation.cost_per_night)}/night</span>
            )}
            <a
              href={bookingUrl(destination || "", {
                city: destination, checkin: day.date, priceMin: day.accommodation.cost_per_night,
              })}
              target="_blank" rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-accent hover:text-accent-2"
            >
              Book <ExternalLink size={9} />
            </a>
          </span>
        </div>
      )}
    </div>
  );
}

interface Props {
  itinerary: DraftItinerary;
  compact?: boolean;
  origin?: string;
  destination?: string;
}

export default function ItineraryTimeline({ itinerary, compact, origin, destination }: Props) {
  const days: DayPlan[] = itinerary?.days ?? [];
  const totalDays = days.length;

  return (
    <div className={`space-y-4 ${compact ? "max-h-[70vh] overflow-y-auto pr-1" : ""}`}>
      {itinerary?.trip_summary && (
        <p className="text-sm italic text-ink-2 leading-relaxed">{itinerary.trip_summary}</p>
      )}
      {destination && (
        <div className="card p-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute mb-2">
            <span className="text-accent">✦</span> Book Your Trip
          </p>
          <div className="flex flex-wrap gap-1.5">
            <a
              href={bookingUrl(destination, { city: destination })}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
              style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}
            >
              <Hotel size={11} /> Hotels in {destination} <ExternalLink size={8} />
            </a>
            <a
              href={flightSearchUrl(origin || destination, destination)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
              style={{ background: "oklch(45% 0.15 230 / 0.2)", color: "oklch(70% 0.18 230)", border: "1px solid oklch(45% 0.15 230 / 0.3)" }}
            >
              <Plane size={11} /> Flights{origin ? ` from ${origin}` : ""} <ExternalLink size={8} />
            </a>
            <a
              href={trainSearchUrl(origin || destination, destination)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
              style={{ background: "oklch(45% 0.15 145 / 0.2)", color: "oklch(65% 0.18 145)", border: "1px solid oklch(45% 0.15 145 / 0.3)" }}
            >
              <Train size={11} /> Trains{origin ? ` from ${origin}` : ""} <ExternalLink size={8} />
            </a>
            <a
              href={busSearchUrl(origin || destination, destination)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium font-mono uppercase tracking-[0.08em] transition-all"
              style={{ background: "oklch(45% 0.15 60 / 0.2)", color: "oklch(65% 0.18 60)", border: "1px solid oklch(45% 0.15 60 / 0.3)" }}
            >
              <Bus size={11} /> Buses{origin ? ` from ${origin}` : ""} <ExternalLink size={8} />
            </a>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {days.map((day) => (
          <DayCard key={day.day} day={day} origin={origin} destination={destination} totalDays={totalDays} />
        ))}
      </div>
      {itinerary?.important_notes && (
        <div className="card p-4 text-sm border-l-2" style={{ borderLeftColor: "var(--color-accent)" }}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute mb-1">Notes</p>
          <p className="text-ink-2 leading-relaxed">{itinerary.important_notes}</p>
        </div>
      )}
    </div>
  );
}
