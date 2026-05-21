import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple } from "leaflet";
import { DayPlan, DraftItinerary } from "../lib/api";

const DAY_COLORS = ["var(--color-accent)", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function createIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid oklch(8% 0.02 260);box-shadow:0 0 10px ${color}40"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    className: "",
  });
}

function createAccommodationIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#a855f7;width:18px;height:18px;border-radius:3px;border:2px solid oklch(8% 0.02 260);box-shadow:0 0 10px #a855f740;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:bold">H</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: "",
  });
}

function createOriginIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:oklch(65% 0.18 145);width:20px;height:20px;border-radius:50%;border:3px solid oklch(8% 0.02 260);box-shadow:0 0 12px oklch(65% 0.18 145 / 0.5);display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;font-weight:bold">O</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: "",
  });
}

interface ActivityPoint { lat: number; lng: number; label: string; day: number; slot: string }

interface Props { itinerary: DraftItinerary; origin?: string; className?: string }

const INDIA_CITIES: Record<string, [number, number]> = {
  mumbai: [19.076, 72.8777],
  delhi: [28.7041, 77.1025],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  goa: [15.4909, 73.8278],
  agra: [27.1767, 78.0081],
  varanasi: [25.3176, 82.9739],
  udaipur: [24.5854, 73.7125],
  kochi: [9.9312, 76.2673],
  amritsar: [31.634, 74.8723],
  paris: [48.8566, 2.3522],
  london: [51.5074, -0.1278],
  dubai: [25.2048, 55.2708],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  newyork: [40.7128, -74.006],
};

export default function MapView({ itinerary, origin, className }: Props) {
  const days: DayPlan[] = itinerary?.days ?? [];

  const { points, center, originCoords } = useMemo(() => {
    const pts: ActivityPoint[] = [];
    let sumLat = 0; let sumLng = 0; let count = 0;

    for (const day of days) {
      for (const slot of ["morning", "afternoon", "evening"] as const) {
        const s = day[slot];
        if (s && typeof s.lat === "number" && typeof s.lng === "number") {
          pts.push({ lat: s.lat, lng: s.lng, label: s.activity || "", day: day.day, slot });
          sumLat += s.lat; sumLng += s.lng; count++;
        }
      }
      if (day.accommodation?.lat != null && day.accommodation?.lng != null) {
        pts.push({ lat: day.accommodation.lat, lng: day.accommodation.lng, label: day.accommodation.name || "Accommodation", day: day.day, slot: "stay" });
        sumLat += day.accommodation.lat; sumLng += day.accommodation.lng; count++;
      }
    }

    let oc: [number, number] | null = null;
    if (origin) {
      const key = origin.toLowerCase().trim().replace(/[^a-z]/g, "");
      const found = INDIA_CITIES[key];
      if (found) oc = found;
    }

    const c: [number, number] = oc || (count > 0 ? [sumLat / count, sumLng / count] : [48.8566, 2.3522]);
    return { points: pts, center: c, originCoords: oc };
  }, [days, origin]);

  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const routePoints: LatLngTuple[] = useMemo(() => {
    const raw = points.filter((p) => p.lat !== 0 && p.lng !== 0).map((p) => [p.lat, p.lng] as LatLngTuple);
    const deduped: LatLngTuple[] = [];
    const threshold = 0.02;
    for (const pt of raw) {
      const isDuplicate = deduped.some(
        (d) => Math.abs(d[0] - pt[0]) < threshold && Math.abs(d[1] - pt[1]) < threshold,
      );
      if (!isDuplicate) deduped.push(pt);
    }
    return originCoords && deduped.length > 0 ? [originCoords, ...deduped] : deduped;
  }, [points, originCoords]);

  return (
    <div className={`overflow-hidden rounded-lg border border-rule ${className || ""}`}>
      <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {routePoints.length > 1 && (
          <Polyline positions={routePoints} color="#60a5fa" opacity={0.4} weight={2.5} />
        )}
        {originCoords && (
          <Marker position={originCoords} icon={createOriginIcon()}>
            <Popup>
              <div className="text-sm font-body">
                <p className="font-semibold">{origin}</p>
                <p className="text-xs text-gray-500">Departure City</p>
              </div>
            </Popup>
          </Marker>
        )}
        {points.map((p, i) => {
          const isAccommodation = p.slot === "stay";
          return (
            <Marker
              key={i}
              position={[p.lat, p.lng]}
              icon={isAccommodation ? createAccommodationIcon() : createIcon(DAY_COLORS[(p.day - 1) % DAY_COLORS.length])}
            >
              <Popup>
                <div className="text-sm font-body">
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-gray-500">{isAccommodation ? "Hotel" : `Day ${p.day} · ${p.slot}`}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
