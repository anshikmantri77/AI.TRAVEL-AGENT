import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getFinalPlan, getExportUrl, FinalPlan, flightSearchUrl, trainSearchUrl, busSearchUrl } from "../lib/api";
import ItineraryTimeline from "../components/ItineraryTimeline";
import MapView from "../components/MapView";
import PricingPanel from "../components/PricingPanel";
import { FileDown, Calendar, MapPin, RefreshCw, Plane, Train, Bus, ExternalLink } from "lucide-react";

export default function FinalPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery<FinalPlan>({
    queryKey: ["final", id],
    queryFn: () => getFinalPlan(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500">
        Loading finalized plan...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg text-red-400">
          {error instanceof Error ? error.message : "Final plan not found"}
        </p>
      </div>
    );
  }

  const fp = data.final_plan;
  const dest = fp.destination;
  const origin = fp.travel_request?.origin || "";
  const itinerary = fp.itinerary;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-xl font-bold text-blue-400">
          <Plane size={24} />
          TripMind
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-2xl font-bold text-gray-100">
              <MapPin size={22} className="text-blue-400" />
              {dest}
            </div>
            {itinerary?.trip_summary && (
              <p className="mt-1 max-w-lg text-sm text-gray-400">
                {itinerary.trip_summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
            <RefreshCw size={12} />
            {fp.revision_count} revision{fp.revision_count !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={getExportUrl(id!, "pdf")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            <FileDown size={16} />
            Download PDF
          </a>
          <a
            href={getExportUrl(id!, "ical")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-800"
          >
            <Calendar size={16} />
            Add to Calendar
          </a>
        </div>

        {origin && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-700 pt-4">
            <p className="w-full text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Book Your Travel
            </p>
            <a
              href={flightSearchUrl(origin, dest)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-700/40 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
            >
              <Plane size={13} /> Search Flights <ExternalLink size={10} />
            </a>
            <a
              href={trainSearchUrl(origin, dest)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-green-600/20 border border-green-700/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-600/30"
            >
              <Train size={13} /> Search Trains <ExternalLink size={10} />
            </a>
            <a
              href={busSearchUrl(origin, dest)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-orange-600/20 border border-orange-700/40 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-600/30"
            >
              <Bus size={13} /> Search Buses <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

      <div className="mb-6">
        <PricingPanel sessionId={id!} />
      </div>

      {itinerary && (
        <>
          <div className="mb-6 h-72 overflow-hidden rounded-xl border border-gray-700">
            <MapView itinerary={itinerary} className="h-full" origin={origin} />
          </div>
          <ItineraryTimeline itinerary={itinerary} origin={origin} destination={dest} />
        </>
      )}
    </div>
  );
}
