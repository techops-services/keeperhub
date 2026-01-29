#!/bin/bash

# Prod: aws ssm get-parameter --name "/eks/maker-prod/keeperhub-hub/keeperhub-api-key" --with-decryption --query "Parameter.Value" --output text
# Staging: aws ssm get-parameter --name "/eks/maker-staging/keeperhub-hub/keeperhub-api-key" --with-decryption --query "Parameter.Value" --output text

HUB_SERVICE_API_KEY=""
BASE_URL="https://app.keeperhub.com/api/hub/featured"

curl -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "5tqrbugkrfzt4tm5yfs29", "featured": true, "category": "Getting Started", "featuredOrder": 1}'
echo ""

curl -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "2cpr56tiriijndr4hmiua", "featured": true, "category": "Getting Started", "featuredOrder": 2}'
echo ""

curl -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "nhggiz2hn76gbqhiw9d2z", "featured": true, "category": "Getting Started", "featuredOrder": 3}'
echo ""

curl -X POST "$BASE_URL" -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "qf8nxbxhdsqie2r3u1pb2", "featured": true, "category": "Getting Started", "featuredOrder": 4}'
echo ""
