# AI Gateway Railway

Railway service for proxying UNQ Agent / Tencent SCF requests to OpenAI from an overseas runtime.

## Environment Variables

```text
OPENAI_API_KEY=
GATEWAY_SECRET=
OPENAI_BASE_URL=https://api.openai.com
```

## Endpoints

```text
GET  /
GET  /health
GET  /v1/models
POST /v1/chat/completions
POST /v1/images/generations
POST /v1/responses
POST /v1/embeddings
```

Protected endpoints require either the legacy header:

```text
x-gateway-secret: <GATEWAY_SECRET>
```

or the OpenAI-compatible header:

```text
Authorization: Bearer <GATEWAY_SECRET>
```

For OpenAI SDK-compatible clients, use:

```text
base_url = https://<railway-domain>/v1
api_key = <GATEWAY_SECRET>
```

The real `OPENAI_API_KEY` stays only in Railway environment variables.

## Railway Deploy

Set these variables in Railway:

```text
OPENAI_API_KEY=<real OpenAI API key>
GATEWAY_SECRET=<long random relay token for devices>
OPENAI_BASE_URL=https://api.openai.com
```

Then deploy from this GitHub repo.

## Smoke Test

```powershell
$base = "https://<railway-domain>/v1"
$token = "<GATEWAY_SECRET>"

Invoke-RestMethod "$($base -replace '/v1$','')/health"

Invoke-RestMethod `
  -Method Post `
  -Uri "$base/responses" `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body (@{ model = "gpt-5"; input = "Reply with exactly: UNQ gateway ok" } | ConvertTo-Json)
```
