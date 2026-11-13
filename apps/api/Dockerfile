FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app /app
RUN pnpm turbo run build --filter=@sanarwa/api...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Timestamps are stored without a time zone; every instance must agree on one.
ENV TZ=UTC
COPY --from=deps /app /app
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
EXPOSE 8000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:8000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
