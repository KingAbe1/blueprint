#!/usr/bin/env bash

# Blueprint Studio - open the Vite dev server in a standalone app window (macOS)
PORT=5173
URL="http://localhost:$PORT"

echo "Starting Blueprint Studio..."

if ! curl -s --connect-timeout 1 "$URL" > /dev/null; then
  echo "Starting dev server on port $PORT..."
  npx vite --port "$PORT" &
  for _ in {1..20}; do
    if curl -s --connect-timeout 1 "$URL" > /dev/null; then
      break
    fi
    sleep 0.5
  done
fi

echo "Opening Blueprint Studio..."

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "/Applications/Google Chrome.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
elif [ -d "/Applications/Brave Browser.app" ]; then
  open -na "/Applications/Brave Browser.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "/Applications/Microsoft Edge.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
else
  open "$URL"
fi

echo "Blueprint Studio is open at $URL"
