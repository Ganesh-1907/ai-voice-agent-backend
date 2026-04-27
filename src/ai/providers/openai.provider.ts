import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type FunctionRouteSelection = {
  function: 1 | 2 | 3;
  data?: Record<string, unknown>;
};

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private sqlRateLimitedUntil = 0;
  private readonly decommissionedModels = new Set<string>();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async generateReply(prompt: string, customerText: string) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqPrimaryModel();
    const fallbackModel = this.getGroqFallbackModel();

    if (!apiKey) {
      this.logger.warn("Groq API key missing; returning fallback response");
      return {
        text: "Thanks for calling. We have captured your request and our team will contact you shortly.",
      };
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      fallbackModel,
      temperature: 0.4,
      maxTokens: 220,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: customerText },
      ],
      featureLabel: "generateReply",
    });

    return {
      text:
        completionText?.trim() ??
        "Thanks for calling. We have captured your request and our team will contact you shortly.",
    };
  }

  async generateSqlQuery(input: {
    schemaPrompt: string;
    businessId: string;
    userQuery: string;
    conversationContext?: string;
  }) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqPrimaryModel();
    const fallbackModel = this.getGroqFallbackModel();

    if (!apiKey) {
      return null;
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      fallbackModel,
      temperature: 0,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content: [
            "Generate one safe PostgreSQL SELECT query only.",
            "Output plain SQL only. No markdown. No explanation.",
            "Keep the SQL concise and single-statement.",
            "Select only columns required for the user request; avoid wide SELECT lists.",
            "For list cars by price, prefer columns: id, name, brand, model, variant, category, status, price, currency.",
            "For count requests, return COUNT(*) as total_count.",
            "Must include WHERE business_id = <BUSINESS_ID> for business-scoped tables.",
            "Never use INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE.",
            "Prefer LIMIT 20 unless a smaller set is enough.",
            "Use only these tables and columns:",
            input.schemaPrompt,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `BUSINESS_ID=${input.businessId}`,
            `Conversation context: ${input.conversationContext ?? "none"}`,
            `User query: ${input.userQuery}`,
          ].join("\n"),
        },
      ],
      featureLabel: "generateSqlQuery",
    });

    if (!completionText) {
      return null;
    }

    return completionText
      .trim()
      .replace(/^```sql\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  async selectFunctionRoute(input: { customerText: string; conversationContext?: string }) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqPrimaryModel();
    const fallbackModel = this.getGroqFallbackModel();

    if (!apiKey) {
      return null;
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      fallbackModel,
      temperature: 0,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content: [
            "You are a function router for a car dealership call assistant.",
            "Choose exactly one function and return JSON only.",
            "Allowed response format:",
            '{"function": <1|2|3>, "data": {...}}',
            "Function 1: inventory fetch/list/count by filters. Data fields: minPriceInr, maxPriceInr, fuelType, transmission, location, suvOnly, limit, sortOrder, mode(list|count|remaining).",
            "Important for Function 1: Only set 'location' if a specific city/place name is mentioned. Ignore general adjectives like 'Indian', 'the', or 'our'. Also, treat words like 'legs' as 'lakhs' for price parsing.",
            "Function 2: business details such as business name, location, contact number.",
            "Function 3: booking flow. Data fields: carName, customerName, customerMobile.",
            "Important for Function 3: 'customerMobile' must be a valid 10-digit number. Only fill data fields if the user explicitly provided them.",
            "If query references previous listed cars (those/them/same range/remaining), choose function 1 with mode='remaining' or mode='list'.",
            "Do not include markdown, comments, or extra text.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Conversation context (latest messages): ${input.conversationContext ?? "none"}`,
            `Customer query: ${input.customerText}`,
          ].join("\n"),
        },
      ],
      featureLabel: "selectFunctionRoute",
    });

    if (!completionText) {
      return null;
    }

    return this.safeParseFunctionRouteSelection(completionText);
  }

  isSqlGenerationRateLimited() {
    return Date.now() < this.sqlRateLimitedUntil;
  }

  getSqlRateLimitedUntil() {
    return this.sqlRateLimitedUntil;
  }

  async extractLeadData(transcript: string) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqPrimaryModel();
    const fallbackModel = this.getGroqFallbackModel();

    if (!apiKey) {
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      fallbackModel,
      temperature: 0,
      maxTokens: 120,
      messages: [
        {
          role: "system",
          content:
            "Extract lead information from the call transcript. Return valid JSON only with keys: name, intent, notes.",
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      featureLabel: "extractLeadData",
    });

    if (!completionText) {
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }

    return this.safeParseLeadData(completionText, transcript);
  }

  async generateSummary(transcript: string) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqPrimaryModel();
    const fallbackModel = this.getGroqFallbackModel();

    if (!apiKey) {
      return transcript.slice(0, 240);
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      fallbackModel,
      temperature: 0.2,
      maxTokens: 120,
      messages: [
        {
          role: "system",
          content:
            "Summarize this phone conversation in 2 concise sentences. Focus on customer intent and promised follow-up.",
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      featureLabel: "generateSummary",
    });

    return completionText?.trim() ?? transcript.slice(0, 240);
  }

  async transcribeAudio(input: { buffer: Buffer; filename: string; mimeType: string }) {
    const apiKey = this.getGroqApiKey();
    const model =
      this.normalizeEnvValue(
        this.configService.get<string>("GROQ_TRANSCRIPTION_MODEL") ?? process.env.GROQ_TRANSCRIPTION_MODEL,
      ) ?? "whisper-large-v3-turbo";

    if (!apiKey) {
      this.logger.warn("GROQ API key missing; transcription fallback returns empty text");
      return { text: "", error: "GROQ_API_KEY is not configured", statusCode: 503 };
    }

    try {
      const maxAttempts = 2;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt += 1;
        const startedAt = Date.now();
        this.logger.log(
          `Groq transcribeAudio request attempt=${attempt} model=${model} bytes=${input.buffer.length} mime=${input.mimeType}`,
        );

        const formData = new FormData();
        const audioBlob = new Blob([new Uint8Array(input.buffer)], {
          type: input.mimeType || "audio/webm",
        });
        formData.append("file", audioBlob, input.filename || "test-call.webm");
        formData.append("model", model);
        formData.append("response_format", "json");
        formData.append("language", "en");

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            text?: string;
            language?: string;
            duration?: number;
            segments?: Array<{ start: number; end: number; text: string }>;
          };
          this.logger.log(
            `Groq transcribeAudio success attempt=${attempt} status=${response.status} durationMs=${Date.now() - startedAt} textChars=${typeof payload.text === "string" ? payload.text.length : 0}`,
          );

          return {
            text: typeof payload.text === "string" ? payload.text.trim() : "",
            language: payload.language,
            duration: payload.duration,
            segments: payload.segments,
          };
        }

        const errorBody = (await response.text().catch(() => "")).trim();
        this.logger.warn(
          `Groq transcribeAudio non-ok attempt=${attempt} status=${response.status} durationMs=${Date.now() - startedAt} body=${this.truncateForLog(errorBody)}`,
        );

        if (response.status === 429 && attempt < maxAttempts) {
          this.logger.warn("Groq transcription rate-limited; retrying once");
          await this.delay(350);
          continue;
        }

        this.logger.error(`Groq transcribeAudio failed with status ${response.status}`);
        return {
          text: "",
          error: errorBody || `Groq transcription failed with status ${response.status}`,
          statusCode: response.status,
        };
      }

      return { text: "", error: "Groq transcription failed", statusCode: 500 };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Groq transcription error";
      this.logger.error(`Groq transcribeAudio error: ${message}`);
      return { text: "", error: message, statusCode: 500 };
    }
  }

  private async callChatCompletion(input: {
    apiKey: string;
    model: string;
    fallbackModel?: string;
    messages: ChatMessage[];
    temperature: number;
    maxTokens: number;
    featureLabel:
      | "generateReply"
      | "extractLeadData"
      | "generateSummary"
      | "generateSqlQuery"
      | "selectFunctionRoute";
  }) {
    const modelsToTry = [input.model, input.fallbackModel, this.getGroqEmergencyFallbackModel()]
      .filter((value): value is string => !!value)
      .filter((value, index, source) => source.indexOf(value) === index)
      .filter((value) => !this.decommissionedModels.has(value));

    const maxAttempts = 2;

    for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex += 1) {
      const currentModel = modelsToTry[modelIndex];
      const nextModel = modelsToTry[modelIndex + 1];
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt += 1;

        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${input.apiKey}`,
            },
            body: JSON.stringify({
              model: currentModel,
              messages: input.messages,
              temperature: input.temperature,
              max_tokens: input.maxTokens,
            }),
          });

          if (response.ok) {
            const payload = (await response.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            this.logger.log(
              `Groq ${input.featureLabel} success model=${currentModel} attempt=${attempt} status=${response.status} textChars=${payload.choices?.[0]?.message?.content?.length ?? 0}`,
            );

            return payload.choices?.[0]?.message?.content;
          }

          const errorBody = (await response.text().catch(() => "")).trim();
          this.logger.warn(
            `Groq ${input.featureLabel} non-ok model=${currentModel} attempt=${attempt} status=${response.status} body=${this.truncateForLog(errorBody)}`,
          );

          if (response.status === 429 && attempt < maxAttempts) {
            if (input.featureLabel === "generateSqlQuery") {
              this.markSqlRateLimitedUntil(errorBody);
            }
            this.logger.warn(`Groq ${input.featureLabel} rate-limited on model ${currentModel}; retrying once`);
            await this.delay(350);
            continue;
          }

          if (response.status === 429 && input.featureLabel === "generateSqlQuery") {
            this.markSqlRateLimitedUntil(errorBody);
          }

          const isModelDecommissioned =
            response.status === 400 && /model_decommissioned|decommissioned and is no longer supported/i.test(errorBody);
          if (isModelDecommissioned) {
            this.decommissionedModels.add(currentModel);
            this.logger.warn(`Groq model ${currentModel} is decommissioned; marking as unavailable for this process.`);
          }

          this.logger.error(`Groq ${input.featureLabel} failed with status ${response.status} on model ${currentModel}`);
          if (errorBody) {
            this.logger.warn(`Groq ${input.featureLabel} error body: ${errorBody.slice(0, 300)}`);
          }

          if (nextModel) {
            this.logger.warn(`Groq ${input.featureLabel} switching model from ${currentModel} to ${nextModel}`);
            break;
          }

          return null;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown Groq error";
          this.logger.error(`Groq ${input.featureLabel} error on model ${currentModel}: ${message}`);

          if (nextModel) {
            this.logger.warn(`Groq ${input.featureLabel} switching model from ${currentModel} to ${nextModel}`);
            break;
          }

          return null;
        }
      }
    }

    return null;
  }

  private getGroqApiKey() {
    return this.normalizeEnvValue(this.configService.get<string>("GROQ_API_KEY") ?? process.env.GROQ_API_KEY);
  }

  private getGroqPrimaryModel() {
    return (
      this.normalizeEnvValue(this.configService.get<string>("GROQ_MODEL") ?? process.env.GROQ_MODEL) ??
      "llama-3.3-70b-versatile"
    );
  }

  private getGroqFallbackModel() {
    return (
      this.normalizeEnvValue(this.configService.get<string>("GROQ_FALLBACK_MODEL") ?? process.env.GROQ_FALLBACK_MODEL) ??
      "llama-3.1-8b-instant"
    );
  }

  private getGroqEmergencyFallbackModel() {
    return (
      this.normalizeEnvValue(
        this.configService.get<string>("GROQ_EMERGENCY_FALLBACK_MODEL") ?? process.env.GROQ_EMERGENCY_FALLBACK_MODEL,
      ) ?? "llama-3.1-8b-instant"
    );
  }

  private async delay(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private markSqlRateLimitedUntil(errorBody: string) {
    const fallbackMs = 3 * 60 * 1000;
    const waitMs = this.parseRetryAfterMsFromError(errorBody) ?? fallbackMs;
    const target = Date.now() + waitMs;
    if (target > this.sqlRateLimitedUntil) {
      this.sqlRateLimitedUntil = target;
    }
  }

  private parseRetryAfterMsFromError(errorBody: string) {
    const match = errorBody.match(/try again in\s+((?:\d+m)?\s*(?:\d+(?:\.\d+)?)s)/i);
    if (!match?.[1]) {
      return null;
    }

    const segment = match[1].trim().toLowerCase();
    const minuteMatch = segment.match(/(\d+)m/);
    const secondMatch = segment.match(/(\d+(?:\.\d+)?)s/);

    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    const seconds = secondMatch ? Number(secondMatch[1]) : 0;
    const totalMs = (minutes * 60 + seconds) * 1000;

    return Number.isFinite(totalMs) && totalMs > 0 ? totalMs : null;
  }

  private normalizeEnvValue(value: string | undefined) {
    if (!value) {
      return undefined;
    }

    return value.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }

  private safeParseLeadData(content: string, transcript: string) {
    try {
      const normalized = content
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      return JSON.parse(normalized) as {
        name?: string;
        intent?: string;
        notes?: string;
      };
    } catch {
      this.logger.warn("Groq returned non-JSON lead data; using fallback extraction");
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }
  }

  private safeParseFunctionRouteSelection(content: string): FunctionRouteSelection | null {
    try {
      const normalized = content
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      const jsonCandidate = this.extractFirstJsonObject(normalized) ?? normalized;
      const parsed = JSON.parse(jsonCandidate) as {
        function?: unknown;
        data?: unknown;
      };

      const fn = Number(parsed.function);
      if (fn !== 1 && fn !== 2 && fn !== 3) {
        return null;
      }

      return {
        function: fn,
        data: parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : {},
      };
    } catch {
      this.logger.warn("Groq returned non-JSON function route; falling back to deterministic routing");
      return null;
    }
  }

  private extractFirstJsonObject(text: string) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }

    return text.slice(firstBrace, lastBrace + 1);
  }

  private truncateForLog(value: string, maxLength = 300) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
