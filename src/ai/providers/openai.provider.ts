import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async generateReply(prompt: string, customerText: string) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    const model = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";

    if (!apiKey) {
      this.logger.warn("OpenAI API key missing; returning fallback response");
      return {
        text: "Thanks for calling. We have captured your request and our team will contact you shortly.",
      };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: customerText,
            },
          ],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        this.logger.error(`OpenAI generateReply failed with status ${response.status}`);
        return {
          text: "Thanks for calling. We have captured your request and our team will contact you shortly.",
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return {
        text:
          payload.choices?.[0]?.message?.content?.trim() ??
          "Thanks for calling. We have captured your request and our team will contact you shortly.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      this.logger.error(`OpenAI generateReply error: ${message}`);
      return {
        text: "Thanks for calling. We have captured your request and our team will contact you shortly.",
      };
    }
  }

  async extractLeadData(transcript: string) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    const model = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";

    if (!apiKey) {
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Extract lead information from the call transcript. Return JSON with keys: name, intent, notes.",
            },
            {
              role: "user",
              content: transcript,
            },
          ],
          temperature: 0,
        }),
      });

      if (!response.ok) {
        this.logger.error(`OpenAI extractLeadData failed with status ${response.status}`);
        return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "{}";

      return this.safeParseLeadData(content, transcript);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      this.logger.error(`OpenAI extractLeadData error: ${message}`);
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }
  }

  async generateSummary(transcript: string) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    const model = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";

    if (!apiKey) {
      return transcript.slice(0, 240);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
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
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        this.logger.error(`OpenAI generateSummary failed with status ${response.status}`);
        return transcript.slice(0, 240);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return payload.choices?.[0]?.message?.content?.trim() ?? transcript.slice(0, 240);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      this.logger.error(`OpenAI generateSummary error: ${message}`);
      return transcript.slice(0, 240);
    }
  }

  async transcribeAudio(input: { buffer: Buffer; filename: string; mimeType: string }) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    const model = this.configService.get<string>("OPENAI_TRANSCRIPTION_MODEL") ?? "whisper-1";

    if (!apiKey) {
      this.logger.warn("OpenAI API key missing; transcription fallback returns empty text");
      return { text: "", error: "OPENAI_API_KEY is not configured", statusCode: 503 };
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

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          const payload = (await response.json()) as { text?: string };
          return { text: typeof payload.text === "string" ? payload.text.trim() : "" };
        }

        const errorBody = (await response.text().catch(() => "")).trim();

        if (response.status === 429 && attempt < maxAttempts) {
          this.logger.warn("OpenAI transcription rate-limited; retrying once");
          await this.delay(1000);
          continue;
        }

        this.logger.error(`OpenAI transcribeAudio failed with status ${response.status}`);
        return {
          text: "",
          error: errorBody || `OpenAI transcription failed with status ${response.status}`,
          statusCode: response.status,
        };
      }

      return { text: "", error: "OpenAI transcription failed", statusCode: 500 };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI transcription error";
      this.logger.error(`OpenAI transcribeAudio error: ${message}`);
      return { text: "", error: message, statusCode: 500 };
    }
  }

  private async delay(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private safeParseLeadData(content: string, transcript: string) {
    try {
      return JSON.parse(content) as {
        name?: string;
        intent?: string;
        notes?: string;
      };
    } catch {
      this.logger.warn("OpenAI returned non-JSON lead data; using fallback extraction");
      return { name: undefined, intent: "general inquiry", notes: transcript.slice(0, 400) };
    }
  }
}
