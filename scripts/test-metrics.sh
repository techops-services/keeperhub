#!/bin/bash
# Test Metrics Generator
#
# This script triggers errors to generate metrics data for Grafana dashboard development.
# It can target local dev, PR environments, or staging.
#
# Usage:
#   ./scripts/test-metrics.sh                           # Target localhost:3000
#   ./scripts/test-metrics.sh https://app-pr-123.keeperhub.com
#   ./scripts/test-metrics.sh --all --count 50          # Generate lots of data
#   ./scripts/test-metrics.sh --category validation --count 10

set -e

# Default values
BASE_URL="${1:-http://localhost:3000}"
CATEGORY=""
COUNT=1
INTERVAL=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --count)
      COUNT="$2"
      shift 2
      ;;
    --interval)
      INTERVAL="$2"
      shift 2
      ;;
    --all)
      CATEGORY=""
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [BASE_URL] [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --category <name>    Trigger specific error category"
      echo "  --count <n>          Number of times to trigger (default: 1)"
      echo "  --interval <s>       Seconds between triggers (default: 0)"
      echo "  --all                Trigger all categories (default)"
      echo "  -h, --help           Show this help"
      echo ""
      echo "Categories:"
      echo "  validation, configuration, external_service, network_rpc,"
      echo "  transaction, database, auth, infrastructure, workflow_engine"
      echo ""
      echo "Examples:"
      echo "  $0                                                    # Local, all categories, once"
      echo "  $0 --category validation --count 10                  # Validation errors 10 times"
      echo "  $0 https://app-pr-123.keeperhub.com --all --count 50 # PR env, all categories, 50 times"
      echo "  $0 --category external_service --count 20 --interval 1  # 20 times with 1s delay"
      exit 0
      ;;
    *)
      BASE_URL="$1"
      shift
      ;;
  esac
done

# Remove trailing slash from URL
BASE_URL="${BASE_URL%/}"

ENDPOINT="${BASE_URL}/api/test/trigger-errors"

echo "========================================="
echo "Metrics Test Data Generator"
echo "========================================="
echo "Target:   ${BASE_URL}"
echo "Category: ${CATEGORY:-all}"
echo "Count:    ${COUNT}"
echo "Interval: ${INTERVAL}s"
echo "========================================="
echo ""

# Build query parameters
PARAMS=""
if [ -n "$CATEGORY" ]; then
  PARAMS="?category=${CATEGORY}"
  if [ "$COUNT" -gt 1 ]; then
    PARAMS="${PARAMS}&count=${COUNT}"
  fi
else
  if [ "$COUNT" -gt 1 ]; then
    PARAMS="?count=${COUNT}"
  fi
fi

# Single trigger if count is 1 and no interval
if [ "$COUNT" -eq 1 ] && [ "$INTERVAL" -eq 0 ]; then
  echo "Triggering errors..."
  curl -X POST "${ENDPOINT}${PARAMS}" \
    -H "Content-Type: application/json" \
    -s | jq '.'

  echo ""
  echo "Done! Check metrics at: ${BASE_URL}/api/metrics"
  echo ""
  echo "Example queries:"
  echo "  curl ${BASE_URL}/api/metrics | grep errors_"
  echo "  curl ${BASE_URL}/api/metrics | grep keeperhub_errors"
  exit 0
fi

# Multiple triggers with interval
echo "Triggering errors ${COUNT} time(s) with ${INTERVAL}s interval..."
echo ""

for i in $(seq 1 "$COUNT"); do
  echo "[$i/$COUNT] Triggering..."

  RESPONSE=$(curl -X POST "${ENDPOINT}${PARAMS}" \
    -H "Content-Type: application/json" \
    -s)

  # Check if successful
  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    TRIGGERED=$(echo "$RESPONSE" | jq -r '.triggered | join(", ")')
    echo "  ✓ Triggered: ${TRIGGERED}"
  else
    echo "  ✗ Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
  fi

  # Wait between triggers (except on last iteration)
  if [ "$i" -lt "$COUNT" ] && [ "$INTERVAL" -gt 0 ]; then
    sleep "$INTERVAL"
  fi
done

echo ""
echo "========================================="
echo "Done! Generated test metrics data."
echo "========================================="
echo ""
echo "View metrics:"
echo "  curl ${BASE_URL}/api/metrics | grep errors_"
echo ""
echo "View in Prometheus (if configured):"
echo "  sum by (error_category) (rate(keeperhub_errors_external_service_total[5m]))"
echo ""
echo "Build your Grafana dashboard using these metrics!"
