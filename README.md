# AI Gateway Railway

Railway service for proxying Tencent SCF requests to OpenAI from an overseas runtime.

## Environment Variables

```text
OPENAI_API_KEY=
GATEWAY_SECRET=
OPENAI_BASE_URL=https://api.openai.com
```

## Endpoints

```text
GET  /
POST /v1/chat/completions
POST /v1/images/generations
POST /v1/responses
```

All POST endpoints require:

```text
x-gateway-secret: <GATEWAY_SECRET>
```

