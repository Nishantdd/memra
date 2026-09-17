import {
  Button,
  Form,
  InlineNotification,
  PasswordInput,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { LIMITS } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import { formatRelative } from "../../lib/time.ts";

export function SecuritySettings() {
  const qc = useQueryClient();
  const sessions = useQuery(orpc.auth.sessions.queryOptions());
  const revoke = useMutation(
    orpc.auth.revokeOthers.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.auth.sessions.key() }),
    }),
  );
  const change = useMutation(
    orpc.auth.changePassword.mutationOptions({
      onSuccess: () => {
        setCurrent("");
        setNext("");
        setRepeat("");
        void qc.invalidateQueries({ queryKey: orpc.auth.sessions.key() });
      },
    }),
  );
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = repeat.length > 0 && next !== repeat;
  const tooShort = next.length > 0 && next.length < LIMITS.passwordMin;
  const canSubmit = current && next.length > 0 && !tooShort && next === repeat && !change.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) change.mutate({ current, next });
  };

  const changeError = change.isError
    ? isDefinedError(change.error) && change.error.code === "UNAUTHORIZED"
      ? "The current password is incorrect."
      : isDefinedError(change.error) && change.error.code === "BAD_REQUEST"
        ? change.error.data.reason
        : "Couldn't change the password."
    : null;

  return (
    <Stack gap={8}>
      <Form onSubmit={submit} className="memra-form">
        <h3 className="memra-section__heading">Password</h3>
        <PasswordInput
          id="pw-current"
          labelText="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordInput
          id="pw-next"
          labelText="New password"
          invalid={tooShort}
          invalidText={`Use at least ${LIMITS.passwordMin} characters.`}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordInput
          id="pw-repeat"
          labelText="Repeat new password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          invalid={mismatch}
          invalidText="Passwords don't match."
        />
        {changeError && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={changeError} />
        )}
        {change.isSuccess && (
          <InlineNotification
            kind="success"
            lowContrast
            title="Password changed."
            subtitle="Other devices were signed out."
            onClose={() => change.reset()}
          />
        )}
        <div className="memra-form__actions">
          <Button type="submit" size="md" disabled={!canSubmit}>
            Change password
          </Button>
        </div>
      </Form>

      <Stack gap={5} className="memra-form">
        <h3 className="memra-section__heading">Signed-in devices</h3>
        {sessions.data && (
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
              {sessions.data.map((s) => (
                <StructuredListRow key={s.id}>
                  <StructuredListCell>
                    {describeUserAgent(s.userAgent)}
                    {s.current && (
                      <>
                        {" "}
                        <Tag type="blue" size="sm">
                          This device
                        </Tag>
                      </>
                    )}
                  </StructuredListCell>
                  <StructuredListCell>active {formatRelative(s.lastSeenAt)}</StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
        <div className="memra-form__actions">
          <Button
            kind="tertiary"
            size="md"
            disabled={revoke.isPending || (sessions.data?.length ?? 0) < 2}
            onClick={() => revoke.mutate(undefined)}
          >
            Sign out other devices
          </Button>
        </div>
      </Stack>
    </Stack>
  );
}

function describeUserAgent(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
