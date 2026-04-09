# AI Call Handling Backend

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
- PostgreSQL + Drizzle schema setup

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
- `src/database`: Drizzle schema and database service

## Setup

1. Copy `.env.example` to `.env`
2. Update all provider credentials
3. Create the PostgreSQL database
4. Run:

```bash
npm install
npm run build
npm run start:dev
```

## Important notes

- Exotel, OpenAI, ElevenLabs, and WhatsApp provider classes are integrated as clean HTTP wrappers.
- If provider credentials are missing, the backend falls back gracefully so local development can continue.
- You should add proper Drizzle migrations before production rollout.
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

## Suggested next milestones

1. Add Drizzle migrations and seed scripts
2. Add webhook signature validation for Exotel
3. Implement real-time STT/TTS streaming loop
4. Add billing usage aggregation and subscription enforcement
5. Re-enable WhatsApp follow-ups behind a feature flag when needed
