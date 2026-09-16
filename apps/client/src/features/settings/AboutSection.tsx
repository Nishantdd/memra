import {
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "../../data/api/orpc.ts";

export function AboutSection({ readOnly }: { readOnly: boolean }) {
  const status = useQuery(orpc.status.queryOptions({ enabled: !readOnly, staleTime: 60_000 }));
  const s = status.data;
  const allLocal = !!s && s.embedding.local && s.llm.local;

  return (
    <Stack gap={5}>
      {s && (
        <Tag type={allLocal ? "green" : "purple"} size="md">
          {allLocal
            ? "All processing local"
            : `Uses remote provider${s.embedding.local || s.llm.local ? "" : "s"}`}
        </Tag>
      )}
      <StructuredListWrapper isCondensed>
        <StructuredListBody>
          <StructuredListRow>
            <StructuredListCell>Version</StructuredListCell>
            <StructuredListCell>{s?.version ?? "…"}</StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Embeddings</StructuredListCell>
            <StructuredListCell>
              {s ? `${s.embedding.provider} · ${s.embedding.model}` : "…"}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Answers</StructuredListCell>
            <StructuredListCell>
              {s
                ? s.llm.provider === "none"
                  ? "Extractive (no language model configured)"
                  : `${s.llm.provider} · ${s.llm.model}`
                : "…"}
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Server uptime</StructuredListCell>
            <StructuredListCell>{s ? formatUptime(s.uptimeSec) : "…"}</StructuredListCell>
          </StructuredListRow>
        </StructuredListBody>
      </StructuredListWrapper>
    </Stack>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
