# Dashboard image: build the React bundle and the API, ship only what runs.
#
# Separate from the bot image on purpose. The bot needs Claude Code, shell access and
# the eToro key; the dashboard needs none of those. Keeping them apart means the
# internet-facing service cannot reach the trading credentials.

FROM node:22-slim AS build
WORKDIR /build

COPY package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /build/server/dist ./server/dist
# hash-password is compiled into server/dist alongside the API
COPY --from=build /build/web/dist ./web/dist

ENV WEB_DIR=/app/web/dist \
    DATA_DIR=/data \
    STRATEGY_DIR=/strategy \
    PORT=8080

USER node
EXPOSE 8080

# The API is read-only, so a failing health check means the process is wedged, not
# that any trading state is at risk.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:8080/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
