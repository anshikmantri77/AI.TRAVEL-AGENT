import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import HITLReviewPanel from "./HITLReviewPanel";

// Mock the API module
vi.mock("../lib/api", () => ({
  submitReview: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("HITLReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders three action buttons", () => {
    render(
      <BrowserRouter>
        <HITLReviewPanel sessionId="test-123" />
      </BrowserRouter>,
    );
    expect(screen.getByText("Approve Plan")).toBeInTheDocument();
    expect(screen.getByText("Request Changes")).toBeInTheDocument();
    expect(screen.getByText("Modify Details")).toBeInTheDocument();
  });

  it("shows Review & Approve heading", () => {
    render(
      <BrowserRouter>
        <HITLReviewPanel sessionId="test-123" />
      </BrowserRouter>,
    );
    expect(screen.getByText("Review & Approve")).toBeInTheDocument();
  });

  it("shows keyboard shortcut hints", () => {
    render(
      <BrowserRouter>
        <HITLReviewPanel sessionId="test-123" />
      </BrowserRouter>,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("opens confirmation panel when Approve is clicked", async () => {
    render(
      <BrowserRouter>
        <HITLReviewPanel sessionId="test-123" />
      </BrowserRouter>,
    );
    await userEvent.click(screen.getByText("Approve Plan"));
    expect(screen.getByText("Confirm Approval")).toBeInTheDocument();
  });

  it("shows feedback textarea when Reject is clicked", async () => {
    render(
      <BrowserRouter>
        <HITLReviewPanel sessionId="test-123" />
      </BrowserRouter>,
    );
    await userEvent.click(screen.getByText("Request Changes"));
    expect(screen.getByPlaceholderText("Describe your feedback...")).toBeInTheDocument();
  });
});
