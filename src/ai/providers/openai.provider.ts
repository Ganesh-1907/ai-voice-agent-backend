import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async generateReply(prompt: string, customerText: string) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqModel();

    if (!apiKey) {
      this.logger.warn("Groq API key missing; returning fallback response");
      return {
        text: "Thanks for calling. We have captured your request and our team will contact you shortly.",
      };
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      temperature: 0.4,
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

  async extractLeadData(transcript: string) {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqModel();

    if (!apiKey) {
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      temperature: 0,
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
    const model = this.getGroqModel();

    if (!apiKey) {
      return transcript.slice(0, 240);
    }

    const completionText = await this.callChatCompletion({
      apiKey,
      model,
      temperature: 0.2,
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

          return {
            text: typeof payload.text === "string" ? payload.text.trim() : "",
            language: payload.language,
            duration: payload.duration,
            segments: payload.segments,
          };
        }

        const errorBody = (await response.text().catch(() => "")).trim();

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
    messages: ChatMessage[];
    temperature: number;
    featureLabel: "generateReply" | "extractLeadData" | "generateSummary";
  }) {
    try {
      const maxAttempts = 2;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt += 1;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify({
            model: input.model,
            messages: input.messages,
            temperature: input.temperature,
            max_tokens: 90,
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };

          return payload.choices?.[0]?.message?.content;
        }

        const errorBody = (await response.text().catch(() => "")).trim();

        if (response.status === 429 && attempt < maxAttempts) {
          this.logger.warn(`Groq ${input.featureLabel} rate-limited; retrying once`);
          await this.delay(350);
          continue;
        }

        this.logger.error(`Groq ${input.featureLabel} failed with status ${response.status}`);
        if (errorBody) {
          this.logger.warn(`Groq ${input.featureLabel} error body: ${errorBody.slice(0, 300)}`);
        }
        return null;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Groq error";
      this.logger.error(`Groq ${input.featureLabel} error: ${message}`);
      return null;
    }
  }

  private getGroqApiKey() {
    return this.normalizeEnvValue(this.configService.get<string>("GROQ_API_KEY") ?? process.env.GROQ_API_KEY);
  }

  private getGroqModel() {
    return (
      this.normalizeEnvValue(this.configService.get<string>("GROQ_MODEL") ?? process.env.GROQ_MODEL) ??
      "llama-3.1-8b-instant"
    );
  }

  private async delay(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
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
}
