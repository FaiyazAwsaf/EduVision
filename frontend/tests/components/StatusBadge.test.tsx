import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/content/StatusBadge";
import { RequestStatus } from "@/types/content";

test("shows Queued label for pending status", () => {
  render(<StatusBadge status={RequestStatus.PENDING} />);

  expect(screen.getByText("Queued")).toBeInTheDocument();
});

test("shows Generating label for processing status", () => {
  render(<StatusBadge status={RequestStatus.PROCESSING} />);

  expect(screen.getByText("Generating...")).toBeInTheDocument();
});

test("shows Ready label for completed status", () => {
  render(<StatusBadge status={RequestStatus.COMPLETED} />);

  expect(screen.getByText("Ready")).toBeInTheDocument();
});

test("shows Failed label for failed status", () => {
  render(<StatusBadge status={RequestStatus.FAILED} />);

  expect(screen.getByText("Failed")).toBeInTheDocument();
});
