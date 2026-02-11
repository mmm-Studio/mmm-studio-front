#!/bin/bash
# =============================================================================
# MMM Studio — Production E2E Test Script
# Tests frontend proxy → backend connectivity for all API endpoints
# =============================================================================

set -euo pipefail

FRONTEND="https://mmm-studio-front-production.up.railway.app"
BACKEND="https://web-production-5582f.up.railway.app"
SUPABASE_URL="https://nepfouxdbkqrlxuhgcsb.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcGZvdXhkYmtxcmx4dWhnY3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTk4NTQsImV4cCI6MjA4NjAzNTg1NH0.IU7MCS7MIAt9J2nofV6f2RGnDRQqMJbsrXVQjQeuxSA"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
ERRORS=""

# --- Helpers ---
pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); ERRORS="$ERRORS\n  ✗ $1: $2"; echo -e "  ${RED}✗${NC} $1: $2"; }
warn() { ((WARN++)); echo -e "  ${YELLOW}⚠${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# --- Auth ---
get_token() {
  if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
    echo -e "${RED}ERROR: Set TEST_EMAIL and TEST_PASSWORD env vars${NC}"
    echo "Usage: TEST_EMAIL=you@example.com TEST_PASSWORD=secret ./test-production.sh"
    exit 1
  fi

  echo -e "${CYAN}Authenticating as ${TEST_EMAIL}...${NC}"
  AUTH_RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

  TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

  if [ -z "$TOKEN" ]; then
    echo -e "${RED}Authentication failed:${NC}"
    echo "$AUTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AUTH_RESPONSE"
    exit 1
  fi
  echo -e "${GREEN}Authenticated successfully${NC}"
}

# --- Test helper: expects HTTP status ---
test_endpoint() {
  local METHOD="$1"
  local URL="$2"
  local LABEL="$3"
  local EXPECTED="${4:-200}"
  local BODY="${5:-}"

  local CURL_ARGS=(-s -o /tmp/mmm_test_body -w "%{http_code}" -X "$METHOD")
  CURL_ARGS+=(-H "Authorization: Bearer ${TOKEN}")
  CURL_ARGS+=(-H "Content-Type: application/json")

  if [ -n "$BODY" ]; then
    CURL_ARGS+=(-d "$BODY")
  fi

  local STATUS
  STATUS=$(curl "${CURL_ARGS[@]}" "$URL")
  local RESPONSE
  RESPONSE=$(cat /tmp/mmm_test_body)

  if [ "$STATUS" = "$EXPECTED" ]; then
    pass "$LABEL (HTTP $STATUS)"
  else
    local DETAIL
    DETAIL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('detail','')[:120])" 2>/dev/null || echo "${RESPONSE:0:120}")
    fail "$LABEL" "expected $EXPECTED, got $STATUS — $DETAIL"
  fi
}

# =============================================================================
# TESTS START
# =============================================================================

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     MMM Studio — Production E2E Tests                   ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ----- 1. Infrastructure -----
section "1. Infrastructure"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/login")
[ "$STATUS" = "200" ] && pass "Frontend serves /login (HTTP $STATUS)" || fail "Frontend /login" "HTTP $STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/health")
[ "$STATUS" = "200" ] && pass "Backend /health (HTTP $STATUS)" || fail "Backend /health" "HTTP $STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/api/backend/health")
[ "$STATUS" = "200" ] && pass "Proxy /api/backend/health (HTTP $STATUS)" || fail "Proxy /health" "HTTP $STATUS"

# Test proxy returns proper error for unauth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/api/backend/auth/me")
[ "$STATUS" = "401" ] && pass "Proxy returns 401 for unauth /auth/me" || warn "Proxy unauth /auth/me returned $STATUS (expected 401)"

# ----- 2. Authentication -----
section "2. Authentication"
get_token

test_endpoint GET "$FRONTEND/api/backend/auth/me" "GET /auth/me via proxy"
test_endpoint GET "$BACKEND/auth/me" "GET /auth/me direct backend"

# Extract user info
USER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/auth/me" | python3 -c "import sys,json; print(json.load(sys.stdin)['user_id'])" 2>/dev/null || echo "")
if [ -n "$USER_ID" ]; then
  pass "User ID extracted: ${USER_ID:0:8}..."
else
  fail "User ID extraction" "Could not extract user_id from /auth/me"
fi

# ----- 3. Organizations -----
section "3. Organizations"
test_endpoint GET "$FRONTEND/api/backend/orgs" "GET /orgs via proxy"
test_endpoint GET "$BACKEND/orgs" "GET /orgs direct"

# Extract first org
ORG_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs" | python3 -c "import sys,json; orgs=json.load(sys.stdin); print(orgs[0]['id'] if orgs else '')" 2>/dev/null || echo "")
if [ -n "$ORG_ID" ]; then
  pass "Org ID extracted: ${ORG_ID:0:8}..."
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID" "GET /orgs/{id} via proxy"
else
  warn "No organizations found — skipping org-dependent tests"
fi

# ----- 4. Members -----
section "4. Members"
if [ -n "$ORG_ID" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/members" "GET /orgs/{id}/members via proxy"
  test_endpoint GET "$BACKEND/orgs/$ORG_ID/members" "GET /orgs/{id}/members direct"
else
  warn "Skipped (no org)"
fi

# ----- 5. Projects -----
section "5. Projects"
if [ -n "$ORG_ID" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/projects" "GET /orgs/{id}/projects via proxy"

  # Extract first project
  PROJECT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs/$ORG_ID/projects" | python3 -c "import sys,json; p=json.load(sys.stdin); print(p[0]['id'] if p else '')" 2>/dev/null || echo "")
  if [ -n "$PROJECT_ID" ]; then
    pass "Project ID extracted: ${PROJECT_ID:0:8}..."
    test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/projects/$PROJECT_ID" "GET /orgs/{id}/projects/{id} via proxy"
  else
    warn "No projects found"
  fi
else
  warn "Skipped (no org)"
fi

# ----- 6. Datasets -----
section "6. Datasets"
if [ -n "$ORG_ID" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/datasets" "GET /orgs/{id}/datasets via proxy"

  DATASET_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs/$ORG_ID/datasets" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null || echo "")
  if [ -n "$DATASET_ID" ]; then
    pass "Dataset ID extracted: ${DATASET_ID:0:8}..."
    test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/datasets/$DATASET_ID?preview_rows=5" "GET /datasets/{id} with preview via proxy"
  else
    warn "No datasets found"
  fi

  # Test file upload via proxy (create a valid test CSV with 30 weekly rows)
  python3 -c "
import csv, datetime, random
rows = []
d = datetime.date(2024, 1, 1)
for i in range(30):
    rows.append([d.isoformat(), random.randint(800,1500), random.randint(100,400), random.randint(50,200)])
    d += datetime.timedelta(weeks=1)
with open('/tmp/mmm_test_upload.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date','target','spend_tv','spend_radio'])
    w.writerows(rows)
"

  if [ -n "$PROJECT_ID" ]; then
    UPLOAD_STATUS=$(curl -s -o /tmp/mmm_test_body -w "%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@/tmp/mmm_test_upload.csv" \
      -F "project_id=$PROJECT_ID" \
      -F "name=test_upload_$(date +%s)" \
      "$FRONTEND/api/backend/orgs/$ORG_ID/datasets/upload")

    if [ "$UPLOAD_STATUS" = "200" ] || [ "$UPLOAD_STATUS" = "201" ]; then
      pass "POST /datasets/upload via proxy (multipart) — HTTP $UPLOAD_STATUS"
      # Clean up: extract uploaded dataset ID and delete it
      UPLOAD_DS_ID=$(cat /tmp/mmm_test_body | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
      if [ -n "$UPLOAD_DS_ID" ]; then
        DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
          -H "Authorization: Bearer $TOKEN" \
          "$BACKEND/orgs/$ORG_ID/datasets/$UPLOAD_DS_ID")
        [ "$DEL_STATUS" = "200" ] && pass "DELETE test dataset (cleanup)" || warn "Cleanup delete returned $DEL_STATUS"
      fi
    else
      DETAIL=$(cat /tmp/mmm_test_body | head -c 200)
      fail "POST /datasets/upload via proxy" "HTTP $UPLOAD_STATUS — $DETAIL"
    fi
  else
    warn "Skipped upload test (no project)"
  fi
else
  warn "Skipped (no org)"
fi

# ----- 7. Jobs -----
section "7. Training Jobs"
if [ -n "$ORG_ID" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/jobs" "GET /orgs/{id}/jobs via proxy"
  test_endpoint GET "$BACKEND/orgs/$ORG_ID/jobs" "GET /orgs/{id}/jobs direct"
else
  warn "Skipped (no org)"
fi

# ----- 8. Models -----
section "8. Models"
if [ -n "$ORG_ID" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models" "GET /orgs/{id}/models via proxy"

  MODEL_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs/$ORG_ID/models" | python3 -c "
import sys,json
models=json.load(sys.stdin)
ready = [m for m in models if m.get('status')=='ready']
print(ready[0]['id'] if ready else (models[0]['id'] if models else ''))
" 2>/dev/null || echo "")

  MODEL_STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs/$ORG_ID/models" | python3 -c "
import sys,json
models=json.load(sys.stdin)
ready = [m for m in models if m.get('status')=='ready']
print(ready[0]['status'] if ready else (models[0]['status'] if models else 'none'))
" 2>/dev/null || echo "none")

  if [ -n "$MODEL_ID" ]; then
    pass "Model ID extracted: ${MODEL_ID:0:8}... (status: $MODEL_STATUS)"
    test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID" "GET /models/{id} via proxy"
  else
    warn "No models found"
  fi
else
  warn "Skipped (no org)"
fi

# ----- 9. Analysis (requires ready model) -----
section "9. Analysis"
if [ -n "${MODEL_ID:-}" ] && [ "$MODEL_STATUS" = "ready" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/roas" "GET /models/{id}/roas via proxy"
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/contributions" "GET /models/{id}/contributions via proxy"
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/contributions/timeseries" "GET /models/{id}/contributions/timeseries via proxy"
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/spend-vs-contribution" "GET /models/{id}/spend-vs-contribution via proxy"
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/posterior" "GET /models/{id}/posterior via proxy"

  # Also test direct backend
  test_endpoint GET "$BACKEND/orgs/$ORG_ID/models/$MODEL_ID/roas" "GET /models/{id}/roas direct"
  test_endpoint GET "$BACKEND/orgs/$ORG_ID/models/$MODEL_ID/contributions" "GET /models/{id}/contributions direct"
else
  if [ "$MODEL_STATUS" != "ready" ]; then
    warn "Skipped analysis tests (model status: $MODEL_STATUS, need 'ready')"
  else
    warn "Skipped (no model)"
  fi
fi

# ----- 10. Optimization (requires ready model) -----
section "10. Optimization"
if [ -n "${MODEL_ID:-}" ] && [ "$MODEL_STATUS" = "ready" ]; then
  # Get model dates for optimization
  MODEL_DATES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/orgs/$ORG_ID/models/$MODEL_ID" | python3 -c "
import sys,json
m=json.load(sys.stdin)
print(m.get('start_date',''), m.get('end_date',''))
" 2>/dev/null || echo "")

  START_DATE=$(echo "$MODEL_DATES" | awk '{print $1}')
  END_DATE=$(echo "$MODEL_DATES" | awk '{print $2}')

  if [ -n "$START_DATE" ] && [ -n "$END_DATE" ]; then
    pass "Model date range: $START_DATE to $END_DATE"

    # Historical optimization
    test_endpoint POST "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/historical" \
      "POST /optimize/historical via proxy" \
      200 \
      "{\"start_date\":\"$START_DATE\",\"end_date\":\"$END_DATE\",\"budget_bounds_pct\":0.3}"

    # Budget optimization
    test_endpoint POST "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/budget" \
      "POST /optimize/budget via proxy" \
      200 \
      '{"total_budget":50000,"num_weeks":4}'

    # Period comparison
    # Use first half and second half of the date range
    MID_DATE=$(python3 -c "
from datetime import datetime
s=datetime.strptime('$START_DATE','%Y-%m-%d')
e=datetime.strptime('$END_DATE','%Y-%m-%d')
mid=s+(e-s)//2
print(mid.strftime('%Y-%m-%d'))
" 2>/dev/null || echo "")

    if [ -n "$MID_DATE" ]; then
      test_endpoint POST "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/compare" \
        "POST /optimize/compare via proxy" \
        200 \
        "{\"period1_start\":\"$START_DATE\",\"period1_end\":\"$MID_DATE\",\"period2_start\":\"$MID_DATE\",\"period2_end\":\"$END_DATE\"}"
    fi
  else
    warn "Could not extract model dates"
  fi
else
  warn "Skipped (no ready model)"
fi

# ----- 11. Scenarios -----
section "11. Scenarios"
if [ -n "${MODEL_ID:-}" ]; then
  test_endpoint GET "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/scenarios" "GET /models/{id}/scenarios via proxy"

  # Save a test scenario
  SAVE_STATUS=$(curl -s -o /tmp/mmm_test_body -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"E2E Test Scenario","type":"budget","input_params":{"test":true},"results":{"test":true}}' \
    "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/scenarios")

  if [ "$SAVE_STATUS" = "200" ] || [ "$SAVE_STATUS" = "201" ]; then
    pass "POST /scenarios (save) via proxy — HTTP $SAVE_STATUS"
    SCENARIO_ID=$(cat /tmp/mmm_test_body | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
    if [ -n "$SCENARIO_ID" ]; then
      # Delete test scenario
      test_endpoint DELETE "$FRONTEND/api/backend/orgs/$ORG_ID/scenarios/$SCENARIO_ID" "DELETE /scenarios/{id} via proxy"
    fi
  else
    DETAIL=$(cat /tmp/mmm_test_body | head -c 200)
    fail "POST /scenarios via proxy" "HTTP $SAVE_STATUS — $DETAIL"
  fi
else
  warn "Skipped (no model)"
fi

# ----- 12. Frontend Pages -----
section "12. Frontend Pages (HTML status)"
for PAGE in "/" "/login" "/signup" "/dashboard" "/projects" "/datasets" "/jobs" "/models" "/optimization" "/results" "/settings" "/orgs/new"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND$PAGE")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ]; then
    pass "GET $PAGE — HTTP $STATUS"
  else
    fail "GET $PAGE" "HTTP $STATUS"
  fi
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    TEST RESULTS                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo -e "║  ${GREEN}Passed:  $PASS${NC}                                           ║"
echo -e "║  ${RED}Failed:  $FAIL${NC}                                           ║"
echo -e "║  ${YELLOW}Warnings: $WARN${NC}                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}FAILURES:${NC}$ERRORS"
fi

# Cleanup
rm -f /tmp/mmm_test_body /tmp/mmm_test_upload.csv

exit $FAIL
