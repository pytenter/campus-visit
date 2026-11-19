#!/bin/zsh
set -eu
cd "$(dirname "$0")"
CAMPUS_PORT="${1:-5173}"
if [ ! -f dist/index.html ]; then
  echo '尚无构建产物。请先安装 Node.js，运行 pnpm install && pnpm build。'
  exit 1
fi
if curl -fsS --max-time 1 "http://localhost:${CAMPUS_PORT}/" 2>/dev/null | /usr/bin/grep -q '如果周六由你开校门'; then
  echo "校园已运行：http://localhost:${CAMPUS_PORT}/"
  exit 0
fi
echo "课堂入口：http://localhost:${CAMPUS_PORT}/"
echo '断开外网后仍可使用；停止服务按 Ctrl+C。'
exec python3 -m http.server "$CAMPUS_PORT" --bind 0.0.0.0 --directory dist
