#!/bin/bash

# Whitelist API Test Script
# Make sure to replace ADMIN_TOKEN with a valid admin JWT token
# You can get a token by logging in via: POST /api/v1/inex/admin/login

BASE_URL="http://localhost:5000/api/v1"
ADMIN_TOKEN="YOUR_ADMIN_JWT_TOKEN_HERE"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Whitelist API Tests ===${NC}\n"

# Test 1: Add email to whitelist (POST)
echo -e "${GREEN}Test 1: Add email to whitelist${NC}"
curl -X POST "${BASE_URL}/whitelist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "email": "test@example.com",
    "notes": "Test email for whitelist"
  }' | jq '.'

echo -e "\n"

# Test 2: Get all whitelisted emails (GET)
echo -e "${GREEN}Test 2: Get all whitelisted emails${NC}"
curl -X GET "${BASE_URL}/whitelist" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '.'

echo -e "\n"

# Test 3: Check if email is whitelisted (GET)
echo -e "${GREEN}Test 3: Check if email is whitelisted${NC}"
curl -X GET "${BASE_URL}/whitelist/check/test@example.com" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '.'

echo -e "\n"

# Test 4: Update whitelist entry (PUT)
echo -e "${GREEN}Test 4: Update whitelist entry${NC}"
curl -X PUT "${BASE_URL}/whitelist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "oldEmail": "test@example.com",
    "newEmail": "updated@example.com",
    "notes": "Updated email"
  }' | jq '.'

echo -e "\n"

# Test 5: Delete email from whitelist (DELETE)
echo -e "${GREEN}Test 5: Delete email from whitelist${NC}"
curl -X DELETE "${BASE_URL}/whitelist/updated@example.com" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '.'

echo -e "\n"

# Test 6: Try to add duplicate email (should fail)
echo -e "${GREEN}Test 6: Try to add duplicate email (should fail)${NC}"
curl -X POST "${BASE_URL}/whitelist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "email": "cholidaja45@gmail.com",
    "notes": "Duplicate test"
  }' | jq '.'

echo -e "\n"

# Test 7: Try without admin token (should fail)
echo -e "${GREEN}Test 7: Try without admin token (should fail)${NC}"
curl -X GET "${BASE_URL}/whitelist" | jq '.'

echo -e "\n${BLUE}=== Tests Complete ===${NC}"


