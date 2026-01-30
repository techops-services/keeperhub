#!/bin/bash

# Get API key from SSM:
# Prod: aws ssm get-parameter --name "/eks/maker-prod/keeperhub-hub/keeperhub-api-key" --with-decryption --query "Parameter.Value" --output text
# Staging: aws ssm get-parameter --name "/eks/maker-staging/keeperhub-hub/keeperhub-api-key" --with-decryption --query "Parameter.Value" --output text

if [[ -z "$HUB_SERVICE_API_KEY" ]]; then
  echo "Error: HUB_SERVICE_API_KEY env var not found"
  exit 1
fi

BASE_URL="https://app.keeperhub.com/api/hub/featured"

curl -sf -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "5tqrbugkrfzt4tm5yfs29", "featured": true, "category": "Getting Started", "featuredOrder": 1}' || echo "Failed to feature workflow 5tqrbugkrfzt4tm5yfs29"
echo ""

curl -sf -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "2cpr56tiriijndr4hmiua", "featured": true, "category": "Getting Started", "featuredOrder": 2}' || echo "Failed to feature workflow 2cpr56tiriijndr4hmiua"
echo ""

curl -sf -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "nhggiz2hn76gbqhiw9d2z", "featured": true, "category": "Getting Started", "featuredOrder": 3}' || echo "Failed to feature workflow nhggiz2hn76gbqhiw9d2z"
echo ""

curl -sf -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "qf8nxbxhdsqie2r3u1pb2", "featured": true, "category": "Getting Started", "featuredOrder": 4}' || echo "Failed to feature workflow qf8nxbxhdsqie2r3u1pb2"
echo ""
