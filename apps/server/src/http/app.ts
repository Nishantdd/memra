import { existsSync } from "node:fs";
import path from "node:path";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { OpenAPIGenerator } from "@orpc/openapi";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fastify";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { contract } from "shared";
import type { RequestContext, Services } from "./context.ts";
import { router } from "./router.ts";

export const SESSION_COOKIE = "memra_session";
const API_PREFIX = "/api/v1";
const RPC_PREFIX = "/api/rpc";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOrigin(request: FastifyRequest, publicOrigin: string | null): boolean {
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  const expected = publicOrigin ?? `${request.protocol}://${request.host}`;
  return origin === expected;
}

export function buildApp(services: Services, clientDist: string | null): FastifyInstance {
  const { config } = services;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
    },
    trustProxy: config.trustProxy,
    bodyLimit: 2 * 1024 * 1024,
  });

  app.register(sensible);
  app.register(cookie);
  app.register(helmet, {
    hsts: config.secureCookies ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
      },
    },
  });
  app.register(rateLimit, { global: false });

  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, _payload, done) => done(null, undefined));

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    if (MUTATING.has(request.method) && !isSameOrigin(request, config.publicOrigin)) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Cross-site request rejected" });
    }
  });

  const buildContext = (request: FastifyRequest, reply: FastifyReply): RequestContext => ({
    services,
    session: services.auth.resolve(request.cookies[SESSION_COOKIE]),
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? "",
    setSessionCookie(token) {
      const opts = { path: "/", httpOnly: true, sameSite: "strict" as const, secure: config.secureCookies };
      if (token) reply.setCookie(SESSION_COOKIE, token, { ...opts, maxAge: 30 * 24 * 3600 });
      else reply.clearCookie(SESSION_COOKIE, opts);
    },
  });

  const logError = onError((error) => {
    if (!(error instanceof Error) || !("status" in error) || (error as { status: number }).status >= 500) {
      app.log.error(error);
    }
  });
  const rpcHandler = new RPCHandler(router, { interceptors: [logError] });
  const openApiHandler = new OpenAPIHandler(router, { interceptors: [logError] });

  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    url: `${RPC_PREFIX}/*`,
    config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const { matched } = await rpcHandler.handle(request, reply, { prefix: RPC_PREFIX, context: buildContext(request, reply) });
      if (matched) return reply;
      return reply.code(404).send({ code: "NOT_FOUND", message: "Not found" });
    },
  });

  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    url: `${API_PREFIX}/*`,
    config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const context = buildContext(request, reply);
      if (request.url === `${API_PREFIX}/openapi.json`) {
        if (!context.session) return reply.code(401).send({ code: "UNAUTHORIZED", message: "Unauthorized" });
        const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });
        return reply.send(await generator.generate(contract, { info: { title: "Memra", version: services.version }, servers: [{ url: API_PREFIX }] }));
      }
      const { matched } = await openApiHandler.handle(request, reply, { prefix: API_PREFIX, context });
      if (matched) return reply;
      return reply.code(404).send({ code: "NOT_FOUND", message: "Not found" });
    },
  });

  app.route({
    method: "POST",
    url: `${API_PREFIX}/auth/login`,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const { matched } = await openApiHandler.handle(request, reply, { prefix: API_PREFIX, context: buildContext(request, reply) });
      if (matched) return reply;
      return reply.code(404).send({ code: "NOT_FOUND", message: "Not found" });
    },
  });

  if (clientDist && existsSync(path.join(clientDist, "index.html"))) {
    app.register(fastifyStatic, {
      root: clientDist,
      wildcard: false,
      setHeaders(res, filePath) {
        const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("cache-control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) return reply.code(404).send({ code: "NOT_FOUND", message: "Not found" });
      return reply.header("cache-control", "no-cache").sendFile("index.html");
    });
  }

  return app;
}
