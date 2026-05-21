import { useQuery } from "@tanstack/react-query";
import { getPlanPricing, PricingData } from "../lib/api";
import { Plane, Hotel, AlertCircle, Loader2 } from "lucide-react";

interface Props { sessionId: string }

export default function PricingPanel({ sessionId }: Props) {
  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["pricing", sessionId],
    queryFn: () => getPlanPricing(sessionId),
    enabled: !!sessionId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="card p-4 flex items-center justify-center gap-2 text-sm text-ink-mute">
        <Loader2 size={14} className="animate-spin text-accent" />
        Loading live pricing...
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <div className="card p-4 space-y-3">
      <p className="section-label text-xs">Live Pricing</p>

      {!data.available ? (
        <div className="flex items-center gap-2 rounded-lg bg-paper-3/50 px-3 py-2 text-xs text-ink-mute">
          <AlertCircle size={12} />
          Live pricing unavailable. Configure Amadeus API for real-time data.
        </div>
      ) : (
        <div className="space-y-3">
          {data.flights.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-2 flex items-center gap-1.5">
                <Plane size={12} /> Flights
              </p>
              {data.flights.map((f, i) => (
                <div key={i} className="card flex items-center justify-between px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{f.airline} {f.flight_number}</p>
                    <p className="text-ink-mute">
                      {new Date(f.departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(f.arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {f.stops > 0 ? ` · ${f.stops} stop${f.stops > 1 ? "s" : ""}` : " · Direct"}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold" style={{ color: "var(--color-status-go)" }}>₹{f.price}</span>
                </div>
              ))}
            </div>
          )}

          {data.hotels.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-2 flex items-center gap-1.5">
                <Hotel size={12} /> Hotels
              </p>
              {data.hotels.map((h, i) => (
                <div key={i} className="card flex items-center justify-between px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{h.hotel_name}</p>
                    <p className="text-ink-mute">{h.board_type || "Standard"}</p>
                  </div>
                  <span className="shrink-0 font-semibold" style={{ color: "var(--color-status-go)" }}>₹{h.price_per_night}/night</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
