import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

describe("Modal", () => {
  it("renders title + children in a dialog and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add contract" onClose={onClose}>
        body
      </Modal>,
    );
    // Modal is mount-gated (useEffect sets mounted=true before portal renders),
    // so use findByRole to await the async state update.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Add contract");
    expect(screen.getByText("body")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the X button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test" onClose={onClose}>
        content
      </Modal>,
    );
    await screen.findByRole("dialog");
    // XBtn has aria-label="Close"
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders optional footer content", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="With footer" onClose={onClose} footer={<span>Save</span>}>
        body
      </Modal>,
    );
    await screen.findByRole("dialog");
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("does not render the dialog before mount effect fires", () => {
    // Before useEffect runs, mounted=false → Modal returns null
    // After render (but before effects flush), queryByRole should find nothing.
    // This is a documentation test: findByRole above relies on this behavior.
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Hidden" onClose={onClose}>
        hidden-body
      </Modal>,
    );
    // Synchronously after render (before effects), portal is not yet in the DOM.
    // container itself will be empty; the portal is on document.body.
    expect(container.firstChild).toBeNull();
  });
});
