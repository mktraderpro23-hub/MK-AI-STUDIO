require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const SYSTEM = `You are MK AI STUDIO, a helpful, accurate, safe AI assistant. Be clear and useful. Never claim to have browsed the web, executed code, generated media, or used multiple models unless that actually happened. If uncertain, say so.`;

async function openaiChat(messages, model) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY in Render Environment.");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: SYSTEM }, ...messages], temperature: 0.7 })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `OpenAI request failed (${r.status})`);
  return { text: data.choices?.[0]?.message?.content || "", model: data.model || model || "OpenAI model", provider: "OpenAI" };
}

async function geminiChat(messages) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini is not configured. Add GEMINI_API_KEY in Render Environment.");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const contents = messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { temperature: 0.7 } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Gemini request failed (${r.status})`);
  return { text: data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "", model, provider: "Google Gemini" };
}

async function claudeChat(messages) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude is not configured. Add ANTHROPIC_API_KEY in Render Environment.");
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  const msgs = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1800, system: SYSTEM, messages: msgs })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Claude request failed (${r.status})`);
  return { text: data.content?.map(p => p.text || "").join("") || "", model, provider: "Anthropic Claude" };
}

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  app: "MK AI STUDIO V5",
  providers: {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    claude: Boolean(process.env.ANTHROPIC_API_KEY)
  }
}));

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, provider = "auto", task = "chat" } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "Please enter a message." });
    if (messages.length > 30 || messages.some(m => !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000)) {
      return res.status(400).json({ error: "Invalid or oversized conversation." });
    }
    const latest = messages[messages.length - 1];
    const taskPrompt = task && task !== "chat" ? `\n\nTask mode: ${task}. Give an output tailored to this task.` : "";
    const prepared = [...messages.slice(0, -1), { role: "user", content: latest.content + taskPrompt }];
    let result;
    if (provider === "openai") result = await openaiChat(prepared);
    else if (provider === "gemini") result = await geminiChat(prepared);
    else if (provider === "claude") result = await claudeChat(prepared);
    else {
      const configured = ["openai", "gemini", "claude"].filter(p => ({
        openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY, claude: process.env.ANTHROPIC_API_KEY
      })[p]);
      if (!configured.length) throw new Error("No AI provider is configured. Add at least one provider API key in Render Environment.");
      const chosen = configured[0];
      result = chosen === "openai" ? await openaiChat(prepared) : chosen === "gemini" ? await geminiChat(prepared) : await claudeChat(prepared);
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message || "AI request failed." }); }
});

app.post("/api/image", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("Image generation requires OPENAI_API_KEY in Render Environment.");
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt || prompt.length > 2000) return res.status(400).json({ error: "Enter an image prompt (maximum 2,000 characters)." });
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024" })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || `Image request failed (${r.status})`);
    const item = data.data?.[0];
    res.json({ image: item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || null });
  } catch (e) { res.status(500).json({ error: e.message || "Image generation failed." }); }
});


app.post("/api/build", async (req, res) => {
  try {
    const { prompt, kind = "web", provider = "auto" } = req.body || {};
    const brief = String(prompt || "").trim();
    if (!brief || brief.length > 5000) return res.status(400).json({ error: "Describe your app or website (maximum 5,000 characters)." });

    const instruction = `You are an expert product designer and senior full-stack engineer. Create a polished, functional ${kind === "app" ? "web app prototype" : "website"} from this brief: ${brief}

Return ONLY a complete standalone HTML document, starting with <!doctype html>. Include all HTML, CSS and JavaScript in one file. Do not use markdown fences. Make it responsive and accessible, use professional visual design, realistic sample content, working interactions, clear navigation, and useful empty/error states. Avoid fake claims of backend functionality: if a backend, database, authentication, payments, AI API, or external service is needed, implement a clear frontend demo and label what needs server-side integration. Never include API secrets. Use vanilla HTML/CSS/JS and no build tools so the user can save and open the file directly.`;

    const messages = [{ role: "user", content: instruction }];
    let result;
    if (provider === "openai") result = await openaiChat(messages);
    else if (provider === "gemini") result = await geminiChat(messages);
    else if (provider === "claude") result = await claudeChat(messages);
    else {
      const configured = ["openai", "gemini", "claude"].filter(p => ({
        openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY, claude: process.env.ANTHROPIC_API_KEY
      })[p]);
      if (!configured.length) throw new Error("No AI provider is configured. Add an OpenAI, Gemini, or Claude API key in Render Environment.");
      const chosen = configured[0];
      result = chosen === "openai" ? await openaiChat(messages) : chosen === "gemini" ? await geminiChat(messages) : await claudeChat(messages);
    }
    const match = result.text.match(/<!doctype html[\\s\\S]*<\\/html>/i);
    if (!match) return res.status(502).json({ error: "The AI response did not contain a complete HTML document. Try again with a shorter, clearer brief.", provider: result.provider, model: result.model, preview: result.text.slice(0, 12000) });
    res.json({ html: match[0], provider: result.provider, model: result.model });
  } catch (e) { res.status(500).json({ error: e.message || "AI builder failed." }); }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`MK AI STUDIO V5 running on port ${PORT}`));
