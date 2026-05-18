import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";

function requireAuth(req, res, next) {
  const auth = req.headers["x-gateway-secret"];
  if (!GATEWAY_SECRET || auth !== GATEWAY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }
  next();
}

async function proxyOpenAI(path, req, res) {
  try {
    const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "railway-ai-gateway"
  });
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

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`AI Gateway running on port ${port}`);
});

