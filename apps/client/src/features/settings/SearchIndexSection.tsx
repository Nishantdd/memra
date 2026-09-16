import {
  Button,
  InlineNotification,
  Modal,
  ProgressBar,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "../../data/api/orpc.ts";
import { useIndexStatus } from "../../data/indexStatus.ts";

export function SearchIndexSection({ readOnly }: { readOnly: boolean }) {
  const status = useIndexStatus();
  const rebuild = useMutation(orpc.index.rebuild.mutationOptions());
  const [confirming, setConfirming] = useState(false);
  const inProgress =
    !!status && status.progress.total > 0 && status.progress.done < status.progress.total;

  return (
    <Stack gap={5}>
      <p className="memra-settings__help">
        Semantic search embeds your notes with a local model. The index is rebuilt automatically
        when the model changes; rebuild manually only if results look stale.
      </p>
      <StructuredListWrapper isCondensed>
        <StructuredListBody>
          <StructuredListRow>
            <StructuredListCell>Embedding model</StructuredListCell>
            <StructuredListCell>
              {status ? `${status.embedding.model} (${status.embedding.dims || "?"}-d)` : "…"}{" "}
              {status && (
                <Tag type={status.embedding.local ? "green" : "purple"} size="sm">
                  {status.embedding.local ? "Runs on your server" : "Remote provider"}
                </Tag>
              )}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Status</StructuredListCell>
            <StructuredListCell>
              {status ? (
                status.ready ? (
                  <Tag type="green" size="sm">
                    Ready
                  </Tag>
                ) : (
                  <Tag type="gray" size="sm">
                    Loading model
                  </Tag>
                )
              ) : (
                "…"
              )}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Indexed notes</StructuredListCell>
            <StructuredListCell>
              {status ? `${Math.round(status.indexedRatio * 100)}%` : "…"}
              {status && status.pending > 0 ? ` · ${status.pending} pending` : ""}
              {status && status.failed > 0 ? ` · ${status.failed} failed` : ""}
            </StructuredListCell>
          </StructuredListRow>
        </StructuredListBody>
      </StructuredListWrapper>
      {inProgress && status && (
        <ProgressBar
          label="Rebuilding search index"
          helperText={`${status.progress.done} of ${status.progress.total} notes`}
          value={status.progress.done}
          max={status.progress.total}
        />
      )}
      {status && status.failed > 0 && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={`${status.failed} ${status.failed === 1 ? "note" : "notes"} could not be indexed.`}
          subtitle="They still appear in keyword search. Rebuilding retries them."
        />
      )}
      <div className="memra-settings__row">
        <Button
          kind="tertiary"
          size="md"
          disabled={readOnly || !status?.ready || inProgress || rebuild.isPending}
          onClick={() => setConfirming(true)}
        >
          Rebuild index
        </Button>
      </div>
      <Modal
        open={confirming}
        size="sm"
        modalHeading="Rebuild the search index?"
        primaryButtonText="Rebuild"
        secondaryButtonText="Cancel"
        onRequestClose={() => setConfirming(false)}
        onRequestSubmit={() => {
          rebuild.mutate(undefined);
          setConfirming(false);
        }}
      >
        <p>
          All notes will be re-embedded. Semantic results may be incomplete until it finishes;
          keyword search keeps working.
        </p>
      </Modal>
    </Stack>
  );
}
