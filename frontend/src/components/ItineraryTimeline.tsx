import { format, parseISO } from "date-fns";
import {
  Sun,
  CloudSun,
  Moon,
  Hotel,
  Wallet,
  Train,
  Car,
  Footprints,
  Bus,
  Plane,
  ExternalLink,
  Sparkles,
  Building2,
} from "lucide-react";
import { DraftItinerary, DayPlan, bookingUrl, googleMapsUrl, flightSearchUrl, trainSearchUrl, busSearchUrl } from "../lib/api";

function costDisplay(cost: number | undefined | null): string {
  if (cost == null) return "";
  return `₹${cost}`;
}

const TRAVEL_MODE_ICONS: Record<string, typeof Car> = {
  cab: Car,
  taxi: Car,
  metro: Train,
  bus: Bus,
  walk: Footprints,
};

function ActivityCell({
  icon,
  label,
  slot,
}: {
  icon: React.ReactNode;
  label: string;
  slot: { activity?: string; duration?: string; cost?: number; google_maps_link?: string; booking_link?: string } | undefined | null;
}) {
  if (!slot || !slot.activity) {
    return (
      <div className="rounded-lg bg-gray-800/30 p-2.5 text-gray-600">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
          {icon} {label}
        </div>
        <p className="mt-1 text-xs italic">—</p>
      </div>
    );
  }
  const gmapsHref = slot.google_maps_link || googleMapsUrl(slot.activity);
  return (
    <div className="rounded-lg bg-gray-800/50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
        {icon} {label}
      </div>
      <a href={gmapsHref} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm font-medium text-blue-400 hover:text-blue-300">
        {slot.activity} <ExternalLink size={10} className="inline" />
      </a>
      <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
        {slot.duration && <span>{slot.duration}</span>}
        {slot.cost != null && <span>{costDisplay(slot.cost)}</span>}
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  const Icon = TRAVEL_MODE_ICONS[mode.toLowerCase()] || Car;
  return <Icon size={12} />;
}

function DayCard({ day, origin, destination, totalDays }: { day: DayPlan; origin?: string; destination?: string; totalDays?: number }) {
  let dateDisplay = day.date;
  try {
    dateDisplay = format(parseISO(day.date), "EEE, MMM d");
  } catch {}

  const hasEnriched = day.budget_detail || (day.travel_costs && day.travel_costs.length > 0) || (day.extra_activities && day.extra_activities.length > 0);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 shadow-md">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-400">Day {day.day}</span>
            <span className="text-sm text-gray-400">{dateDisplay}</span>
          </div>
          <p className="text-sm font-medium text-gray-200">{day.theme}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-yellow-400">
          <Wallet size={14} />
          {costDisplay(day.daily_budget)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <ActivityCell icon={<Sun size={14} />} label="Morning" slot={day.morning} />
        <ActivityCell icon={<CloudSun size={14} />} label="Afternoon" slot={day.afternoon} />
        <ActivityCell icon={<Moon size={14} />} label="Evening" slot={day.evening} />
      </div>

      {hasEnriched && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {day.day === 1 && origin && destination && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Book Your Travel to {destination}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={flightSearchUrl(origin, destination, day.date)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-blue-600/20 border border-blue-700/40 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
                >
                  <Plane size={12} /> Flights <ExternalLink size={9} />
                </a>
                <a
                  href={trainSearchUrl(origin, destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-green-600/20 border border-green-700/40 px-2.5 py-1.5 text-xs font-medium text-green-300 hover:bg-green-600/30"
                >
                  <Train size={12} /> Trains <ExternalLink size={9} />
                </a>
                <a
                  href={busSearchUrl(origin, destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-orange-600/20 border border-orange-700/40 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-600/30"
                >
                  <Bus size={12} /> Buses <ExternalLink size={9} />
                </a>
              </div>
            </div>
          )}
          {day.travel_costs && day.travel_costs.length > 0 && (day.day !== 1 || !origin) && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Local Travel</p>
              <div className="space-y-1">
                {day.travel_costs.map((tc, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-800/40 px-2.5 py-1.5 text-xs text-gray-300">
                    <ModeIcon mode={tc.mode} />
                    <span className="text-gray-500">{tc.from}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-500">{tc.to}</span>
                    <span className="ml-auto font-medium text-green-400">{costDisplay(tc.cost_inr)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day.extra_activities && day.extra_activities.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Extra Activities Nearby</p>
              <div className="flex flex-wrap gap-1.5">
                {day.extra_activities.map((act, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-blue-900/30 px-2.5 py-1 text-xs text-blue-300">
                    <Sparkles size={10} />
                    {act}
                  </span>
                ))}
              </div>
            </div>
          )}

          {day.budget_detail && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Budget Breakdown</p>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(day.budget_detail).map(([key, val]) => (
                  <div key={key} className="rounded bg-gray-800/40 px-2 py-1.5 text-center">
                    <p className="text-[10px] capitalize text-gray-500">{key}</p>
                    <p className="text-xs font-medium text-yellow-400">{costDisplay(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {day.day === totalDays && origin && destination && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Return Travel to {origin}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={flightSearchUrl(destination, origin, day.date)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-blue-600/20 border border-blue-700/40 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
                >
                  <Plane size={12} /> Flights <ExternalLink size={9} />
                </a>
                <a
                  href={trainSearchUrl(destination, origin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-green-600/20 border border-green-700/40 px-2.5 py-1.5 text-xs font-medium text-green-300 hover:bg-green-600/30"
                >
                  <Train size={12} /> Trains <ExternalLink size={9} />
                </a>
                <a
                  href={busSearchUrl(destination, origin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-orange-600/20 border border-orange-700/40 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-600/30"
                >
                  <Bus size={12} /> Buses <ExternalLink size={9} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {(day.accommodation?.name || day.accommodation?.cost_per_night != null) && (
        <div className="flex items-center gap-2 border-t border-gray-800 px-4 py-2.5 text-xs text-gray-400">
          <Hotel size={14} />
          <span>
            <a
              href={day.accommodation.google_maps_link || googleMapsUrl(day.accommodation.name || "")}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400"
            >
              <strong className="text-gray-300">{day.accommodation.name || "—"}</strong>
            </a>
            {day.accommodation.cost_per_night != null &&
              ` · ${costDisplay(day.accommodation.cost_per_night)}/night`}
            <a
              href={bookingUrl(destination || "", {
                city: destination,
                checkin: day.date,
                priceMin: day.accommodation.cost_per_night,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300"
            >
              Book <ExternalLink size={10} />
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
        <p className="text-sm italic text-gray-400">{itinerary.trip_summary}</p>
      )}
      {destination && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Book Your Trip</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={bookingUrl(destination, { city: destination })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-blue-600/20 border border-blue-700/40 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
            >
              <Building2 size={12} /> Hotels in {destination} <ExternalLink size={9} />
            </a>
            <a
              href={flightSearchUrl(origin || destination, destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-indigo-600/20 border border-indigo-700/40 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30"
            >
              <Plane size={12} /> Flights{origin ? ` from ${origin}` : ""} <ExternalLink size={9} />
            </a>
            <a
              href={trainSearchUrl(origin || destination, destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-green-600/20 border border-green-700/40 px-2.5 py-1.5 text-xs font-medium text-green-300 hover:bg-green-600/30"
            >
              <Train size={12} /> Trains{origin ? ` from ${origin}` : ""} <ExternalLink size={9} />
            </a>
            <a
              href={busSearchUrl(origin || destination, destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-orange-600/20 border border-orange-700/40 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-600/30"
            >
              <Bus size={12} /> Buses{origin ? ` from ${origin}` : ""} <ExternalLink size={9} />
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
        <div className="rounded-xl border border-yellow-800/40 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-200">
          {itinerary.important_notes}
        </div>
      )}
    </div>
  );
}
