import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { privateKeyToAccount } from "viem/accounts";
import { VerifyMessageCard } from "./VerifyMessageCard";

const PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(PK); // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const MESSAGE = "hello cockpit";

async function fill(message: string, signature: string, expected?: string) {
  await userEvent.type(screen.getByLabelText(/^message$/i), message);
  // paste (not type) — signatures are 132 chars and userEvent.type is slow
  await userEvent.click(screen.getByLabelText(/^signature$/i));
  await userEvent.paste(signature);
  if (expected) {
    await userEvent.click(screen.getByLabelText(/expected signer/i));
    await userEvent.paste(expected);
  }
}

describe("VerifyMessageCard", () => {
  it("verify is disabled until message and signature are filled", () => {
    render(<VerifyMessageCard />);
    expect(
      screen.getByRole("button", { name: /verify signature/i }),
    ).toBeDisabled();
  });

  it("verifies a real signature and shows the recovered signer", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    render(<VerifyMessageCard />);
    await fill(MESSAGE, signature);
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    expect(await screen.findByText(/^valid signature$/i)).toBeInTheDocument();
    expect(screen.getByText(account.address)).toBeInTheDocument();
  });

  it("shows 'signer matches' when the expected signer matches case-insensitively", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    render(<VerifyMessageCard />);
    await fill(MESSAGE, signature, account.address.toLowerCase());
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    expect(
      await screen.findByText(/signature valid · signer matches/i),
    ).toBeInTheDocument();
  });

  it("shows a mismatch failure WITH the recovered signer", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    render(<VerifyMessageCard />);
    await fill(
      MESSAGE,
      signature,
      "0x0000000000000000000000000000000000000001",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByText(/does not match/i)).toBeInTheDocument();
    expect(screen.getByText(account.address)).toBeInTheDocument();
  });

  it("flags a malformed signature inline and fails verification without a recovered block", async () => {
    render(<VerifyMessageCard />);
    await fill(MESSAGE, "0xdeadbeef");
    expect(screen.getByText(/must be a 0x hex signature/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/recovered signer/i)).toBeNull();
  });

  it("disables verify when the expected signer is not a valid address", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    render(<VerifyMessageCard />);
    await fill(MESSAGE, signature, "not-an-address");
    expect(screen.getByText(/not a valid address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify signature/i }),
    ).toBeDisabled();
  });

  it("editing any input clears a previous result", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    render(<VerifyMessageCard />);
    await fill(MESSAGE, signature);
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    await screen.findByText(/^valid signature$/i);
    await userEvent.type(screen.getByLabelText(/^message$/i), "!");
    await waitFor(() =>
      expect(screen.queryByText(/^valid signature$/i)).toBeNull(),
    );
  });

  it("paste example fills a pair that verifies green end-to-end", async () => {
    render(<VerifyMessageCard />);
    await userEvent.click(
      screen.getByRole("button", { name: /paste example/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /verify signature/i }),
    );
    expect(await screen.findByText(/^valid signature$/i)).toBeInTheDocument();
    expect(
      screen.getByText("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
    ).toBeInTheDocument();
  });
});
