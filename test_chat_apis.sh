#!/bin/bash

# Chat API Testing Script
# Testing with users: mohammadkhalil21497@gmail.com and sunkuomkarsai@gmail.com

BASE_URL="http://localhost:5000/api/v1/chat"
USER1="mohammadkhalil21497@gmail.com"
USER2="sunkuomkarsai@gmail.com"

echo "=========================================="
echo "Chat API Testing Report"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "User 1: $USER1"
echo "User 2: $USER2"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Create report file
REPORT_FILE="chat_api_test_report_$(date +%Y%m%d_%H%M%S).txt"
echo "Chat API Test Report - $(date)" > $REPORT_FILE
echo "==========================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Function to test API and log results
test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo "----------------------------------------"
    echo "Testing: $name"
    echo "Method: $method"
    echo "Endpoint: $endpoint"
    if [ ! -z "$data" ]; then
        echo "Data: $data"
    fi
    echo "----------------------------------------"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    elif [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PATCH \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE/d')
    
    echo "HTTP Status: $http_code"
    echo "Response: $body"
    echo ""
    
    # Log to report file
    echo "----------------------------------------" >> $REPORT_FILE
    echo "Test: $name" >> $REPORT_FILE
    echo "Method: $method | Endpoint: $endpoint" >> $REPORT_FILE
    if [ ! -z "$data" ]; then
        echo "Data: $data" >> $REPORT_FILE
    fi
    echo "HTTP Status: $http_code" >> $REPORT_FILE
    echo "Response: $body" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    
    # Extract groupId if present in response for later tests
    if echo "$body" | grep -q "groupId"; then
        GROUP_ID=$(echo "$body" | grep -o '"groupId":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$GROUP_ID" ]; then
            echo "Extracted groupId: $GROUP_ID"
            echo "$GROUP_ID" > /tmp/test_group_id.txt
        fi
    fi
    
    # Extract messageId if present
    if echo "$body" | grep -q "messageId"; then
        MESSAGE_ID=$(echo "$body" | grep -o '"messageId":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$MESSAGE_ID" ]; then
            echo "Extracted messageId: $MESSAGE_ID"
            echo "$MESSAGE_ID" > /tmp/test_message_id.txt
        fi
    fi
    
    sleep 1
}

echo "=========================================="
echo "1. DIRECT MESSAGE TESTS"
echo "=========================================="

# Test 1: Send Direct Message (User1 to User2)
test_api "Send Direct Message (User1 -> User2)" "POST" "/messages" \
"{\"email\":\"$USER1\",\"to\":\"$USER2\",\"message\":\"Hello from User1! This is a test direct message.\"}"

# Test 2: Send Direct Message (User2 to User1)
test_api "Send Direct Message (User2 -> User1)" "POST" "/messages" \
"{\"email\":\"$USER2\",\"to\":\"$USER1\",\"message\":\"Hello from User2! This is a reply message.\"}"

# Test 3: Get Messages for User1
test_api "Get All Messages for User1" "GET" "/messages/$USER1" ""

# Test 4: Get Messages for User2
test_api "Get All Messages for User2" "GET" "/messages/$USER2" ""

# Test 5: Get Latest Messages for User1
test_api "Get Latest Messages for User1" "GET" "/lastmessages/$USER1" ""

# Test 6: Get Latest Messages for User2
test_api "Get Latest Messages for User2" "GET" "/lastmessages/$USER2" ""

# Test 7: Get Message Count for User1
test_api "Get Message Count for User1" "GET" "/messages/count?email=$USER1" ""

# Test 8: Get Message Count with peer
test_api "Get Message Count (User1 with User2)" "GET" "/messages/count?email=$USER1&with=$USER2" ""

# Test 9: Get Unread Count for User1
test_api "Get Unread Message Count for User1" "GET" "/messages/unread/count?email=$USER1" ""

# Test 10: Get Unread Summary
test_api "Get Unread Summary for User1" "GET" "/counts/unread?email=$USER1" ""

echo ""
echo "=========================================="
echo "2. GROUP MESSAGE TESTS"
echo "=========================================="

# Test 11: Get User Groups for User1
test_api "Get User Groups for User1" "GET" "/groups?email=$USER1" ""

# Test 12: Get User Groups for User2
test_api "Get User Groups for User2" "GET" "/groups?email=$USER2" ""

# Test 13: Send Group Message to default group (User1)
test_api "Send Group Message to Default Group (User1)" "POST" "/sendGroupmessage" \
"{\"email\":\"$USER1\",\"message\":\"Hello everyone! This is a test group message from User1.\"}"

# Test 14: Send Group Message to default group (User2)
test_api "Send Group Message to Default Group (User2)" "POST" "/sendGroupmessage" \
"{\"email\":\"$USER2\",\"message\":\"Hello everyone! This is a test group message from User2.\"}"

# Get the default group ID (everyone group)
EVERYONE_GROUP_ID="everyone"

# Test 15: Get Group Messages for default group
test_api "Get Group Messages (Default Group)" "GET" "/groups/$EVERYONE_GROUP_ID/messages?email=$USER1" ""

# Test 16: Get Group Messages Paged
test_api "Get Group Messages Paged (Default Group)" "GET" "/groups/$EVERYONE_GROUP_ID/messages/paged?email=$USER1&limit=10" ""

# Test 17: Get Group Message Count
test_api "Get Group Message Count" "GET" "/groups/$EVERYONE_GROUP_ID/messages/count?email=$USER1" ""

# Test 18: Get Group Unread Count
test_api "Get Group Unread Count" "GET" "/groups/$EVERYONE_GROUP_ID/unread/count?email=$USER1" ""

# Test 19: Mark Group as Read
test_api "Mark Group as Read" "POST" "/groups/$EVERYONE_GROUP_ID/read" \
"{\"email\":\"$USER1\"}"

# Test 20: Join Group
test_api "Join Group" "POST" "/groups/$EVERYONE_GROUP_ID/join" \
"{\"email\":\"$USER1\"}"

echo ""
echo "=========================================="
echo "3. UTILITY TESTS"
echo "=========================================="

# Test 21: Get Upload URL
test_api "Get Upload URL (Image)" "GET" "/upload-url?fileType=image/png" ""

# Test 22: Get Upload URL (PDF)
test_api "Get Upload URL (PDF)" "GET" "/upload-url?fileType=application/pdf" ""

echo ""
echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
echo "Full report saved to: $REPORT_FILE"
echo ""

