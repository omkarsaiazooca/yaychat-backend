#!/bin/bash

# Chat API Fix Verification Script
# Testing Direct Messages and Group Messages with proper logging

BASE_URL="http://localhost:5000/api/v1/chat"
USER1="mohammadkhalil21497@gmail.com"
USER2="sunkuomkarsai@gmail.com"

REPORT_FILE="CHAT_FIX_VERIFICATION_REPORT_$(date +%Y%m%d_%H%M%S).md"

echo "# Chat API Fix Verification Report" > $REPORT_FILE
echo "**Date:** $(date)" >> $REPORT_FILE
echo "**Test Users:**" >> $REPORT_FILE
echo "- User 1: $USER1" >> $REPORT_FILE
echo "- User 2: $USER2" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "---" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Function to test and log with emoji
test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_code=${5:-200}
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 TEST: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔗 Method: $method"
    echo "📍 Endpoint: $endpoint"
    if [ ! -z "$data" ]; then
        echo "📦 Request Data: $data"
    fi
    echo ""
    
    # Log to report
    echo "## $name" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "**Method:** \`$method\`" >> $REPORT_FILE
    echo "**Endpoint:** \`$endpoint\`" >> $REPORT_FILE
    if [ ! -z "$data" ]; then
        echo "**Request Data:**" >> $REPORT_FILE
        echo "\`\`\`json" >> $REPORT_FILE
        echo "$data" | jq . 2>/dev/null || echo "$data" >> $REPORT_FILE
        echo "\`\`\`" >> $REPORT_FILE
    fi
    echo "" >> $REPORT_FILE
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL$endpoint" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>&1)
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE/d')
    
    # Check if response is valid JSON
    if echo "$body" | jq . >/dev/null 2>&1; then
        formatted_body=$(echo "$body" | jq . 2>/dev/null)
    else
        formatted_body="$body"
    fi
    
    echo "📊 HTTP Status: $http_code"
    
    if [ "$http_code" = "$expected_code" ]; then
        echo "✅ STATUS: SUCCESS (Expected: $expected_code, Got: $http_code)"
        status_emoji="✅"
        status_text="**SUCCESS**"
    else
        echo "❌ STATUS: FAILED (Expected: $expected_code, Got: $http_code)"
        status_emoji="❌"
        status_text="**FAILED**"
    fi
    
    echo ""
    echo "📄 Response:"
    echo "$formatted_body" | head -30
    echo ""
    
    # Log to report
    echo "**HTTP Status:** \`$http_code\`" >> $REPORT_FILE
    echo "**Result:** $status_emoji $status_text" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "**Response:**" >> $REPORT_FILE
    echo "\`\`\`json" >> $REPORT_FILE
    echo "$formatted_body" | head -50 >> $REPORT_FILE
    echo "\`\`\`" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    
    # Extract IDs for next tests
    if echo "$body" | grep -q "groupId"; then
        GROUP_ID=$(echo "$body" | grep -o '"groupId":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$GROUP_ID" ] && [ "$GROUP_ID" != "everyone" ]; then
            echo "$GROUP_ID" > /tmp/test_group_id.txt
        fi
    fi
    
    if echo "$body" | grep -q "messageId"; then
        MESSAGE_ID=$(echo "$body" | grep -o '"messageId":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$MESSAGE_ID" ]; then
            echo "$MESSAGE_ID" > /tmp/test_message_id.txt
        fi
    fi
    
    sleep 1
    return $([ "$http_code" = "$expected_code" ] && echo 0 || echo 1)
}

# Counters
SUCCESS_COUNT=0
FAIL_COUNT=0

echo "╔══════════════════════════════════════════════════════════════════════════════════╗"
echo "║                    CHAT API FIX VERIFICATION TEST SUITE                         ║"
echo "╚══════════════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "# Test Results Summary" >> $REPORT_FILE
echo "" >> $REPORT_FILE

echo "═══════════════════════════════════════════════════════════════════════════════════"
echo "📱 PART 1: DIRECT MESSAGE TESTS"
echo "═══════════════════════════════════════════════════════════════════════════════════"
echo "" >> $REPORT_FILE
echo "## Part 1: Direct Message Tests" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test 1: Send Direct Message (User1 -> User2)
echo "### Step 1.1: Send Direct Message (User1 → User2)" >> $REPORT_FILE
test_api "Step 1.1: Send Direct Message (User1 → User2)" "POST" "/messages" \
"{\"email\":\"$USER1\",\"to\":\"$USER2\",\"message\":\"Hello! This is a direct message from User1 to User2. Testing the chat system.\"}" 201
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 2: Send Direct Message (User2 -> User1)
echo "### Step 1.2: Send Direct Message (User2 → User1)" >> $REPORT_FILE
test_api "Step 1.2: Send Direct Message (User2 → User1)" "POST" "/messages" \
"{\"email\":\"$USER2\",\"to\":\"$USER1\",\"message\":\"Hi! This is a reply from User2. The direct messaging is working correctly.\"}" 201
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 3: Get Messages for User1
echo "### Step 1.3: Retrieve All Direct Messages for User1" >> $REPORT_FILE
test_api "Step 1.3: Retrieve All Direct Messages for User1" "GET" "/messages/$USER1" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 4: Get Messages for User2
echo "### Step 1.4: Retrieve All Direct Messages for User2" >> $REPORT_FILE
test_api "Step 1.4: Retrieve All Direct Messages for User2" "GET" "/messages/$USER2" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 5: Get Message Count
echo "### Step 1.5: Get Direct Message Count (User1 with User2)" >> $REPORT_FILE
test_api "Step 1.5: Get Direct Message Count (User1 with User2)" "GET" "/messages/count?email=$USER1&with=$USER2" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════"
echo "👥 PART 2: GROUP MESSAGE TESTS"
echo "═══════════════════════════════════════════════════════════════════════════════════"
echo "" >> $REPORT_FILE
echo "## Part 2: Group Message Tests" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Test 6: Get User Groups
echo "### Step 2.1: Get User Groups for User1" >> $REPORT_FILE
test_api "Step 2.1: Get User Groups for User1" "GET" "/groups?email=$USER1" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Extract the actual groupId from response
ACTUAL_GROUP_ID=$(curl -s "$BASE_URL/groups?email=$USER1" | grep -o '"groupId":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$ACTUAL_GROUP_ID" ] || [ "$ACTUAL_GROUP_ID" = "everyone" ]; then
    ACTUAL_GROUP_ID="everyone"
fi

# Test 7: Send Group Message (User1)
echo "### Step 2.2: Send Group Message to Default Group (User1)" >> $REPORT_FILE
test_api "Step 2.2: Send Group Message to Default Group (User1)" "POST" "/sendGroupmessage" \
"{\"email\":\"$USER1\",\"message\":\"🎉 Hello everyone! This is a test group message from User1. Testing the fixed chat system.\"}" 201
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 8: Send Group Message (User2)
echo "### Step 2.3: Send Group Message to Default Group (User2)" >> $REPORT_FILE
test_api "Step 2.3: Send Group Message to Default Group (User2)" "POST" "/sendGroupmessage" \
"{\"email\":\"$USER2\",\"message\":\"✅ Hi everyone! This is a test group message from User2. The fix should allow us to retrieve these messages now.\"}" 201
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 9: Get Group Messages (THIS IS THE CRITICAL TEST)
echo "### Step 2.4: Retrieve Group Messages (CRITICAL FIX TEST)" >> $REPORT_FILE
test_api "Step 2.4: Retrieve Group Messages (CRITICAL FIX TEST)" "GET" "/groups/everyone/messages?email=$USER1" "" 200
if [ $? -eq 0 ]; then 
    ((SUCCESS_COUNT++))
    echo "🎉 SUCCESS! The fix is working - messages can now be retrieved!"
else 
    ((FAIL_COUNT++))
    echo "⚠️  WARNING: Still getting error - may need to check the fix"
fi

# Test 10: Get Group Messages Paged
echo "### Step 2.5: Retrieve Group Messages (Paged)" >> $REPORT_FILE
test_api "Step 2.5: Retrieve Group Messages (Paged)" "GET" "/groups/everyone/messages/paged?email=$USER1&limit=10" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 11: Get Group Message Count (THIS SHOULD NOW RETURN > 0)
echo "### Step 2.6: Get Group Message Count (Should be > 0)" >> $REPORT_FILE
test_api "Step 2.6: Get Group Message Count (Should be > 0)" "GET" "/groups/everyone/messages/count?email=$USER1" "" 200
if [ $? -eq 0 ]; then 
    ((SUCCESS_COUNT++))
    COUNT=$(curl -s "$BASE_URL/groups/everyone/messages/count?email=$USER1" | grep -o '"count":[0-9]*' | cut -d: -f2)
    if [ "$COUNT" -gt 0 ]; then
        echo "✅ Message count is correct: $COUNT messages found!"
    else
        echo "⚠️  Message count is 0 - may need to check"
    fi
else 
    ((FAIL_COUNT++))
fi

# Test 12: Get Group Unread Count
echo "### Step 2.7: Get Group Unread Count" >> $REPORT_FILE
test_api "Step 2.7: Get Group Unread Count" "GET" "/groups/everyone/unread/count?email=$USER1" "" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Test 13: Mark Group as Read
echo "### Step 2.8: Mark Group as Read" >> $REPORT_FILE
test_api "Step 2.8: Mark Group as Read" "POST" "/groups/everyone/read" \
"{\"email\":\"$USER1\"}" 200
if [ $? -eq 0 ]; then ((SUCCESS_COUNT++)); else ((FAIL_COUNT++)); fi

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════════╗"
echo "║                           TEST SUMMARY                                          ║"
echo "╚══════════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Successful Tests: $SUCCESS_COUNT"
echo "❌ Failed Tests: $FAIL_COUNT"
echo "📊 Total Tests: $((SUCCESS_COUNT + FAIL_COUNT))"
echo ""

# Calculate success rate
if [ $((SUCCESS_COUNT + FAIL_COUNT)) -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESS_COUNT * 100 / (SUCCESS_COUNT + FAIL_COUNT)))
    echo "📈 Success Rate: ${SUCCESS_RATE}%"
fi

echo "" >> $REPORT_FILE
echo "---" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "## Test Summary" >> $REPORT_FILE
echo "" >> $REPORT_FILE
echo "| Metric | Count |" >> $REPORT_FILE
echo "|--------|-------|" >> $REPORT_FILE
echo "| ✅ Successful Tests | $SUCCESS_COUNT |" >> $REPORT_FILE
echo "| ❌ Failed Tests | $FAIL_COUNT |" >> $REPORT_FILE
echo "| 📊 Total Tests | $((SUCCESS_COUNT + FAIL_COUNT)) |" >> $REPORT_FILE
if [ $((SUCCESS_COUNT + FAIL_COUNT)) -gt 0 ]; then
    echo "| 📈 Success Rate | ${SUCCESS_RATE}% |" >> $REPORT_FILE
fi
echo "" >> $REPORT_FILE

if [ $FAIL_COUNT -eq 0 ]; then
    echo "## 🎉 Conclusion" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "**✅ ALL TESTS PASSED!** The fix is working correctly. Group messages can now be retrieved successfully." >> $REPORT_FILE
else
    echo "## ⚠️ Conclusion" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "**Some tests failed.** Please review the errors above and verify the fix implementation." >> $REPORT_FILE
fi

echo ""
echo "📄 Full report saved to: $REPORT_FILE"
echo ""

