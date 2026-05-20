import { useQuery } from "@tanstack/react-query";
import { getPlanPricing, PricingData } from "../lib/api";
import { Plane, Hotel, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  sessionId: string;
}

export default function PricingPanel({ sessionId }: Props) {
  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["pricing", sessionId],
    queryFn: () => getPlanPricing(sessionId),
    enabled: !!sessionId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        Loading live pricing...
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-700 bg-gray-900 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Live Pricing
      </h3>

      {!data.available ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-500">
          <AlertCircle size={12} />
          Live pricing unavailable. Configure Amadeus API for real-time data.
        </div>
      ) : (
        <div className="space-y-3">
          {data.flights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Plane size={12} /> Flights
              </div>
              {data.flights.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-200">
                      {f.airline} {f.flight_number}
                    </p>
                    <p className="text-gray-500">
                      {new Date(f.departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(f.arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {f.stops > 0 ? ` · ${f.stops} stop${f.stops > 1 ? "s" : ""}` : " · Direct"}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-green-400">
                    ₹{f.price}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.hotels.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Hotel size={12} /> Hotels
              </div>
              {data.hotels.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-200">{h.hotel_name}</p>
                    <p className="text-gray-500">{h.board_type || "Standard"}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-green-400">
                    ₹{h.price_per_night}/night
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
