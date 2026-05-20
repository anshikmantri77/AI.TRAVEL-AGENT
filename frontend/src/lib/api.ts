const BASE_URL = "/api";

export interface TravelRequest {
  destination: string;
  origin?: string;
  start_date: string;
  end_date: string;
  budget_min: number;
  budget_max: number;
  interests: string[];
  num_travelers: number;
  agent_persona?: string | null;
  trip_purpose?: string | null;
  destinations?: string[];
}

export interface PlanCreated {
  session_id: string;
  status: string;
  draft_itinerary?: DraftItinerary | null;
  message?: string | null;
}

export interface PlanStatus {
  session_id: string;
  status: string;
  workflow_stage: string;
  hitl_status?: string | null;
  draft_itinerary?: DraftItinerary | null;
  error?: string | null;
  revision_count: number;
}

export interface ReviewBody {
  action: "approve" | "reject" | "modify";
  feedback?: string | null;
  modifications?: Record<string, unknown> | null;
}

export interface ReviewResponse {
  session_id: string;
  status: string;
  workflow_stage: string;
  hitl_status?: string | null;
  draft_itinerary?: DraftItinerary | null;
  final_plan?: FinalPlan | null;
  message?: string | null;
}

export interface ActivitySlot {
  activity: string;
  duration: string;
  cost: number;
  lat?: number;
  lng?: number;
  google_maps_link?: string;
  booking_link?: string;
}

export interface Accommodation {
  name: string;
  type?: string;
  cost_per_night: number;
  lat?: number;
  lng?: number;
  booking_link?: string;
  google_maps_link?: string;
}

export interface TravelCost {
  from: string;
  to: string;
  mode: "cab" | "metro" | "bus" | "walk";
  cost_inr: number;
}

export interface BudgetDetail {
  accommodation: number;
  food: number;
  transport: number;
  activities: number;
  misc: number;
}

export interface DayPlan {
  day: number;
  date: string;
  theme: string;
  morning: ActivitySlot;
  afternoon: ActivitySlot;
  evening: ActivitySlot;
  extra_activities?: string[];
  travel_costs?: TravelCost[];
  budget_detail?: BudgetDetail;
  accommodation: Accommodation;
  daily_budget: number;
}

export interface DraftItinerary {
  trip_summary?: string;
  duration_days?: number;
  total_budget_used?: number;
  days: DayPlan[];
  packing_suggestions?: string[];
  important_notes?: string;
}

export interface FinalPlan {
  session_id: string;
  status: string;
  final_plan: {
    destination: string;
    travel_request?: TravelRequest;
    research_summary?: Record<string, unknown>;
    itinerary: DraftItinerary;
    revision_count: number;
  };
}

export interface StreamEvent {
  event: string;
  data: {
    stage: string;
    session_id: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return body as T;
}

export function createPlan(body: TravelRequest): Promise<PlanCreated> {
  return request<PlanCreated>("/plan", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPlanStatus(id: string): Promise<PlanStatus> {
  return request<PlanStatus>(`/plan/${id}`);
}

export function submitReview(
  id: string,
  review: ReviewBody,
): Promise<ReviewResponse> {
  return request<ReviewResponse>(`/plan/${id}/review`, {
    method: "POST",
    body: JSON.stringify(review),
  });
}

export function getFinalPlan(id: string): Promise<FinalPlan> {
  return request<FinalPlan>(`/plan/${id}/final`);
}

export function getExportUrl(id: string, format: "pdf" | "ical"): string {
  return `${BASE_URL}/plan/${id}/export?format=${format}`;
}

export function subscribeToStream(
  id: string,
  onEvent: (e: StreamEvent) => void,
): () => void {
  const source = new EventSource(`${BASE_URL}/plan/${id}/stream`);

  const handler = (eventType: string) => (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as StreamEvent["data"];
      onEvent({ event: eventType, data });
    } catch {
      /* ignore parse errors */
    }
  };

  source.addEventListener("research_complete", handler("research_complete"));
  source.addEventListener("awaiting_review", handler("awaiting_review"));
  source.addEventListener("done", handler("done"));
  source.addEventListener("error", handler("error"));
  source.onerror = () => source.close();

  return () => source.close();
}

export const TRIP_PURPOSES = [
  { id: "adventure", label: "Adventure", desc: "Hiking, climbing, water sports, outdoor thrills" },
  { id: "food", label: "Food & Culinary", desc: "Cooking classes, food tours, local cuisine" },
  { id: "culture", label: "Culture & History", desc: "Museums, heritage sites, local traditions" },
  { id: "relax", label: "Relaxation", desc: "Spa, beach, wellness, slow pace" },
  { id: "honeymoon", label: "Honeymoon", desc: "Romantic getaways, couple's experiences" },
  { id: "bachelor_party", label: "Bachelor/Bachelorette", desc: "Nightlife, group activities, parties" },
] as const;

export const INTEREST_OPTIONS = [
  "history", "museums", "food", "shopping", "nature", "hiking", "beach",
  "photography", "architecture", "nightlife", "adventure", "culture",
  "art", "music", "wildlife", "trekking", "temples", "local cuisine",
  "street food", "wine", "sports", "wellness", "spa", "yoga",
  "festivals", "local markets", "scenic views", "boat rides", "snorkeling",
  "diving", "camping", "road trip", "train journey", "bird watching",
];

export function bookingUrl(
  _name: string,
  opts?: { city?: string; checkin?: string; checkout?: string; adults?: number; priceMin?: number }
): string {
  const city = opts?.city || "";
  const q = encodeURIComponent(city || _name);
  let url = `https://www.booking.com/searchresults.en-gb.html?ss=${q}&ssne=${q}&lang=en-gb&src=searchresults`;
  if (opts?.checkin) url += `&checkin=${opts.checkin}`;
  if (opts?.checkout) url += `&checkout=${opts.checkout}`;
  if (opts?.adults && opts.adults > 0) url += `&group_adults=${opts.adults}&no_rooms=${Math.ceil(opts.adults / 2)}`;
  if (opts?.priceMin && opts.priceMin > 0) url += `&nflt=price%3DINR-min-${opts.priceMin}-1`;
  return url;
}

export function googleMapsUrl(name: string, city?: string): string {
  const q = encodeURIComponent(`${name} ${city || ""}`);
  return `https://maps.google.com/?q=${q}`;
}

export function flightSearchUrl(origin: string, dest: string, date?: string): string {
  const from = encodeURIComponent(origin);
  const to = encodeURIComponent(dest);
  let url = `https://www.google.com/travel/flights?q=Flights+to+${to}+from+${from}`;
  if (date) url += `+on+${date}`;
  return url;
}

export function trainSearchUrl(origin: string, dest: string): string {
  const from = encodeURIComponent(origin);
  const to = encodeURIComponent(dest);
  return `https://www.irctc.co.in/nget/train-search?from=${from}&to=${to}`;
}

export function busSearchUrl(origin: string, dest: string): string {
  const from = encodeURIComponent(origin);
  const to = encodeURIComponent(dest);
  return `https://www.redbus.in/search?fromCity=${from}&toCity=${to}`;
}

export interface PricingData {
  flights: Array<{
    airline: string;
    flight_number: string;
    departure: string;
    arrival: string;
    duration: string;
    price: number;
    currency: string;
    stops: number;
  }>;
  hotels: Array<{
    hotel_name: string;
    hotel_id: string;
    latitude?: number;
    longitude?: number;
    price_per_night: number;
    currency: string;
    board_type: string;
  }>;
  available: boolean;
}

export function getPlanPricing(id: string): Promise<PricingData> {
  return request<PricingData>(`/plan/${id}/pricing`);
}
