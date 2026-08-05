# Trading bot runtime: Claude Code + Python, isolated from whatever else the host runs.
#
# The bot is an autonomous agent with shell access running unattended on input it does
# not control (market data, web search results). It lives in a container so that blast
# radius stops at this image and the mounted repo — nothing else on the host is reachable.

FROM node:22-slim

# tzdata: the schedule is expressed in Europe/Sofia local time and must match the US
#   session, so the container's clock cannot be UTC.
# python3: bin/etoro (stdlib only — no pip install needed).
# git: lets the bot commit its own data/ history if you enable that later.
# procps: `ps`, used by the lock check in trade-cycle.sh.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl git python3 tzdata procps \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# supercronic: cron built for containers — runs as an unprivileged user, logs to stdout,
# and does not need the PID-1 gymnastics that dcron/vixie-cron require in Docker.
ARG SUPERCRONIC_VERSION=v0.2.33
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
        amd64) SC_ARCH=amd64; SC_SHA1=71b0d58cc53f6bd72cf2f293e09e294b79c666d8 ;; \
        arm64) SC_ARCH=arm64; SC_SHA1=e0f0c06ebc5627e43b25475711e694450489ab00 ;; \
        *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSLO "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${SC_ARCH}"; \
    echo "${SC_SHA1}  supercronic-linux-${SC_ARCH}" | sha1sum -c -; \
    chmod +x "supercronic-linux-${SC_ARCH}"; \
    mv "supercronic-linux-${SC_ARCH}" /usr/local/bin/supercronic

# Run as an unprivileged user. node:22-slim ships a `node` user (uid 1000); reuse it so
# files written into the mounted repo stay owned by a normal uid rather than root.
ENV HOME=/home/node
WORKDIR /app

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/crontab /etc/bot-crontab
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supercronic", "/etc/bot-crontab"]
