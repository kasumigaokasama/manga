#!/usr/bin/env bash
set -euo pipefail

# GoDaddy DDNS updater
# Fill in and chmod +x this file, then add to cron.

DOMAIN="example.com"      # your apex domain
KEY="your_godaddy_key"    # API key
SECRET="your_godaddy_secret"  # API secret

WORKDIR="$(dirname "$0")"
CACHE_FILE="$WORKDIR/last_ip.txt"
IP_SERVICE="https://api.ipify.org"

CURRENT_IP="$(curl -s "$IP_SERVICE")"
if [[ -z "$CURRENT_IP" ]]; then
  echo "Could not fetch current IP" >&2
  exit 1
fi

LAST_IP=""
if [[ -f "$CACHE_FILE" ]]; then
  LAST_IP="$(cat "$CACHE_FILE")"
fi

if [[ "$CURRENT_IP" == "$LAST_IP" ]]; then
  echo "IP unchanged: $CURRENT_IP"
  exit 0
fi

echo "Updating GoDaddy A records to $CURRENT_IP"

AUTH_HEADER="sso-key $KEY:$SECRET"
JSON_PAYLOAD="[{\"data\":\"$CURRENT_IP\",\"ttl\":600}]"

curl -s -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_HEADER" \
  -d "$JSON_PAYLOAD" \
  "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/@" > /dev/null

curl -s -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_HEADER" \
  -d "$JSON_PAYLOAD" \
  "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/www" > /dev/null

echo "$CURRENT_IP" > "$CACHE_FILE"
echo "Updated at $(date -Is) to $CURRENT_IP"

