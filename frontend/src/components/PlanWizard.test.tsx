import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanWizard from "./PlanWizard";

vi.mock("../lib/api", () => ({
  createPlan: vi.fn(),
  TRIP_PURPOSES: [
    { id: "adventure", label: "Adventure", desc: "Outdoor thrills" },
    { id: "food", label: "Food & Culinary", desc: "Cooking classes" },
    { id: "culture", label: "Culture & History", desc: "Museums & heritage" },
    { id: "relax", label: "Relaxation", desc: "Spa & beach" },
    { id: "honeymoon", label: "Honeymoon", desc: "Romantic getaways" },
    { id: "bachelor_party", label: "Bachelor/Bachelorette", desc: "Nightlife & parties" },
  ],
  INTEREST_OPTIONS: ["history", "food", "shopping", "nature", "hiking", "beach"],
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlanWizard />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

/** Helper: select purpose and go to step 2 */
async function goToStep2() {
  await userEvent.click(screen.getByText("Adventure").closest("button")!);
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
}

/** Helper: fill step 2 fields and go to step 3 */
async function fillStep2AndGo() {
  await goToStep2();
  await userEvent.type(screen.getByPlaceholderText("e.g. Mumbai"), "Delhi");
  await userEvent.type(screen.getByPlaceholderText("e.g. Jaipur"), "Tokyo");
  const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
  fireEvent.change(dateInputs[1], { target: { value: "2026-10-05" } });
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
}

describe("PlanWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Step 1: Trip Purpose ──────────────────────────────────────────────

  it("renders step 1 (Trip Purpose) with 6 purpose cards", () => {
    renderWithProviders();
    expect(screen.getAllByText("Purpose").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Adventure")).toBeInTheDocument();
    expect(screen.getByText("Food & Culinary")).toBeInTheDocument();
    expect(screen.getByText("Culture & History")).toBeInTheDocument();
    expect(screen.getByText("Relaxation")).toBeInTheDocument();
    expect(screen.getByText("Honeymoon")).toBeInTheDocument();
    expect(screen.getByText("Bachelor/Bachelorette")).toBeInTheDocument();
  });

  it("shows step indicator with 4 steps on first step", () => {
    renderWithProviders();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("selecting a purpose toggles its highlight", async () => {
    renderWithProviders();
    const adventureBtn = screen.getByText("Adventure").closest("button")!;
    await userEvent.click(adventureBtn);
    expect(adventureBtn.className).toContain("ring-1");

    await userEvent.click(adventureBtn);
    expect(adventureBtn.className).not.toContain("ring-1");
  });

  it("purpose is mandatory — Next shows error without selection", async () => {
    renderWithProviders();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Please select a trip purpose")).toBeInTheDocument();
  });

  // ── Step 2: Destination & Dates ───────────────────────────────────────

  it("shows validation errors on step 2 when fields are empty", async () => {
    renderWithProviders();
    await goToStep2();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Destination is required")).toBeInTheDocument();
    expect(screen.getByText("Departure city is required")).toBeInTheDocument();
    expect(screen.getByText("Start date is required")).toBeInTheDocument();
    expect(screen.getByText("End date is required")).toBeInTheDocument();
  });

  it("fills destination, origin, dates then proceeds to step 3", async () => {
    renderWithProviders();
    await goToStep2();

    await userEvent.type(screen.getByPlaceholderText("e.g. Mumbai"), "Delhi");
    await userEvent.type(screen.getByPlaceholderText("e.g. Jaipur"), "Tokyo");

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-10-05" } });

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Budget (Min) ₹")).toBeInTheDocument();
  });

  it("shows Back button on step 2", async () => {
    renderWithProviders();
    await goToStep2();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  // ── Step 3: Budget & Interests ────────────────────────────────────────

  it("shows validation errors on step 3 when budget/interests missing", async () => {
    renderWithProviders();
    await fillStep2AndGo();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Valid minimum budget required")).toBeInTheDocument();
    expect(screen.getByText("Select at least one interest")).toBeInTheDocument();
  });

  it("adds and removes interest selections", async () => {
    renderWithProviders();
    await fillStep2AndGo();

    await userEvent.click(screen.getByText("food"));
    expect(screen.getByText("food")).toBeInTheDocument();

    await userEvent.click(screen.getByText("food"));
    expect(screen.queryByText("food")).toBeInTheDocument();
  });

  // ── Step 4: Travel Style (Persona) ────────────────────────────────────

  it("reaches step 4 after filling all required fields", async () => {
    renderWithProviders();

    await fillStep2AndGo();

    const budgetInputs = screen.getAllByRole("spinbutton");
    await userEvent.type(budgetInputs[0], "500");
    await userEvent.type(budgetInputs[1], "2000");
    await userEvent.click(screen.getByText("food"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Backpacker")).toBeInTheDocument();
    expect(screen.getByText("Luxury")).toBeInTheDocument();
    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
  });

  it("persona selection toggles highlight", async () => {
    renderWithProviders();
    await fillStep2AndGo();
    const bInputs = screen.getAllByRole("spinbutton");
    await userEvent.type(bInputs[0], "500");
    await userEvent.type(bInputs[1], "2000");
    await userEvent.click(screen.getByText("food"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    const backpackerBtn = screen.getByText("Backpacker").closest("button")!;
    await userEvent.click(backpackerBtn);
    expect(backpackerBtn.className).toContain("ring-1");
  });
});
