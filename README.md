# MK AI STUDIO V5 — ULTIMATE AI WORKSPACE

A mobile-first AI workspace with provider selection, task modes, AI chat, image generation, and local utility tools.

## Features
- Chat with OpenAI, Google Gemini, or Anthropic Claude through secure server-side API calls.
- Automatic provider selection (uses the first configured provider: OpenAI, Gemini, Claude).
- Task modes: general assistant, writing, coding, research planning, analysis, translation, summarization, and study.
- AI image generation through OpenAI Images API.
- Local tools: word counter, JSON formatter/validator, and prompt builder.
- Responsive dark interface, conversation history in browser local storage, and health/provider status endpoint.
- Render-ready Node/Express app.

## Important: free hosting is not the same as free AI
The app can be hosted on a free Render plan where available, but OpenAI, Anthropic, and Google API usage may be paid or subject to provider quotas. This project does not include free API credits. Use provider keys you own and check current pricing/limits. The app has no subscription/paywall built in.

## Run locally
1. Install Node.js 18 or newer.
2. Extract the ZIP.
3. In this folder run `npm install`.
4. Copy `.env.example` to `.env`.
5. Add at least one provider API key to `.env`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Deploy on Render
1. Upload this project to a GitHub repository.
2. In Render choose **New + > Web Service** and connect the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add provider keys under Render **Environment** (for example `OPENAI_API_KEY`). Do not add keys to `public/` files.
6. Deploy. Render uses the PORT environment variable automatically.

The included `render.yaml` is an optional Blueprint configuration.

## Provider setup
- OpenAI: `OPENAI_API_KEY`
- Google Gemini: `GEMINI_API_KEY`
- Anthropic Claude: `ANTHROPIC_API_KEY`

Choose a provider in the UI. "Auto" chooses the first configured provider in this order: OpenAI, Gemini, Claude. To compare multiple models, send the same prompt separately to each provider; this starter does not falsely claim simultaneous multi-model consensus.

## Notes and limitations
- This is a functional starter project, not a claim that every listed AI capability is independently implemented. The assistant task modes are prompt-based workflows using your configured model.
- Image generation requires OpenAI API access and may incur charges.
- No authentication or multi-user database is included in this initial free edition. Do not expose this app publicly with private data until you add authentication, quotas, and persistent server-side user storage.
- No live web search, video generation, voice generation, or browser automation is wired in yet. Those require additional providers/services and permissions.
