import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorMessage from "@/components/shared/ErrorMessage";

test("shows the given error message", () => {
  render(<ErrorMessage message="Something went wrong" />);

  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
});

test("does not show a retry button when onRetry is not passed", () => {
  render(<ErrorMessage message="Oops" />);

  expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
});

test("shows a retry button when onRetry is passed", () => {
  render(<ErrorMessage message="Oops" onRetry={() => {}} />);

  expect(screen.getByText("Try Again")).toBeInTheDocument();
});

test("calls onRetry when the retry button is clicked", async () => {
  const onRetry = jest.fn();
  render(<ErrorMessage message="Oops" onRetry={onRetry} />);

  await userEvent.click(screen.getByText("Try Again"));

  expect(onRetry).toHaveBeenCalledTimes(1);
});
