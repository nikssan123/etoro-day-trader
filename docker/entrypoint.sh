#!/bin/bash
# Container entrypoint: build the eToro MCP config from the environment, then hand off.
#
# The eToro key is written here at startup rather than baked into the image or committed
# to the repo. It comes from ETORO_USER_KEY (see .env), so the secret exists only in the
# host's .env file and the running container's memory.

set -euo pipefail

CONFIG="$HOME/.claude.json"

if [[ -z "${ETORO_USER_KEY:-}" ]]; then
    echo "FATAL: ETORO_USER_KEY is not set. Copy .env.example to .env and fill it in." >&2
    exit 78
fi

# Merge the MCP server entry into any existing config rather than overwriting it, so an
# interactive `claude login` performed earlier (which writes into the same file) survives
# a container restart.
python3 - "$CONFIG" <<'PY'
import json, os, sys

path = sys.argv[1]
try:
    with open(path) as fh:
        config = json.load(fh)
except (OSError, ValueError):
    config = {}

config.setdefault("mcpServers", {})["etoro-public-api"] = {
    "type": "http",
    "url": "https://mcp.public-api.etoro.com",
    "headers": {"x-user-key": os.environ["ETORO_USER_KEY"]},
}

with open(path, "w") as fh:
    json.dump(config, fh, indent=2)
os.chmod(path, 0o600)
PY

# Fail fast and loudly rather than letting every cycle die one at a time.
if [[ -z "${ANTHROPIC_API_KEY:-}" ]] && ! grep -q '"oauthAccount"\|"primaryApiKey"' "$CONFIG" 2>/dev/null; then
    echo "WARNING: no ANTHROPIC_API_KEY set and no saved login found." >&2
    echo "         Run: docker compose run --rm bot claude login" >&2
fi

echo "$(date -Is) entrypoint ready (TZ=${TZ:-unset}, repo=$(pwd))"
exec "$@"
