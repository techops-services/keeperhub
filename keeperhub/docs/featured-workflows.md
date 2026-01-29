# How to Feature a Public Workflow

## Keys

Keys are stored in AWS SSM Parameter Store. Retrieve with:

```
# Prod
"/eks/maker-prod/keeperhub-hub/keeperhub-api-key"

# Staging
"/eks/maker-staging/keeperhub-hub/keeperhub-api-key"
```

## Endpoint

POST /api/hub/featured

Auth header: X-Service-Key (not Authorization: Bearer)

## Request Body

| Field         | Type    | Required | Description                  |
| ------------- | ------- | -------- | ---------------------------- |
| workflowId    | string  | Yes      | The workflow ID to feature   |
| featured      | boolean | No       | Defaults to true if omitted  |
| category      | string  | No       | Category label (e.g. "Web3") |
| featuredOrder | number  | No       | Sort order (higher = first)  |

## Staging

Staging requires Cloudflare Access headers.

```
curl -X POST https://app-staging.keeperhub.com/api/hub/featured -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" -d '{"workflowId": "YOUR_WORKFLOW_ID", "featured": true, "category": "Web3", "featuredOrder": 1}'
```

## Prod

Prod does not need Cloudflare Access headers.

```
curl -X POST https://app.keeperhub.com/api/hub/featured -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "YOUR_WORKFLOW_ID", "featured": true, "category": "Web3", "featuredOrder": 1}'
```

## Unfeature a Workflow

Set featured to false:

```
curl -X POST https://app.keeperhub.com/api/hub/featured -H "Content-Type: application/json" -H "X-Service-Key: $HUB_SERVICE_API_KEY" -d '{"workflowId": "YOUR_WORKFLOW_ID", "featured": false}'
```

## Success Response

```json
{
  "success": true,
  "workflow": {
    "id": "cnwkksfm6xe6cjye2mvq3",
    "name": "Untitled 2",
    "featured": true,
    "category": "Web3",
    "featuredOrder": 1
  }
}
```
