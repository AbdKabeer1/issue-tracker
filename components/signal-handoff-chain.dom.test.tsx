// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SignalHandoffChain } from "./signal-handoff-chain";

afterEach(cleanup);

it("renders the handoff chain and the real worker", () => {
  render(
    <SignalHandoffChain
      channel={{
        stage: "build",
        state: "working",
        worker: { id: "a1", name: "relay-04", kind: "bot" },
      }}
    />,
  );
  expect(screen.getByText("Plan")).toBeTruthy();
  expect(screen.getByText("Build")).toBeTruthy();
  expect(screen.getByText("Verify")).toBeTruthy();
  expect(screen.getByText("relay-04")).toBeTruthy();
  expect(screen.getByText("bot")).toBeTruthy();
});

it("says unassigned when there is no worker", () => {
  render(
    <SignalHandoffChain
      channel={{ stage: "plan", state: "idle", worker: null }}
    />,
  );
  expect(screen.getByText("unassigned")).toBeTruthy();
});
