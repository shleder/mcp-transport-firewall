# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Build UI
COPY ui/package*.json ./ui/
RUN cd ui && npm ci --ignore-scripts

COPY ui/ ./ui/
RUN cd ui && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui/dist ./ui/dist

ENV NODE_ENV=production

EXPOSE 9090

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

LABEL org.opencontainers.image.title="MCP Context Optimizer" \
      org.opencontainers.image.description="Caching proxy & application firewall for the Model Context Protocol" \
      org.opencontainers.image.source="https://github.com/maksboreichuk88-commits/MCP-server" \
      org.opencontainers.image.licenses="MIT"
