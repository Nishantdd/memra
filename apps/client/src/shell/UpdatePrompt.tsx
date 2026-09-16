import { ActionableNotification } from "@carbon/react";
import { useSyncExternalStore } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { unsavedStore } from "../data/unsaved.ts";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const hasUnsaved = useSyncExternalStore(
    unsavedStore.subscribe,
    unsavedStore.hasUnsaved,
    unsavedStore.hasUnsaved,
  );

  if (!needRefresh) return null;
  return (
    <div className="memra-toasts">
      <ActionableNotification
        kind="info"
        lowContrast
        hasFocus={false}
        title="A new version of Memra is available."
        subtitle={
          hasUnsaved ? "Save your changes first, then reload." : "Reload to get the latest version."
        }
        actionButtonLabel={hasUnsaved ? "Reload anyway" : "Reload"}
        onActionButtonClick={() => void updateServiceWorker(true)}
        onClose={() => setNeedRefresh(false)}
      />
    </div>
  );
}
