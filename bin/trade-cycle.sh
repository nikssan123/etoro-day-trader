#!/bin/bash
# Run one trading cycle. Invoked by launchd (see launchd/) or by hand:
#   bin/trade-cycle.sh open
#
# Wraps `claude -p` with the tool allowlist the headless run needs. Without
# execute-write on that list the order is silently denied and the cycle looks like
# it "decided not to trade" — which is the exact failure this bot exists to fix.

set -uo pipefail

CYCLE="${1:-}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

VALID="overnight premarket open midday close weekly monthly"
if [[ -z "$CYCLE" ]] || ! grep -qw "$CYCLE" <<<"$VALID"; then
    echo "usage: $0 <${VALID// /|}>" >&2
    exit 64
fi

PROMPT_FILE="$REPO/prompts/$CYCLE.md"
[[ -f "$PROMPT_FILE" ]] || { echo "missing prompt: $PROMPT_FILE" >&2; exit 66; }

# Homebrew and asdf/nvm paths — launchd starts with a minimal PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
command -v claude >/dev/null || { echo "claude CLI not found on PATH" >&2; exit 69; }

mkdir -p logs data
LOG="$REPO/logs/$CYCLE-$(date +%F).jsonl"

# Never let two cycles run at once — overlapping runs would double-trade and
# interleave writes to the append-only logs.
LOCK="$REPO/.cycle.lock"
exec 9>"$LOCK"
if ! flock -n 9 2>/dev/null; then
    # macOS bash 3.2 has no flock; fall back to a pid-file guard.
    if [[ -f "$REPO/.cycle.pid" ]] && kill -0 "$(cat "$REPO/.cycle.pid" 2>/dev/null)" 2>/dev/null; then
        echo "$(date -u +%FT%TZ) another cycle is running; skipping $CYCLE" | tee -a "$LOG"
        exit 75
    fi
fi
echo $$ > "$REPO/.cycle.pid"
trap 'rm -f "$REPO/.cycle.pid"' EXIT

# Opus for the analysis cycles, where reasoning quality decides what gets learned.
case "$CYCLE" in
    weekly|monthly) MODEL="opus" ;;
    *)              MODEL="sonnet" ;;
esac

RUN_ID="$(./bin/etoro run-start "$CYCLE")"
STARTED_AT="$(date -u +%FT%TZ)"
START_EPOCH=$(date +%s)

echo "=== $STARTED_AT  cycle=$CYCLE  run=$RUN_ID  model=$MODEL ===" >> "$LOG"

# Refresh derived state and take a mark-to-market sample before the agent runs, so it
# reads a current portfolio and every cycle contributes an MAE/MFE data point.
./bin/etoro snapshot >> "$LOG" 2>&1
./bin/etoro mark     >> "$LOG" 2>&1

PROMPT="$(cat "$PROMPT_FILE")

---
Your run_id for this cycle is: $RUN_ID
Pass it to every \`bin/etoro log-event --run-id\` and include it in trade records.
Today is $(date -u +%F) (UTC). Local time is $(date +%H:%M\ %Z)."

ALLOWED="mcp__etoro-public-api__execute-read,mcp__etoro-public-api__execute-write,mcp__etoro-public-api__get-all-routes,mcp__etoro-public-api__get-route-spec,Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch"

claude -p "$PROMPT" \
    --model "$MODEL" \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOWED" \
    --output-format stream-json --verbose \
    >> "$LOG" 2>&1
EXIT_CODE=$?

DURATION=$(( $(date +%s) - START_EPOCH ))

# Count what this run actually did, from the append-only logs rather than trusting
# the agent's own account of itself.
# grep -c prints 0 and exits 1 when nothing matches, so take the output and default it
# rather than chaining `|| echo 0`, which would yield a malformed "0\n0".
OPENED=$(grep -c "\"run_id\": \"$RUN_ID\".*\"type\": \"entry\"" data/events.jsonl 2>/dev/null)
CLOSED=$(grep -c "\"run_id\": \"$RUN_ID\".*\"type\": \"exit\"" data/events.jsonl 2>/dev/null)
OPENED=${OPENED:-0}
CLOSED=${CLOSED:-0}

./bin/etoro run-end \
    --run-id "$RUN_ID" --cycle "$CYCLE" --started-at "$STARTED_AT" \
    --duration "$DURATION" --opened "$OPENED" --closed "$CLOSED" \
    --exit-code "$EXIT_CODE" >> "$LOG" 2>&1

./bin/etoro stats --quiet >> "$LOG" 2>&1

echo "=== done cycle=$CYCLE run=$RUN_ID exit=$EXIT_CODE ${DURATION}s opened=$OPENED closed=$CLOSED ===" >> "$LOG"

# Keep 30 days of logs.
find "$REPO/logs" -name '*.jsonl' -mtime +30 -delete 2>/dev/null

exit $EXIT_CODE
