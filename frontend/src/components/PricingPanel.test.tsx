import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PricingPanel from "./PricingPanel";

// Mock the API module
vi.mock("../lib/api", () => ({
  getPlanPricing: vi.fn(),
}));

function renderWithProviders(sessionId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PricingPanel sessionId={sessionId} />
    </QueryClientProvider>,
  );
}

describe("PricingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    renderWithProviders("test-123");
    expect(screen.getByText("Loading live pricing...")).toBeInTheDocument();
  });

  it("renders nothing when no sessionId", () => {
    const { container } = renderWithProviders("");
    expect(container.firstChild).toBeNull();
  });
});
