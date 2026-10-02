#!/usr/bin/env bash

# Blueprint Studio - Native macOS Desktop Application Launcher
PORT=5173
URL="http://localhost:$PORT"

echo "🚀 Starting Blueprint Studio Desktop Application..."

# Check if Vite server is running on port 5173
if ! curl -s --connect-timeout 1 "$URL" > /dev/null; then
  echo "⚡ Starting background application engine on port $PORT..."
  npx vite --port $PORT &
  
  # Wait up to 10 seconds for server to be responsive
  for i in {1..20}; do
    if curl -s --connect-timeout 1 "$URL" > /dev/null; then
      break
    fi
    sleep 0.5
  done
fi

echo "🖥️ Launching Blueprint Studio Native Desktop Window..."

# 1. If Electron binary is installed and executable, launch via Electron
if [ -f "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
  echo "  -> Mode: Electron Desktop Window"
  NODE_ENV=development npx electron .
# 2. Launch in Google Chrome App Mode (Standalone native window, no URL bar, no tabs)
elif [ -d "/Applications/Google Chrome.app" ]; then
  echo "  -> Mode: Native Standalone App Window (Chrome Engine)"
  open -na "/Applications/Google Chrome.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
# 3. Launch in Brave App Mode
elif [ -d "/Applications/Brave Browser.app" ]; then
  echo "  -> Mode: Native Standalone App Window (Brave Engine)"
  open -na "/Applications/Brave Browser.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
# 4. Launch in Microsoft Edge App Mode
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  echo "  -> Mode: Native Standalone App Window (Edge Engine)"
  open -na "/Applications/Microsoft Edge.app" --args \
    --app="$URL" \
    --window-size=1440,920 \
    --window-position=100,50 \
    --user-data-dir="/tmp/blueprint-studio-desktop"
else
  # Default browser fallback
  open "$URL"
fi

echo "✅ Blueprint Studio Desktop Application is now open!"
