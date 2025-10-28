#!/bin/bash

# Test security headers on local development worker
BASE_URL="http://localhost:38472"

echo "🛡️  Testing Security Headers Implementation"
echo "========================================="

# Test endpoints
ENDPOINTS=(
  "/health"
  "/style.css"
  "/favicon.ico"
  "/d/test123"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo ""
  echo "📍 Testing: $endpoint"
  echo "------------------------"
  
  curl -I -s "$BASE_URL$endpoint" | grep -E "(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Strict-Transport-Security|Permissions-Policy)" || echo "❌ Missing security headers"
done

echo ""
echo "✅ Security header test complete"
