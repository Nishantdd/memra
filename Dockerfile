# syntax=docker/dockerfile:1.7
# glibc image: onnxruntime-node and sqlite-vec ship glibc binaries (no Alpine).
FROM node:26-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json vite.config.ts ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
RUN pnpm run build

FROM node:26-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MEMRA_DATA_DIR=/data \
    NODE_OPTIONS=--max-old-space-size=384
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod --filter server... && pnpm store prune
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/client/dist apps/client/dist
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/apps/server
CMD ["node", "dist/index.mjs"]
