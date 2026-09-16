import {
  ActionableNotification,
  Button,
  Modal,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db, wipeLocalData } from "../../data/db.ts";
import { clearOfflineIndex } from "../../data/search/offlineIndex.ts";
import { formatBytes, requestPersistentStorage, useStorageInfo } from "../../data/storage.ts";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { syncNow } from "../../data/sync/engine.ts";
import { formatAbsolute } from "../../lib/time.ts";

export function OfflineStorageSection() {
  const storage = useStorageInfo();
  const { lastSyncAt, connectivity } = useConnectivity();
  const counts = useLiveQuery(
    async () => ({
      notes: await db.notes.count(),
      folders: await db.folders.count(),
      tags: await db.tags.count(),
    }),
    [],
  );
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const clear = async () => {
    await wipeLocalData();
    clearOfflineIndex();
    setConfirming(false);
    if (connectivity !== "offline") void syncNow();
  };

  const requestPersist = async () => {
    await requestPersistentStorage();
    await queryClient.invalidateQueries({ queryKey: ["storage-info"] });
  };

  return (
    <Stack gap={5}>
      <p className="memra-settings__help">
        A copy of your notes is kept in this browser so you can read and search them offline.
        Changes are only possible while connected.
      </p>
      <StructuredListWrapper isCondensed>
        <StructuredListBody>
          <StructuredListRow>
            <StructuredListCell>Stored locally</StructuredListCell>
            <StructuredListCell>
              {counts
                ? `${counts.notes} notes · ${counts.folders} folders · ${counts.tags} tags`
                : "…"}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Last synced</StructuredListCell>
            <StructuredListCell>
              {lastSyncAt ? formatAbsolute(lastSyncAt) : "Not yet in this session"}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Space used</StructuredListCell>
            <StructuredListCell>
              {storage.data?.usageBytes != null ? formatBytes(storage.data.usageBytes) : "Unknown"}
              {storage.data?.quotaBytes
                ? ` of ${formatBytes(storage.data.quotaBytes)} available`
                : ""}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Protected from eviction</StructuredListCell>
            <StructuredListCell>
              {storage.data?.persisted === true && (
                <Tag type="green" size="sm">
                  Yes
                </Tag>
              )}
              {storage.data?.persisted === false && (
                <Tag type="gray" size="sm">
                  No
                </Tag>
              )}
              {storage.data?.persisted == null && (
                <Tag type="gray" size="sm">
                  Unsupported
                </Tag>
              )}
            </StructuredListCell>
          </StructuredListRow>
        </StructuredListBody>
      </StructuredListWrapper>
      {storage.data?.persisted === false && (
        <ActionableNotification
          kind="warning"
          lowContrast
          inline
          hideCloseButton
          title="The browser may remove offline data under storage pressure."
          subtitle="Installing Memra as an app usually grants persistent storage."
          actionButtonLabel="Request protection"
          onActionButtonClick={() => void requestPersist()}
        />
      )}
      <div className="memra-settings__row">
        <Button kind="danger--tertiary" onClick={() => setConfirming(true)}>
          Clear local data
        </Button>
      </div>
      <Modal
        open={confirming}
        danger
        size="sm"
        modalHeading="Clear local data?"
        primaryButtonText="Clear"
        secondaryButtonText="Cancel"
        onRequestClose={() => setConfirming(false)}
        onRequestSubmit={() => void clear()}
      >
        <p>
          Notes stored in this browser will be removed. Nothing is deleted from the server; the copy
          is downloaded again when you're online.
        </p>
      </Modal>
    </Stack>
  );
}
