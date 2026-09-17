import { oc } from "@orpc/contract";
import { z } from "zod";
import { LIMITS } from "../constants/limits.ts";
import { ProviderBaseUrl } from "../schemas/common.ts";
import { AppSettings, AppSettingsPatch } from "../schemas/settings.ts";

const Ok = z.object({ ok: z.literal(true) });

export const settingsContract = {
  get: oc.route({ method: "GET", path: "/settings" }).output(AppSettings),
  update: oc
    .route({ method: "PATCH", path: "/settings" })
    .errors({ BAD_REQUEST: { data: z.object({ reason: z.string() }) } })
    .input(AppSettingsPatch)
    .output(AppSettings),
  testProvider: oc
    .route({ method: "POST", path: "/settings/test" })
    .input(
      z.object({
        kind: z.enum(["embedding", "llm"]),
        baseUrl: ProviderBaseUrl,
        model: z.string().min(1),
        apiKey: z.string().max(4096).optional(),
      }),
    )
    .output(z.object({ ok: z.boolean(), detail: z.string() })),
};

export const setupContract = {
  status: oc
    .route({ method: "GET", path: "/setup/status" })
    .output(z.object({ needsSetup: z.boolean() })),
  complete: oc
    .route({ method: "POST", path: "/setup" })
    .errors({
      CONFLICT: {},
      BAD_REQUEST: { data: z.object({ reason: z.string() }) },
    })
    .input(
      z.object({
        password: z.string().min(LIMITS.passwordMin).max(1024),
        settings: AppSettingsPatch,
      }),
    )
    .output(Ok),
};
