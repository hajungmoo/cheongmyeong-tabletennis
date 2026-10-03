#!/usr/bin/env bash
# Old deployment entry point must not reactivate the retired app.
set -euo pipefail
notice_backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$notice_backend_dir/retire.sh"
