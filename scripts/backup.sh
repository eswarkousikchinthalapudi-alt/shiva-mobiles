#!/usr/bin/env bash
# Saves a copy of the database (phones, photos, requests, bills — everything).
#
#   ./scripts/backup.sh
#
# Run it every night with cron (crontab -e):
#   30 2 * * * cd /opt/shiva-mobiles && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Keeps 14 days of copies in ./backups. Also copy them off the server now and
# then (for example to Google Drive with rclone), and keep APP_SECRET safe:
# a backup is only useful together with it.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/shiva-$(date +%Y-%m-%d).dump"
docker compose exec -T db pg_dump -U shiva -d shiva --format=custom > "$file.tmp"
mv "$file.tmp" "$file"
find backups -name 'shiva-*.dump' -mtime +14 -delete
echo "$(date -Is) saved $file ($(du -h "$file" | cut -f1))"
