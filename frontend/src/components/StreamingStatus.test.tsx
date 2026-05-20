import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StreamingStatus from "./StreamingStatus";

// Mock the API module
vi.mock("../lib/api", () => ({
  subscribeToStream: vi.fn(() => vi.fn()),
}));

describe("StreamingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 5 progress steps", () => {
    render(<StreamingStatus sessionId="test-123" />);
    expect(screen.getByText("Validating request")).toBeInTheDocument();
    expect(screen.getByText("Researching destination")).toBeInTheDocument();
    expect(screen.getByText("Building itinerary")).toBeInTheDocument();
    expect(screen.getByText("Awaiting your review")).toBeInTheDocument();
    expect(screen.getByText("Finalizing plan")).toBeInTheDocument();
  });

  it("shows Progress heading", () => {
    render(<StreamingStatus sessionId="test-123" />);
    expect(screen.getByText("Progress")).toBeInTheDocument();
  });
});
