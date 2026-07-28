import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/content/StatusBadge";
import { RequestStatus } from "@/types/content";

// Checks that StatusBadge displays "Queued" for a PENDING request status.
test("shows Queued label for pending status", () => {
  render(<StatusBadge status={RequestStatus.PENDING} />);

  expect(screen.getByText("Queued")).toBeInTheDocument();
});

// Checks that StatusBadge displays "Generating..." for a PROCESSING request status.
test("shows Generating label for processing status", () => {
  render(<StatusBadge status={RequestStatus.PROCESSING} />);

  expect(screen.getByText("Generating...")).toBeInTheDocument();
});

// Checks that StatusBadge displays "Ready" for a COMPLETED request status.
test("shows Ready label for completed status", () => {
  render(<StatusBadge status={RequestStatus.COMPLETED} />);

  expect(screen.getByText("Ready")).toBeInTheDocument();
});

// Checks that StatusBadge displays "Failed" for a FAILED request status.
test("shows Failed label for failed status", () => {
  render(<StatusBadge status={RequestStatus.FAILED} />);

  expect(screen.getByText("Failed")).toBeInTheDocument();
});
