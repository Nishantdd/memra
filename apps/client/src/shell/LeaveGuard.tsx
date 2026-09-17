import { Modal } from "@carbon/react";
import { useEffect } from "react";
import { useBlocker } from "react-router";
import { useSaveStatus } from "../data/saveStatus.ts";

/** Holds in-app navigation while a note has unsaved or in-flight changes. */
export function LeaveGuard() {
  const status = useSaveStatus();
  const busy = status !== "saved";
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return busy && currentLocation.pathname !== nextLocation.pathname;
  });

  // Once the autosave completes, let the held navigation through.
  useEffect(() => {
    if (blocker.state === "blocked" && !busy) blocker.proceed();
  }, [blocker, busy]);

  return (
    <Modal
      open={blocker.state === "blocked"}
      size="xs"
      danger={status !== "saving"}
      modalHeading={status === "saving" ? "Saving your changes…" : "Leave without saving?"}
      primaryButtonText="Leave anyway"
      secondaryButtonText="Stay"
      onRequestClose={() => blocker.reset?.()}
      onRequestSubmit={() => blocker.proceed?.()}
    >
      <p>
        {status === "saving"
          ? "You'll be taken there as soon as the note is saved."
          : status === "error"
            ? "The last save failed. If you leave now, those changes will be lost."
            : "Your latest edits haven't been saved yet. If you leave now, they'll be lost."}
      </p>
    </Modal>
  );
}
