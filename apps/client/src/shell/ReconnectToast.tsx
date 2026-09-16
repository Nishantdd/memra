import { ToastNotification } from "@carbon/react";
import { RECONNECT_TOAST_MS } from "../constants/index.ts";
import { connectivityStore, useConnectivity } from "../data/sync/connectivity.ts";

export function ReconnectToast() {
  const { reconnectNotice } = useConnectivity();
  if (!reconnectNotice) return null;
  const n = reconnectNotice.applied;
  return (
    <div className="memra-toasts">
      <ToastNotification
        key={reconnectNotice.at}
        kind="success"
        lowContrast
        title="Back online"
        subtitle={`Synced ${n} ${n === 1 ? "change" : "changes"}.`}
        timeout={RECONNECT_TOAST_MS}
        onClose={() => connectivityStore.set({ reconnectNotice: null })}
      />
    </div>
  );
}
