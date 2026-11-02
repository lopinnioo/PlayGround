#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
BUILD_DIR="$PROJECT_DIR/dist"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "PORT must be an integer from 1 to 65535 (got: $PORT)." >&2
  exit 1
fi
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must point to the worker metadata directory}"

if [[ -f package.json ]]; then
  /usr/bin/time -p npm install --ignore-scripts --no-audit --no-fund
fi

/usr/bin/time -p mkdir -p "$BUILD_DIR"
/usr/bin/time -p cp index.html game.js style.css "$BUILD_DIR/"
/usr/bin/time -p test -s "$BUILD_DIR/index.html"
/usr/bin/time -p test -s "$BUILD_DIR/game.js"
/usr/bin/time -p test -s "$BUILD_DIR/style.css"

/usr/bin/time -p env PROJECT_DIR="$PROJECT_DIR" BUILD_DIR="$BUILD_DIR" OPENCODE_WEB_DIR="$OPENCODE_WEB_DIR" node --input-type=commonjs -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const project = path.resolve(process.env.PROJECT_DIR);
  const directory = path.resolve(process.env.BUILD_DIR);
  if (!directory.startsWith(project + path.sep)) throw new Error("Built directory must be inside the project.");
  fs.mkdirSync(process.env.OPENCODE_WEB_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR, "deployment-output.json"), JSON.stringify({ project, directory }, null, 2) + "\n");
'

exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$BUILD_DIR"
