#!/bin/bash
# Run the kanban-gantt backend tests in an ISOLATED uv venv (pytest not
# installable into the system hermes venv, which is root-owned).
# The venv gets pytest + the same fastapi/httpx stack; hermes_cli comes from
# the hermes-agent checkout via PYTHONPATH (it only needs stdlib + sqlite).
#
# Paths (override via env):
#   HERMES_AGENT_HOME — hermes-agent checkout containing hermes_cli/
#                       (default: try ~/.hermes/hermes-agent, then
#                        /opt/data/git/hermes-agent — the container path)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for _cand in "${HERMES_AGENT_HOME:-}" "$HOME/.hermes/hermes-agent" /opt/data/git/hermes-agent; do
  if [ -n "$_cand" ] && [ -d "$_cand/hermes_cli" ]; then
    HERMES_AGENT_HOME="$_cand"
    break
  fi
done
VENV=/tmp/kg-test-venv
if [ ! -x "$VENV/bin/python" ]; then
  uv venv "$VENV" --python 3.13
  uv pip install --python "$VENV/bin/python" pytest fastapi httpx uvicorn pydantic pyyaml
fi
if [ ! -d "$HERMES_AGENT_HOME/hermes_cli" ]; then
  echo "ERROR: hermes_cli not found in $HERMES_AGENT_HOME" >&2
  echo "Set HERMES_AGENT_HOME to your hermes-agent checkout." >&2
  exit 1
fi
export PYTHONPATH="$HERMES_AGENT_HOME:${PYTHONPATH:-}"
unset HERMES_DELEGATED_CHILD_CONTEXT
unset HERMES_KANBAN_DB
unset HERMES_KANBAN_BOARD
cd "$SCRIPT_DIR"
exec "$VENV/bin/python" -m pytest test_plugin_api.py "$@"
