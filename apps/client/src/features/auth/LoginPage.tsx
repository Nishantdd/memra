import {
  Button,
  Column,
  Form,
  Grid,
  InlineNotification,
  PasswordInput,
  Stack,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { orpc } from "../../data/api/orpc.ts";
import { sessionStore, useSession } from "../../data/session.ts";

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const setup = useQuery(orpc.setup.status.queryOptions({ staleTime: 0 }));
  const [password, setPassword] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  const login = useMutation(
    orpc.auth.login.mutationOptions({
      onSuccess: (data) => sessionStore.set({ status: "authenticated", expiresAt: data.expiresAt }),
      onError: (error) => {
        if (isDefinedError(error) && error.code === "TOO_MANY_REQUESTS")
          setRetryAfter(error.data.retryAfterSec);
      },
    }),
  );

  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setTimeout(() => setRetryAfter((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryAfter]);

  if (setup.data?.needsSetup) return <Navigate to="/setup" replace />;
  if (session.status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password && retryAfter <= 0) login.mutate({ password });
  };
  const failed =
    login.isError && !(isDefinedError(login.error) && login.error.code === "TOO_MANY_REQUESTS");

  return (
    <main className="memra-login">
      <Grid>
        <Column sm={4} md={{ span: 6, offset: 1 }} lg={{ span: 6, offset: 5 }}>
          <Form onSubmit={submit}>
            <Stack gap={6}>
              <h1 className="memra-page-title">Sign in to Memra</h1>
              {retryAfter > 0 && (
                <InlineNotification
                  kind="warning"
                  lowContrast
                  hideCloseButton
                  title="Too many attempts"
                  subtitle={`Try again in ${retryAfter}s.`}
                />
              )}
              <PasswordInput
                id="password"
                labelText="Password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={failed}
                invalidText="Incorrect password."
              />
              <div className="memra-form__actions">
                <Button
                  type="submit"
                  size="lg"
                  disabled={login.isPending || retryAfter > 0 || !password}
                >
                  Sign in
                </Button>
              </div>
            </Stack>
          </Form>
        </Column>
      </Grid>
    </main>
  );
}
