import { ActionableNotification, Modal } from "@carbon/react";
import { useEffect, useState } from "react";
import type { Note } from "shared";
import { UNDO_MS } from "../../constants/index.ts";
import { useDeleteNote, useRestoreNote } from "../../data/mutations.ts";

export function useDeleteWithUndo() {
  const remove = useDeleteNote();
  const restore = useRestoreNote();
  const [pending, setPending] = useState<Note | null>(null);
  const [deleted, setDeleted] = useState<Note | null>(null);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [deleted]);

  const confirmModal = (
    <Modal
      open={pending !== null}
      danger
      size="sm"
      modalHeading="Delete note?"
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={remove.isPending}
      onRequestClose={() => setPending(null)}
      onRequestSubmit={() =>
        pending &&
        remove.mutate(
          { id: pending.id },
          {
            onSuccess: (n) => {
              setPending(null);
              setDeleted(n);
            },
          },
        )
      }
    >
      <p>“{pending?.displayTitle}” will be deleted. You can undo this for a short while.</p>
    </Modal>
  );

  const undoToast = deleted ? (
    <div className="memra-toasts">
      <ActionableNotification
        kind="info"
        lowContrast
        hasFocus={false}
        title="Note deleted"
        subtitle={deleted.displayTitle}
        onClose={() => setDeleted(null)}
        actionButtonLabel="Undo"
        onActionButtonClick={() =>
          restore.mutate({ id: deleted.id }, { onSuccess: () => setDeleted(null) })
        }
      />
    </div>
  ) : null;

  return { requestDelete: setPending, confirmModal, undoToast };
}
