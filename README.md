m# AI Call Handling Backend

NestJS backend for the AI call handling SaaS described in the PRD.

## What is included

- JWT auth for business users
- Business onboarding APIs
- FAQ and service knowledge-base APIs
- Exotel webhook intake for incoming calls
- Central AI agent number routing based on original dialed business number
- AI reply orchestration using OpenAI + ElevenLabs provider wrappers
- Browser-based speech test call flow for businesses
- Call, transcript, and lead storage flows
- Call analytics with transcripts and summaries
- Swagger docs at `/docs`
- PostgreSQL + Drizzle tooling ready for the next schema

## Project structure

- `src/auth`: registration, login, JWT
- `src/businesses`: business onboarding and number mapping
- `src/knowledge-base`: FAQs and services
- `src/telephony`: Exotel webhook, live AI turns, and browser test-call flow
- `src/common/utils/phone.util.ts`: phone normalization for number mapping
- `src/ai`: LLM + TTS orchestration
- `src/calls`: call records and transcripts
- `src/leads`: extracted lead management
- `src/messaging`: WhatsApp follow-ups
- `src/database`: Drizzle database service and the current schema file

## Setup

1. Copy `.env.example` to `.env`
2. Update all provider credentials
3. Add your PostgreSQL `DATABASE_URL`
4. Apply the generated migration, then run:

```bash
npm install
npm run build
npm run start:dev
```

## Drizzle workflow

After adding the new `DATABASE_URL`, use these commands:

```bash
npm run drizzle:migrate
npm run drizzle:studio
```

- `drizzle:migrate` applies the generated schema migration to the configured database.
- `drizzle:studio` opens Drizzle Studio for the database in `.env`.
- `drizzle:generate` creates SQL migrations from `src/database/schema.ts`.
- `drizzle:pull` introspects the database and refreshes `src/database/schema.ts` plus `src/database/relations.ts` after manual Studio or SQL-editor changes.
- `drizzle:deploy` runs generate and migrate together for a fresh database.

## Important notes

- Exotel, OpenAI, ElevenLabs, and WhatsApp provider classes are integrated as clean HTTP wrappers.
- If provider credentials are missing, the backend falls back gracefully so local development can continue.
- Exotel Voice v1 outbound calls need `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_SID`, and an ExoPhone in `EXOTEL_CALLER_ID` or `EXOTEL_VIRTUAL_NUMBER`.
- Outbound AI calls additionally need an Exotel app/flow URL in `EXOTEL_APP_URL`, or you must pass `appUrl` per request.
- Add or pull the new Drizzle schema before using DB-backed routes.
- WhatsApp follow-up delivery is currently disabled by product request.
- For production telephony, the next step should be streaming call audio rather than end-of-call transcript-only processing.

## Flow alignment with your diagrams

The backend now follows the central-agent-number flow:

1. A business registers and stores its own business phone number plus knowledge base data.
2. A customer calls that business number.
3. The business forwards the call to the shared AI agent number.
4. Exotel webhook sends the forwarded call metadata, including the original dialed number.
5. Backend maps that original number to the right business record.
6. AI uses only that business's FAQs and services to answer.
7. At call end, transcript is stored, lead data is extracted, and a WhatsApp follow-up is sent.

## Exotel outbound call APIs

Use this authenticated endpoint when you want Exotel to bridge two humans:

```http
POST /api/telephony/exotel/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromNumber": "+917816087488",
  "toNumber": "+916789725637",
  "record": true
}
```

`fromNumber` is called first. After it answers, Exotel connects `toNumber`. The caller ID comes from your ExoPhone configured in `EXOTEL_CALLER_ID` or `EXOTEL_VIRTUAL_NUMBER`.

Use this authenticated endpoint when you want Exotel to call a customer and drop them directly into your AI flow:

```http
POST /api/telephony/exotel/connect-to-app
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerNumber": "+917816087488",
  "appUrl": "https://my.exotel.com/exoml/start/<your-app-id>",
  "customField": "lead-123"
}
```

This maps to Exotel's "connect a customer to an app" flow. It is the correct mode for AI voicebot calls. Using `/exotel/connect` for AI will only bridge two phone numbers and will not invoke your Voicebot Applet by itself.

## Exotel voicebot setup

For direct AI conversations over Exotel, the missing piece is usually the Exotel flow itself:

1. In Exotel App Bazaar, create a flow with a **Voicebot Applet**.
2. Set the Voicebot URL to your public HTTPS endpoint:
   `https://<your-domain>/api/telephony/voicebot/session`
3. That endpoint returns:
   `{"url":"wss://<your-domain>/api/telephony/voicebot/media?sample_rate=16000"}`
4. After the Voicebot Applet, add a **Passthru Applet** or **Hangup Applet** as the next applet.
5. Trigger the flow with `/api/telephony/exotel/connect-to-app`, not `/api/telephony/exotel/connect`.

Important Exotel-side requirements:

- Voicebot/Stream applets are not enabled for all accounts by default. Ask Exotel support or your CSM to enable them.
- Your bot endpoint must be publicly reachable over valid `https://` and `wss://`. Localhost or invalid TLS will lead to silence and then disconnect.
- Exotel expects the WebSocket handshake to succeed quickly. Long delays can cause the call to fall silent and end.
- For Indian WebSocket + SIP / PSTN hybrid setups, Exotel recommends the Mumbai instance (`my.in.exotel.com` / `api.in.exotel.com`).

## Suggested next milestones

1. Add Drizzle migrations and seed scripts
2. Add webhook signature validation for Exotel
3. Implement real-time STT/TTS streaming loop
4. Add billing usage aggregation and subscription enforcement
5. Re-enable WhatsApp follow-ups behind a feature flag when needed
