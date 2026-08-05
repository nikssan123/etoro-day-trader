#!/bin/bash
# Generate and install the launchd jobs that drive the bot.
#
#   bin/install-schedule.sh generate   write plists into launchd/ only (schedules nothing)
#   bin/install-schedule.sh install    generate plists + load them (STARTS LIVE TRADING)
#   bin/install-schedule.sh uninstall  unload + remove them
#   bin/install-schedule.sh status     show what is loaded
#
# launchd rather than cron on purpose: cron silently skips jobs missed while the Mac
# is asleep, whereas launchd runs a missed StartCalendarInterval job on wake. On a
# laptop that matters — a sleeping machine delays a cycle instead of losing it.
#
# Times are Europe/Sofia local. The US session is 16:30-23:00 local.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
PREFIX="com.nixon.tradingbot"
ACTION="${1:-install}"

# cycle:hour:minute:weekday-spec   (weekday: 1-5 = Mon-Fri, 6 = Sat, "monthly" = day 1)
SCHEDULE=(
    "overnight:9:12:weekdays"
    "premarket:13:7:weekdays"
    "open:16:47:weekdays"
    "midday:19:33:weekdays"
    "close:22:47:weekdays"
    "weekly:12:15:saturday"
    "monthly:12:15:first-of-month"
)

calendar_block() {
    local hour="$1" minute="$2" spec="$3"
    case "$spec" in
        weekdays)
            for day in 1 2 3 4 5; do
                printf '\t\t<dict><key>Weekday</key><integer>%s</integer><key>Hour</key><integer>%s</integer><key>Minute</key><integer>%s</integer></dict>\n' \
                    "$day" "$hour" "$minute"
            done ;;
        saturday)
            printf '\t\t<dict><key>Weekday</key><integer>6</integer><key>Hour</key><integer>%s</integer><key>Minute</key><integer>%s</integer></dict>\n' \
                "$hour" "$minute" ;;
        first-of-month)
            printf '\t\t<dict><key>Day</key><integer>1</integer><key>Hour</key><integer>%s</integer><key>Minute</key><integer>%s</integer></dict>\n' \
                "$hour" "$minute" ;;
    esac
}

write_plist() {
    local cycle="$1" hour="$2" minute="$3" spec="$4"
    local out="$REPO/launchd/$PREFIX.$cycle.plist"
    {
        cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>$PREFIX.$cycle</string>
	<key>ProgramArguments</key>
	<array>
		<string>$REPO/bin/trade-cycle.sh</string>
		<string>$cycle</string>
	</array>
	<key>WorkingDirectory</key><string>$REPO</string>
	<key>StartCalendarInterval</key>
	<array>
EOF
        calendar_block "$hour" "$minute" "$spec"
        cat <<EOF
	</array>
	<key>StandardOutPath</key><string>$REPO/logs/launchd-$cycle.out</string>
	<key>StandardErrorPath</key><string>$REPO/logs/launchd-$cycle.err</string>
	<key>RunAtLoad</key><false/>
	<key>ProcessType</key><string>Background</string>
</dict>
</plist>
EOF
    } > "$out"
    echo "$out"
}

case "$ACTION" in
    generate)
        mkdir -p "$REPO/launchd"
        for entry in "${SCHEDULE[@]}"; do
            IFS=: read -r cycle hour minute spec <<<"$entry"
            write_plist "$cycle" "$hour" "$minute" "$spec" >/dev/null
            printf '  wrote %-10s %02d:%02d %s\n' "$cycle" "$hour" "$minute" "$spec"
        done
        echo "Generated into launchd/ — nothing is scheduled until you run: $0 install"
        ;;
    install)
        mkdir -p "$AGENTS" "$REPO/logs" "$REPO/launchd"
        chmod +x "$REPO/bin/trade-cycle.sh" "$REPO/bin/etoro"
        for entry in "${SCHEDULE[@]}"; do
            IFS=: read -r cycle hour minute spec <<<"$entry"
            plist="$(write_plist "$cycle" "$hour" "$minute" "$spec")"
            cp "$plist" "$AGENTS/"
            launchctl bootout "gui/$UID/$PREFIX.$cycle" 2>/dev/null || true
            launchctl bootstrap "gui/$UID" "$AGENTS/$PREFIX.$cycle.plist"
            printf '  loaded %-10s %02d:%02d %s\n' "$cycle" "$hour" "$minute" "$spec"
        done
        echo "Installed. Check with: $0 status"
        ;;
    uninstall)
        for entry in "${SCHEDULE[@]}"; do
            IFS=: read -r cycle _ _ _ <<<"$entry"
            launchctl bootout "gui/$UID/$PREFIX.$cycle" 2>/dev/null || true
            rm -f "$AGENTS/$PREFIX.$cycle.plist"
            echo "  removed $cycle"
        done
        ;;
    status)
        launchctl list | grep "$PREFIX" || echo "no tradingbot jobs loaded"
        ;;
    *)
        echo "usage: $0 [install|uninstall|status]" >&2
        exit 64 ;;
esac
