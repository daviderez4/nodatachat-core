#!/bin/bash
# Example: Send a burn-after-read secret from the terminal
#
# This encrypts your secret locally, sends the encrypted blob
# to the server, and gives you a link. The decryption key is
# in the URL fragment (#) — the server never sees it.

# Simple text secret
npx nodata-send "DB_PASSWORD=super_secret_123"

# With custom expiry (1 hour)
# npx nodata-send "temporary_token_abc" --expire 1h

# Pipe from a command
# echo "MY_API_KEY=sk-abc123" | npx nodata-send

# Keep the secret (don't burn after first read)
# npx nodata-send "shared_wifi_password" --no-burn
