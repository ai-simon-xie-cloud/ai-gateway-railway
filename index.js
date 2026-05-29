import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const SERVICE_NAME = "railway-ai-gateway";

const ALLOWED_ENDPOINTS = new Set([
  "/v1/chat/completions",
  "/v1/images/generations",
  "/v1/responses",
  "/v1/embeddings"
]);

function requireAuth(req, res, next) {
  const gatewaySecret = String(req.headers["x-gateway-secret"] || "").trim();
  const bearer = parseBearer(req.headers.authorization);
  const auth = gatewaySecret || bearer;
  const expected = String(GATEWAY_SECRET || "").trim();
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }
  next();
}

async function proxyOpenAI(path, req, res) {
  try {
    if (!ALLOWED_ENDPOINTS.has(path)) {
      return res.status(404).json({ error: "Endpoint not allowed" });
    }

    const headers = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    };
    if (req.headers["openai-beta"]) headers["OpenAI-Beta"] = req.headers["openai-beta"];
    if (req.headers["openai-organization"]) {
      headers["OpenAI-Organization"] = req.headers["openai-organization"];
    }

    const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body)
    });

    copyResponseHeaders(response, res);
    res.status(response.status);

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") || req.body?.stream === true) {
      res.setHeader("Content-Type", contentType || "text/event-stream");
      return streamResponse(response, res);
    }

    const text = await response.text();
    return res.send(text);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE_NAME,
    hasGatewaySecret: Boolean(GATEWAY_SECRET),
    gatewaySecretLength: GATEWAY_SECRET ? String(GATEWAY_SECRET).trim().length : 0,
    hasOpenAIKey: Boolean(OPENAI_API_KEY)
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: SERVICE_NAME,
    openaiBaseUrl: OPENAI_BASE_URL,
    authConfigured: Boolean(GATEWAY_SECRET),
    upstreamConfigured: Boolean(OPENAI_API_KEY)
  });
});

app.get("/v1/models", requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/v1/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      }
    });
    copyResponseHeaders(response, res);
    res.status(response.status);
    return res.send(await response.text());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/v1/chat/completions", requireAuth, async (req, res) => {
  return proxyOpenAI("/v1/chat/completions", req, res);
});

app.post("/v1/images/generations", requireAuth, async (req, res) => {
  return proxyOpenAI("/v1/images/generations", req, res);
});

app.post("/v1/responses", requireAuth, async (req, res) => {
  return proxyOpenAI("/v1/responses", req, res);
});

app.post("/v1/embeddings", requireAuth, async (req, res) => {
  return proxyOpenAI("/v1/embeddings", req, res);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`AI Gateway running on port ${port}`);
});

function parseBearer(value) {
  const auth = String(value || "").trim();
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function copyResponseHeaders(response, res) {
  const contentType = response.headers.get("content-type");
  const requestId = response.headers.get("x-request-id");
  if (contentType) res.setHeader("Content-Type", contentType);
  if (requestId) res.setHeader("x-openai-request-id", requestId);
  res.setHeader("x-unq-gateway", SERVICE_NAME);
}

async function streamResponse(response, res) {
  if (!response.body) {
    return res.end();
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    res.destroy(error);
  }
}
