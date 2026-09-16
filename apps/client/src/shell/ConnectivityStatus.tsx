import { Checkmark, CloudOffline, Renew, WarningAlt } from "@carbon/icons-react";
import { Tag } from "@carbon/react";
import { useConnectivity } from "../data/sync/connectivity.ts";

export function ConnectivityStatus() {
  const { connectivity, activity } = useConnectivity();

  if (connectivity === "offline") {
    return (
      <Tag type="gray" size="md" renderIcon={CloudOffline} className="memra-status" title="Notes are read-only while offline">
        Offline · read-only
      </Tag>
    );
  }
  if (activity === "syncing" || connectivity === "checking") {
    return (
      <Tag type="gray" size="md" renderIcon={Renew} className="memra-status memra-status--busy">
        Syncing…
      </Tag>
    );
  }
  if (activity === "error") {
    return (
      <Tag type="gray" size="md" renderIcon={WarningAlt} className="memra-status" title="Sync failed; retrying">
        Sync issue
      </Tag>
    );
  }
  return (
    <Tag type="gray" size="md" renderIcon={Checkmark} className="memra-status" title="All changes synced">
      Up to date
    </Tag>
  );
}
