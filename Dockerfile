# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

COPY ui/package*.json ./ui/
RUN cd ui && npm ci --ignore-scripts

COPY ui/ ./ui/
RUN cd ui && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui/dist ./ui/dist
COPY examples/ ./examples/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

ENV NODE_ENV=production

EXPOSE 3000
EXPOSE 9090

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

LABEL org.opencontainers.image.title="MCP Transport Firewall" \
      org.opencontainers.image.description="Fail-closed stdio firewall for MCP tool traffic with an HTTP review harness" \
      org.opencontainers.image.source="https://github.com/maksboreichuk88-commits/mcp-transport-firewall" \
      org.opencontainers.image.licenses="MIT"
