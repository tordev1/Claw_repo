#!/bin/bash
# start-macmini.sh — Start all Mac Mini agents
# Usage: ./scripts/start-macmini.sh
# Run from the api-server directory on the Mac Mini

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$REPO_DIR/api-server"
LOG_DIR="$REPO_DIR/logs/macmini"

export API_URL="${API_URL:-http://192.168.1.86:3001}"
export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
export MACHINE_IP="${MACHINE_IP:-$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')}"
export OLLAMA_MODEL_WORKER="${OLLAMA_MODEL_WORKER:-huihui_ai/qwen3.5-abliterated:9b-Claude}"

mkdir -p "$LOG_DIR"

stop_all() {
    echo "Stopping all Mac Mini agents..."
    kill $(cat "$LOG_DIR"/*.pid 2>/dev/null) 2>/dev/null
    rm -f "$LOG_DIR"/*.pid
    exit 0
}
trap stop_all SIGINT SIGTERM

start_agent() {
    local name="$1"
    local handle="$2"
    local type="${3:-worker}"
    local log_file="$LOG_DIR/${handle}.log"
    local pid_file="$LOG_DIR/${handle}.pid"

    echo "  Starting @${handle} (${type})..."
    node "$AGENT_DIR/agentCLI.js" --name "$name" --handle "$handle" --type "$type" \
        >> "$log_file" 2>&1 &
    echo $! > "$pid_file"
    sleep 1
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   MAC MINI FLEET  —  PROJECT CLAW   ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "API:    $API_URL"
echo "Ollama: $OLLAMA_BASE_URL"
echo "Logs:   $LOG_DIR"
echo ""

# Pull latest code
echo "Pulling latest code..."
cd "$REPO_DIR" && git pull --quiet
echo ""

# Start agents
echo "Starting agents..."
start_agent "Mac Mini 3"   "macmini3"    "worker"
start_agent "Mini Worker 1" "miniworker1" "worker"
start_agent "Mini Worker 2" "miniworker2" "worker"
start_agent "Mini PM"       "minipm"      "pm"

echo ""
echo "✓ All agents started. Logs in $LOG_DIR"
echo "  Press Ctrl+C to stop all agents."
echo ""

# Tail all logs
tail -f "$LOG_DIR"/*.log
