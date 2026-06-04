#!/bin/bash
# ═══════════════════════════════════════════
# FlowOS — API E2E Test Suite (macOS compatible)
# ═══════════════════════════════════════════

set +e

API="http://localhost:4000/api"
PASS=0
FAIL=0
SKIP=0
FAILS=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper: make request and capture code + body
do_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local auth="${4:-}"
  
  local curl_args=(-s -o /tmp/flowos_resp_body -w "%{http_code}" -X "$method" "$url")
  [ -n "$auth" ] && curl_args+=(-H "Authorization: Bearer $auth")
  curl_args+=(-H "Content-Type: application/json")
  [ -n "$data" ] && curl_args+=(-d "$data")
  
  HTTP_CODE=$(curl "${curl_args[@]}" 2>/dev/null)
  HTTP_BODY=$(cat /tmp/flowos_resp_body 2>/dev/null || echo "")
}

assert_status() {
  local test_name="$1"
  local expected="$2"
  
  if [ "$HTTP_CODE" == "$expected" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} $test_name (HTTP $HTTP_CODE)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}❌ FAIL${NC} $test_name (expected $expected, got $HTTP_CODE)"
    echo -e "       Body: ${HTTP_BODY:0:200}"
    FAIL=$((FAIL + 1))
    FAILS="${FAILS}\n  • $test_name (expected=$expected got=$HTTP_CODE)"
  fi
}

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  FlowOS API E2E Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# ═══ Health Tests ═══
echo -e "${YELLOW}▸ Health Tests${NC}"

do_request GET "$API/health/live"
assert_status "Liveness probe" "200"

do_request GET "$API/health/ready"
assert_status "Readiness probe" "200"

do_request GET "$API/health"
assert_status "Detailed health" "200"

echo ""

# ═══ Auth Tests ═══
echo -e "${YELLOW}▸ Auth Tests${NC}"

TEST_EMAIL="testuser_$(date +%s)@flowos.io"
TEST_PASSWORD="TestPass123!"

# Register
do_request POST "$API/auth/register" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"fullName\":\"Test User\"}"
assert_status "Register new user" "201"
USER_TOKEN=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")
USER_ID=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null || echo "")

# Register duplicate
do_request POST "$API/auth/register" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
assert_status "Register duplicate email" "409"

# Login correct
do_request POST "$API/auth/login" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
assert_status "Login correct credentials" "201"
USER_TOKEN=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "$USER_TOKEN")

# Login wrong password
do_request POST "$API/auth/login" "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpass\"}"
assert_status "Login wrong password" "401"

# Login nonexistent email
do_request POST "$API/auth/login" "{\"email\":\"notexist@flowos.io\",\"password\":\"pass\"}"
assert_status "Login nonexistent email" "401"

# Unauthorized access
do_request GET "$API/user/profile"
assert_status "Unauthorized (no token)" "401"

echo ""

# ═══ Admin Login ═══
echo -e "${YELLOW}▸ Admin Auth${NC}"
do_request POST "$API/auth/login" "{\"email\":\"admin@flowos.io\",\"password\":\"FlowOS2026!\"}"
assert_status "Admin login" "201"
ADMIN_TOKEN=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")

echo ""

# ═══ Template Tests ═══
echo -e "${YELLOW}▸ Template Tests${NC}"

do_request GET "$API/templates" "" "$USER_TOKEN"
assert_status "List templates" "200"
TEMPLATE_ID=$(echo "$HTTP_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
tpls=d.get('templates',[]) if isinstance(d,dict) else d
print(tpls[0]['id'] if tpls else '')
" 2>/dev/null || echo "")

do_request GET "$API/templates/categories" "" "$USER_TOKEN"
assert_status "List categories" "200"
FIRST_CAT_ID=$(echo "$HTTP_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cats=d if isinstance(d,list) else []
print(cats[0]['id'] if cats else '')
" 2>/dev/null || echo "")

if [ -n "$TEMPLATE_ID" ]; then
  do_request GET "$API/templates/$TEMPLATE_ID" "" "$USER_TOKEN"
  assert_status "Get template detail" "200"
fi

echo ""

# ═══ Automation Tests ═══
echo -e "${YELLOW}▸ Automation Tests${NC}"

if [ -n "$TEMPLATE_ID" ]; then
  do_request POST "$API/automations/run" "{\"templateId\":\"$TEMPLATE_ID\",\"inputs\":{\"message\":\"Hello FlowOS\"}}" "$USER_TOKEN"
  assert_status "Run automation (valid)" "201"
  EXEC_ID=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('executionId',''))" 2>/dev/null || echo "")

  do_request POST "$API/automations/run" "{\"templateId\":\"$TEMPLATE_ID\",\"inputs\":{}}" "$USER_TOKEN"
  assert_status "Run automation (missing required)" "400"
fi

do_request GET "$API/automations/history" "" "$USER_TOKEN"
assert_status "Automation history" "200"

echo ""

# ═══ Execution Tests ═══
echo -e "${YELLOW}▸ Execution Tests${NC}"

do_request GET "$API/executions" "" "$USER_TOKEN"
assert_status "List executions" "200"

if [ -n "${EXEC_ID:-}" ]; then
  do_request GET "$API/executions/$EXEC_ID" "" "$USER_TOKEN"
  assert_status "Get execution detail" "200"
fi

do_request GET "$API/executions/stats" "" "$USER_TOKEN"
assert_status "Execution stats" "200"

if [ -n "${EXEC_ID:-}" ]; then
  do_request POST "$API/automations/$EXEC_ID/cancel" "" "$USER_TOKEN"
  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "400" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} Cancel execution (HTTP $HTTP_CODE — valid response)"
    PASS=$((PASS + 1))
  else
    assert_status "Cancel execution" "200"
  fi
fi

echo ""

# ═══ Credential Tests ═══
echo -e "${YELLOW}▸ Credential Tests${NC}"

do_request POST "$API/credentials" "{\"name\":\"My Telegram Bot\",\"type\":\"telegram\",\"data\":{\"botToken\":\"123:ABC\",\"chatId\":\"-100\"}}" "$USER_TOKEN"
assert_status "Create credential" "201"
CRED_ID=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

do_request GET "$API/credentials" "" "$USER_TOKEN"
assert_status "List credentials (masked)" "200"

# Verify no encryptedData leak
if echo "$HTTP_BODY" | grep -q "encryptedData"; then
  echo -e "  ${RED}  ↳ WARNING: encryptedData exposed!${NC}"
else
  echo -e "  ${GREEN}  ↳ Verified: no encryptedData in response${NC}"
fi

do_request GET "$API/credentials/types" "" "$USER_TOKEN"
assert_status "Get credential types" "200"

if [ -n "$CRED_ID" ]; then
  do_request DELETE "$API/credentials/$CRED_ID" "" "$USER_TOKEN"
  assert_status "Delete credential" "200"
fi

echo ""

# ═══ Billing Tests ═══
echo -e "${YELLOW}▸ Billing Tests${NC}"

do_request GET "$API/billing/plans" "" "$USER_TOKEN"
assert_status "List billing plans" "200"

do_request GET "$API/billing/quota" "" "$USER_TOKEN"
assert_status "Get quota (free user)" "200"

do_request POST "$API/billing/upgrade" "{\"planId\":\"plan-pro\"}" "$USER_TOKEN"
assert_status "Upgrade to Pro plan" "200"

do_request GET "$API/billing/subscription" "" "$USER_TOKEN"
assert_status "Get subscription" "200"

do_request POST "$API/billing/cancel" "" "$USER_TOKEN"
assert_status "Cancel subscription" "200"

echo ""

# ═══ Admin Tests ═══
echo -e "${YELLOW}▸ Admin Tests${NC}"

# RBAC test: user cannot access admin endpoints
do_request GET "$API/admin/users" "" "$USER_TOKEN"
assert_status "RBAC: user → admin (forbidden)" "403"

do_request GET "$API/admin/users" "" "$ADMIN_TOKEN"
assert_status "Admin: list users" "200"

do_request GET "$API/admin/analytics" "" "$ADMIN_TOKEN"
assert_status "Admin: analytics overview" "200"

do_request GET "$API/admin/analytics/execution-trends" "" "$ADMIN_TOKEN"
assert_status "Admin: execution trends" "200"

do_request GET "$API/admin/analytics/top-templates" "" "$ADMIN_TOKEN"
assert_status "Admin: top templates" "200"

do_request GET "$API/admin/analytics/user-distribution" "" "$ADMIN_TOKEN"
assert_status "Admin: user distribution" "200"

do_request GET "$API/admin/system/health" "" "$ADMIN_TOKEN"
assert_status "Admin: system health" "200"

do_request GET "$API/admin/audit-logs" "" "$ADMIN_TOKEN"
assert_status "Admin: audit logs" "200"

# Admin CRUD template
do_request POST "$API/admin/templates" "{
  \"name\":\"E2E Test Template\",
  \"description\":\"Created by E2E test\",
  \"categoryId\":\"$FIRST_CAT_ID\",
  \"n8nWorkflowId\":\"tpl-e2e-test-$(date +%s)\",
  \"webhookPath\":\"flowos/e2e-test\",
  \"inputSchema\":{\"type\":\"object\",\"required\":[\"testField\"],\"properties\":{\"testField\":{\"type\":\"string\",\"title\":\"Test\"}}}
}" "$ADMIN_TOKEN"
assert_status "Admin: create template" "201"
NEW_TPL_ID=$(echo "$HTTP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -n "$NEW_TPL_ID" ]; then
  do_request PUT "$API/admin/templates/$NEW_TPL_ID" "{\"description\":\"Updated by E2E\",\"isPremium\":true}" "$ADMIN_TOKEN"
  assert_status "Admin: update template" "200"

  do_request DELETE "$API/admin/templates/$NEW_TPL_ID" "" "$ADMIN_TOKEN"
  assert_status "Admin: delete template" "200"
fi

echo ""

# ═══ User Profile Tests ═══
echo -e "${YELLOW}▸ User Profile Tests${NC}"

do_request GET "$API/user/profile" "" "$USER_TOKEN"
assert_status "Get user profile" "200"

do_request PUT "$API/user/profile" "{\"fullName\":\"Updated Test User\"}" "$USER_TOKEN"
assert_status "Update user profile" "200"

echo ""

# ═══ Summary ═══
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Total:   $TOTAL"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Failed tests:${NC}"
  echo -e "$FAILS"
  echo ""
fi

echo -e "${BLUE}═══════════════════════════════════════════${NC}"

# Cleanup
rm -f /tmp/flowos_resp_body

exit $FAIL
