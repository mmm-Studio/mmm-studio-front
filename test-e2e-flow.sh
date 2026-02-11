#!/bin/bash
# =============================================================================
# MMM Studio — Full E2E Flow Validation
# Tests the complete workflow: data → train → analysis → optimization → scenarios
# Validates actual data structures, not just HTTP status codes
# =============================================================================

set -euo pipefail

FRONTEND="https://mmm-studio-front-production.up.railway.app"
BACKEND="https://web-production-5582f.up.railway.app"
SUPABASE_URL="https://nepfouxdbkqrlxuhgcsb.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcGZvdXhkYmtxcmx4dWhnY3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTk4NTQsImV4cCI6MjA4NjAzNTg1NH0.IU7MCS7MIAt9J2nofV6f2RGnDRQqMJbsrXVQjQeuxSA"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0; ERRORS=""

pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); ERRORS="$ERRORS\n  ✗ $1: $2"; echo -e "  ${RED}✗${NC} $1: $2"; }
warn() { ((WARN++)); echo -e "  ${YELLOW}⚠${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# --- Auth ---
if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
  echo -e "${RED}Usage: TEST_EMAIL=you@example.com TEST_PASSWORD=secret $0${NC}"; exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    MMM Studio — Full E2E Flow Validation                 ║"
echo "╚══════════════════════════════════════════════════════════╝"

section "0. Authentication"
TOKEN=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then echo -e "${RED}Auth failed${NC}"; exit 1; fi
pass "Authenticated"

AUTH_HDR="Authorization: Bearer $TOKEN"

# Get org + project
ORG_ID=$(curl -s -H "$AUTH_HDR" "$BACKEND/orgs" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
PROJECT_ID=$(curl -s -H "$AUTH_HDR" "$BACKEND/orgs/$ORG_ID/projects" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
pass "Org: $ORG_ID | Project: $PROJECT_ID"

# =============================================================================
# 1. DATASET UPLOAD — full flow through proxy
# =============================================================================
section "1. Dataset Upload (via proxy, multipart/form-data)"

python3 -c "
import csv, datetime, random
random.seed(42)
rows = []
d = datetime.date(2023, 1, 2)
for i in range(104):  # 2 years of weekly data
    base = 5000 + int(1000 * (i % 52) / 52)
    rows.append([
        d.isoformat(),
        base + random.randint(-500, 500),
        random.randint(200, 800),
        random.randint(100, 400),
        random.randint(50, 300),
        random.randint(0, 200),
    ])
    d += datetime.timedelta(weeks=1)
with open('/tmp/mmm_e2e_dataset.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'sales', 'spend_tv', 'spend_radio', 'spend_digital', 'spend_print'])
    w.writerows(rows)
"
pass "Generated 104-week test CSV (5 cols: sales + 4 spend channels)"

UPLOAD_RESP=$(curl -s -X POST \
  -H "$AUTH_HDR" \
  -F "file=@/tmp/mmm_e2e_dataset.csv" \
  -F "project_id=$PROJECT_ID" \
  -F "name=E2E Test Dataset $(date +%s)" \
  "$FRONTEND/api/backend/orgs/$ORG_ID/datasets/upload")

UPLOAD_DS_ID=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
UPLOAD_STATUS=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
UPLOAD_ROWS=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('row_count',''))" 2>/dev/null || echo "")
UPLOAD_COLS=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('column_names',[])))" 2>/dev/null || echo "0")
UPLOAD_SPEND=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('spend_columns',[])))" 2>/dev/null || echo "[]")
UPLOAD_DATE_COL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('date_column',''))" 2>/dev/null || echo "")
UPLOAD_TARGET=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('target_column',''))" 2>/dev/null || echo "")

if [ -n "$UPLOAD_DS_ID" ]; then
  pass "Upload succeeded: dataset_id=$UPLOAD_DS_ID"
  [ "$UPLOAD_STATUS" = "validated" ] && pass "Status: validated" || fail "Status" "got '$UPLOAD_STATUS'"
  [ "$UPLOAD_ROWS" = "104" ] && pass "Row count: 104" || fail "Row count" "got '$UPLOAD_ROWS'"
  [ "$UPLOAD_COLS" = "6" ] && pass "Column count: 6" || fail "Column count" "got '$UPLOAD_COLS'"
  [ "$UPLOAD_DATE_COL" = "date" ] && pass "Date column detected: date" || fail "Date column" "got '$UPLOAD_DATE_COL'"
  [ "$UPLOAD_TARGET" = "sales" ] && pass "Target column detected: sales" || fail "Target column" "got '$UPLOAD_TARGET'"
  echo "$UPLOAD_SPEND" | python3 -c "
import sys,json
cols = json.load(sys.stdin)
expected = {'spend_tv','spend_radio','spend_digital','spend_print'}
if set(cols) == expected:
    print('  \033[0;32m✓\033[0m Spend columns detected: ' + ', '.join(sorted(cols)))
else:
    print('  \033[0;31m✗\033[0m Spend columns: expected ' + str(expected) + ', got ' + str(set(cols)))
" 2>/dev/null

  # Verify dataset detail + preview via proxy
  PREVIEW_RESP=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/datasets/$UPLOAD_DS_ID?preview_rows=5")
  PREVIEW_ROWS=$(echo "$PREVIEW_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('preview',[])))" 2>/dev/null || echo "0")
  [ "$PREVIEW_ROWS" = "5" ] && pass "Preview returns 5 rows" || fail "Preview" "got $PREVIEW_ROWS rows"
else
  fail "Upload" "$(echo $UPLOAD_RESP | head -c 200)"
fi

# =============================================================================
# 2. TRAINING JOB SUBMISSION
# =============================================================================
section "2. Training Job Submission"

if [ -n "$UPLOAD_DS_ID" ]; then
  TRAIN_RESP=$(curl -s -X POST \
    -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d "{
      \"dataset_id\": \"$UPLOAD_DS_ID\",
      \"name\": \"E2E Test Model\",
      \"spend_columns\": [\"spend_tv\",\"spend_radio\",\"spend_digital\",\"spend_print\"],
      \"date_column\": \"date\",
      \"target_column\": \"sales\",
      \"test_weeks\": 8,
      \"draws\": 100,
      \"tune\": 100,
      \"chains\": 1
    }" \
    "$FRONTEND/api/backend/orgs/$ORG_ID/projects/$PROJECT_ID/train")

  TRAIN_JOB_ID=$(echo "$TRAIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('id','') or d.get('id',''))" 2>/dev/null || echo "")
  TRAIN_STATUS=$(echo "$TRAIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job',{}).get('status','') or d.get('status',''))" 2>/dev/null || echo "")

  if [ -n "$TRAIN_JOB_ID" ]; then
    pass "Training job submitted: job_id=$TRAIN_JOB_ID (status: $TRAIN_STATUS)"

    # Poll for a bit to see if it starts
    sleep 5
    JOB_CHECK=$(curl -s -H "$AUTH_HDR" "$BACKEND/orgs/$ORG_ID/jobs/$TRAIN_JOB_ID")
    JOB_STATUS=$(echo "$JOB_CHECK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
    pass "Job status after 5s: $JOB_STATUS"
    warn "Training takes minutes — skipping wait. Will validate with existing ready model."
  else
    fail "Training submission" "$(echo $TRAIN_RESP | head -c 300)"
  fi
else
  warn "Skipped (no dataset uploaded)"
fi

# =============================================================================
# 3. ANALYSIS — Validate data structures for charts
# =============================================================================
section "3. Analysis Data Validation (existing ready model)"

MODEL_ID=$(curl -s -H "$AUTH_HDR" "$BACKEND/orgs/$ORG_ID/models" | python3 -c "
import sys,json
models = json.load(sys.stdin)
ready = [m for m in models if m.get('status')=='ready']
print(ready[0]['id'] if ready else '')
" 2>/dev/null || echo "")

if [ -z "$MODEL_ID" ]; then
  warn "No ready model found — skipping analysis and optimization tests"
else
  pass "Ready model: $MODEL_ID"

  # --- 3a. ROAS ---
  echo -e "\n  ${CYAN}[ROAS]${NC}"
  ROAS=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/roas")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
roas = d.get('roas_by_channel', {})
summary = d.get('roas_summary', {})

errors = []
if not roas: errors.append('roas_by_channel is empty')
if not summary: errors.append('roas_summary is empty')
for ch, val in roas.items():
    if not isinstance(val, (int, float)): errors.append(f'{ch} ROAS is not numeric: {val}')
    if val < 0: errors.append(f'{ch} ROAS is negative: {val}')
# roas_summary has keys: total_contribution, total_spend, roas — each with per-channel values
for key in ['total_contribution', 'total_spend', 'roas']:
    if key not in summary: errors.append(f'roas_summary missing {key}')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m ROAS: {e}')
else:
    channels = list(roas.keys())
    print(f'  \033[0;32m✓\033[0m ROAS: {len(channels)} channels — {dict(list(roas.items())[:3])}')
    print(f'  \033[0;32m✓\033[0m ROAS summary: has total_contribution, total_spend, roas')
" <<< "$ROAS"

  # --- 3b. CONTRIBUTIONS ---
  echo -e "\n  ${CYAN}[Contributions]${NC}"
  CONTRIB=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/contributions")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
by_ch = d.get('contribution_by_channel', {})
pct = d.get('contribution_percentage', {})
total = d.get('total_contribution', 0)

errors = []
if not by_ch: errors.append('contribution_by_channel is empty')
if not pct: errors.append('contribution_percentage is empty')
if total <= 0: errors.append(f'total_contribution invalid: {total}')
if set(by_ch.keys()) != set(pct.keys()): errors.append('channel keys mismatch between contribution and percentage')
pct_sum = sum(pct.values())
if abs(pct_sum - 100) > 5: errors.append(f'percentages sum to {pct_sum:.1f}%, expected ~100%')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Contributions: {e}')
else:
    print(f'  \033[0;32m✓\033[0m Contributions: {len(by_ch)} channels, total={total:.0f}')
    print(f'  \033[0;32m✓\033[0m Percentages sum to {pct_sum:.1f}%')
    top = sorted(pct.items(), key=lambda x: -x[1])[:3]
    print(f'  \033[0;32m✓\033[0m Top channels: {[(c, round(p,1)) for c,p in top]}')
" <<< "$CONTRIB"

  # --- 3c. CONTRIBUTIONS TIMESERIES ---
  echo -e "\n  ${CYAN}[Contributions Timeseries]${NC}"
  TS=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/contributions/timeseries")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
dates = d.get('dates', [])
channels = d.get('channels', [])
series = d.get('series', {})
target = d.get('target', [])

errors = []
if not dates: errors.append('dates array is empty')
if not channels: errors.append('channels array is empty')
if not series: errors.append('series dict is empty')
if not target: errors.append('target array is empty')

if dates and target:
    if len(dates) != len(target): errors.append(f'dates({len(dates)}) != target({len(target)}) length mismatch')
for ch in channels:
    if ch not in series: errors.append(f'channel {ch} missing from series')
    elif len(series[ch]) != len(dates): errors.append(f'{ch} series length({len(series[ch])}) != dates({len(dates)})')

# Check for NaN/null
for ch, vals in series.items():
    nulls = sum(1 for v in vals if v is None)
    if nulls > 0: errors.append(f'{ch} has {nulls} null values')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Timeseries: {e}')
else:
    print(f'  \033[0;32m✓\033[0m Timeseries: {len(dates)} dates x {len(channels)} channels')
    print(f'  \033[0;32m✓\033[0m All series arrays match dates length')
    print(f'  \033[0;32m✓\033[0m No null values in series')
    print(f'  \033[0;32m✓\033[0m Date range: {dates[0]} to {dates[-1]}')
" <<< "$TS"

  # --- 3d. SPEND VS CONTRIBUTION ---
  echo -e "\n  ${CYAN}[Spend vs Contribution (Efficiency)]${NC}"
  SVC=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/spend-vs-contribution")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
channels = d.get('channels', [])

errors = []
if not channels: errors.append('channels array is empty')

required_keys = ['channel', 'total_spend', 'total_contribution', 'roas', 'spend_share', 'contribution_share']
for ch in channels:
    for key in required_keys:
        if key not in ch: errors.append(f'channel missing key: {key}')

# Check shares sum ~100%
if channels:
    spend_sum = sum(c.get('spend_share',0) for c in channels)
    contrib_sum = sum(c.get('contribution_share',0) for c in channels)
    # Shares are in 0-100 format (percentages)
    if abs(spend_sum - 100) > 5: errors.append(f'spend_share sum={spend_sum:.1f}%, expected ~100%')
    if abs(contrib_sum - 100) > 5: errors.append(f'contribution_share sum={contrib_sum:.1f}%, expected ~100%')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Efficiency: {e}')
else:
    print(f'  \033[0;32m✓\033[0m Efficiency: {len(channels)} channels with all required keys')
    print(f'  \033[0;32m✓\033[0m Spend shares sum to {spend_sum:.1f}%, contribution shares sum to {contrib_sum:.1f}%')
    over = [c for c in channels if c['contribution_share'] > c['spend_share']]
    under = [c for c in channels if c['contribution_share'] < c['spend_share']]
    if over: print(f'  \033[0;32m✓\033[0m Over-performers: {[c["channel"] for c in over]}')
    if under: print(f'  \033[0;32m✓\033[0m Under-performers: {[c["channel"] for c in under]}')
" <<< "$SVC"

  # --- 3e. POSTERIOR ---
  echo -e "\n  ${CYAN}[Posterior Summary]${NC}"
  POST=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/posterior")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
summary = d.get('summary', {})

errors = []
if not summary: errors.append('summary is empty')

params = list(summary.keys())
# Posterior structure: stats (mean, sd, etc.) as top-level keys, params as nested
expected_stats = ['mean', 'sd']
for stat in expected_stats:
    if stat not in summary: errors.append(f'summary missing stat: {stat}')
if 'mean' in summary:
    param_names = list(summary['mean'].keys())
else:
    param_names = []

if errors:
    for e in errors[:5]: print(f'  \033[0;31m✗\033[0m Posterior: {e}')
else:
    stats_found = [s for s in summary.keys()]
    print(f'  \033[0;32m✓\033[0m Posterior summary: {len(stats_found)} stats x {len(param_names)} parameters')
    print(f'  \033[0;32m✓\033[0m Stats: {stats_found}')
    print(f'  \033[0;32m✓\033[0m Sample params: {param_names[:5]}')
" <<< "$POST"

  # =============================================================================
  # 4. OPTIMIZATION — Validate results
  # =============================================================================
  section "4. Optimization Results Validation"

  # Get model dates
  MODEL_DETAIL=$(curl -s -H "$AUTH_HDR" "$BACKEND/orgs/$ORG_ID/models/$MODEL_ID")
  START_DATE=$(echo "$MODEL_DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('start_date',''))")
  END_DATE=$(echo "$MODEL_DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('end_date',''))")
  SPEND_COLS=$(echo "$MODEL_DETAIL" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('spend_columns',[])))")
  pass "Model range: $START_DATE to $END_DATE"

  # --- 4a. Historical optimization ---
  echo -e "\n  ${CYAN}[Historical Optimization]${NC}"
  HIST=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d "{\"start_date\":\"$START_DATE\",\"end_date\":\"$END_DATE\",\"budget_bounds_pct\":0.3}" \
    "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/historical")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
orig = d.get('original_spend', {})
opt = d.get('optimized_spend', {})
mult = d.get('multipliers', {})
orig_resp = d.get('original_response', 0)
opt_resp = d.get('optimized_response', 0)
uplift = d.get('uplift_pct', 0)

errors = []
if not orig: errors.append('original_spend is empty')
if not opt: errors.append('optimized_spend is empty')
if set(orig.keys()) != set(opt.keys()): errors.append('channel keys mismatch between original and optimized')
if orig_resp <= 0: errors.append(f'original_response invalid: {orig_resp}')
if opt_resp <= 0: errors.append(f'optimized_response invalid: {opt_resp}')

# Verify budget constraint: total spend should be similar
orig_total = sum(orig.values())
opt_total = sum(opt.values())
pct_diff = abs(opt_total - orig_total) / orig_total * 100 if orig_total > 0 else 0
# With budget_bounds_pct=0.3, up to 30% per-channel shift is allowed, total can shift too
if pct_diff > 35: errors.append(f'Budget not preserved: orig={orig_total:.0f}, opt={opt_total:.0f} ({pct_diff:.1f}% diff)')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Historical: {e}')
else:
    print(f'  \033[0;32m✓\033[0m Historical: {len(orig)} channels optimized')
    print(f'  \033[0;32m✓\033[0m Original response: {orig_resp:,.0f} → Optimized: {opt_resp:,.0f} (uplift: {uplift:.1f}%)')
    print(f'  \033[0;32m✓\033[0m Budget preserved: {orig_total:,.0f} vs {opt_total:,.0f} ({pct_diff:.1f}% diff)')
    # Show top reallocation
    changes = [(ch, (opt[ch]-orig[ch])/orig[ch]*100) for ch in orig if orig[ch] > 0]
    changes.sort(key=lambda x: -x[1])
    if changes:
        print(f'  \033[0;32m✓\033[0m Top increase: {changes[0][0]} (+{changes[0][1]:.0f}%)')
        print(f'  \033[0;32m✓\033[0m Top decrease: {changes[-1][0]} ({changes[-1][1]:.0f}%)')
" <<< "$HIST"

  # --- 4b. Budget optimization ---
  echo -e "\n  ${CYAN}[Budget Optimization]${NC}"
  BUDGET=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d '{"total_budget":50000,"num_weeks":4}' \
    "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/budget")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
baseline = d.get('baseline_per_week', {})
optimal = d.get('optimal_per_week', {})
optimal_total = d.get('optimal_total', {})
change = d.get('change_pct', {})
exp_resp = d.get('expected_response', 0)
exp_roas = d.get('expected_roas', 0)

errors = []
if not baseline: errors.append('baseline_per_week is empty')
if not optimal: errors.append('optimal_per_week is empty')
if not optimal_total: errors.append('optimal_total is empty')
# expected_response can be a dict {mean, ci_5, ci_95} or a number
if isinstance(exp_resp, dict):
    exp_resp_val = exp_resp.get('mean', 0)
else:
    exp_resp_val = exp_resp
if exp_resp_val <= 0: errors.append(f'expected_response invalid: {exp_resp}')
if not isinstance(exp_roas, (int, float)) or exp_roas <= 0: errors.append(f'expected_roas invalid: {exp_roas}')

# Verify budget constraint
total_allocated = sum(optimal_total.values())
if abs(total_allocated - 50000) > 5000: errors.append(f'Budget not respected: allocated {total_allocated:.0f} vs 50000')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Budget: {e}')
else:
    print(f'  \033[0;32m✓\033[0m Budget: {len(optimal)} channels allocated')
    print(f'  \033[0;32m✓\033[0m Total allocated: \${total_allocated:,.0f} / \$50,000')
    print(f'  \033[0;32m✓\033[0m Expected response: {exp_resp:,.0f} (ROAS: {exp_roas:.2f}x)')
    top = sorted(optimal_total.items(), key=lambda x: -x[1])
    print(f'  \033[0;32m✓\033[0m Top allocation: {top[0][0]}=\${top[0][1]:,.0f}, {top[1][0]}=\${top[1][1]:,.0f}')
" <<< "$BUDGET"

  # --- 4c. Period comparison ---
  echo -e "\n  ${CYAN}[Period Comparison]${NC}"
  MID_DATE=$(python3 -c "
from datetime import datetime
s=datetime.strptime('$START_DATE','%Y-%m-%d')
e=datetime.strptime('$END_DATE','%Y-%m-%d')
mid=s+(e-s)//2
print(mid.strftime('%Y-%m-%d'))
")
  COMPARE=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d "{\"period1_start\":\"$START_DATE\",\"period1_end\":\"$MID_DATE\",\"period2_start\":\"$MID_DATE\",\"period2_end\":\"$END_DATE\"}" \
    "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/optimize/compare")
  python3 -c "
import sys, json
d = json.load(sys.stdin)
p1 = d.get('period1', {})
p2 = d.get('period2', {})
comp = d.get('comparison', {})

errors = []
if not p1: errors.append('period1 is empty')
if not p2: errors.append('period2 is empty')

# Check the nested structure the frontend expects
p1_spend = p1.get('spend_by_channel', {})
p2_spend = p2.get('spend_by_channel', {})
p1_resp = p1.get('total_response', 0)
p2_resp = p2.get('total_response', 0)

if not p1_spend and not d.get('period1_spend'):
    errors.append('period1 has no spend_by_channel')
if p1_resp <= 0 and not d.get('period1_response'):
    errors.append(f'period1 total_response invalid: {p1_resp}')

if errors:
    for e in errors: print(f'  \033[0;31m✗\033[0m Compare: {e}')
else:
    p1t = sum(p1_spend.values()) if p1_spend else 0
    p2t = sum(p2_spend.values()) if p2_spend else 0
    print(f'  \033[0;32m✓\033[0m Compare: {len(p1_spend)} channels in each period')
    print(f'  \033[0;32m✓\033[0m P1 spend: \${p1t:,.0f}, response: {p1_resp:,.0f}')
    print(f'  \033[0;32m✓\033[0m P2 spend: \${p2t:,.0f}, response: {p2_resp:,.0f}')
    if p1_resp > 0:
        change = (p2_resp - p1_resp) / p1_resp * 100
        print(f'  \033[0;32m✓\033[0m Response change: {change:+.1f}%')
" <<< "$COMPARE"

  # =============================================================================
  # 5. SCENARIOS — Save, verify, delete
  # =============================================================================
  section "5. Scenarios CRUD"

  SAVE_RESP=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
    -d "{\"name\":\"E2E Flow Test Scenario\",\"type\":\"budget\",\"input_params\":{\"total_budget\":50000,\"num_weeks\":4},\"results\":$BUDGET}" \
    "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/scenarios")
  SCENARIO_ID=$(echo "$SAVE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if [ -n "$SCENARIO_ID" ]; then
    pass "Scenario saved: $SCENARIO_ID"

    # Verify it appears in list
    LIST_RESP=$(curl -s -H "$AUTH_HDR" "$FRONTEND/api/backend/orgs/$ORG_ID/models/$MODEL_ID/scenarios")
    FOUND=$(echo "$LIST_RESP" | python3 -c "import sys,json; print(any(s['id']=='$SCENARIO_ID' for s in json.load(sys.stdin)))" 2>/dev/null)
    [ "$FOUND" = "True" ] && pass "Scenario found in list" || fail "Scenario list" "Not found in list"

    # Delete
    DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_HDR" \
      "$FRONTEND/api/backend/orgs/$ORG_ID/scenarios/$SCENARIO_ID")
    [ "$DEL_STATUS" = "200" ] && pass "Scenario deleted" || fail "Scenario delete" "HTTP $DEL_STATUS"
  else
    fail "Scenario save" "$(echo $SAVE_RESP | head -c 200)"
  fi
fi

# =============================================================================
# 6. CLEANUP
# =============================================================================
section "6. Cleanup"

# Delete test dataset
if [ -n "${UPLOAD_DS_ID:-}" ]; then
  DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_HDR" \
    "$BACKEND/orgs/$ORG_ID/datasets/$UPLOAD_DS_ID")
  [ "$DEL" = "200" ] && pass "Test dataset deleted" || warn "Dataset cleanup: HTTP $DEL"
fi

rm -f /tmp/mmm_e2e_dataset.csv /tmp/mmm_test_body

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              E2E FLOW VALIDATION RESULTS                 ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo -e "║  ${GREEN}Passed:   $PASS${NC}                                          ║"
echo -e "║  ${RED}Failed:   $FAIL${NC}                                          ║"
echo -e "║  ${YELLOW}Warnings: $WARN${NC}                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}FAILURES:${NC}$ERRORS"
fi

exit $FAIL
