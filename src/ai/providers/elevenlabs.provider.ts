import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ElevenLabsProvider {
  private readonly logger = new Logger(ElevenLabsProvider.name);
  private ttsTemporarilyDisabled = false;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async textToSpeech(text: string) {
    const apiKey = this.configService.get<string>("ELEVENLABS_API_KEY");
    const voiceId = this.configService.get<string>("ELEVENLABS_VOICE_ID");

    if (this.ttsTemporarilyDisabled) {
      return {
        audioBase64: null,
        text,
      };
    }

    if (!apiKey || !voiceId) {
      this.logger.warn("ElevenLabs is not configured; returning text-only fallback");
      return {
        audioBase64: null,
        text,
      };
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          this.ttsTemporarilyDisabled = true;
          this.logger.warn(`ElevenLabs disabled for this process due to status ${response.status}`);
        } else {
          this.logger.error(`ElevenLabs TTS failed with status ${response.status}`);
        }

        return {
          audioBase64: null,
          text,
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audioBase64: buffer.toString("base64"),
        text,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ElevenLabs error";
      this.logger.error(`ElevenLabs TTS error: ${message}`);
      return {
        audioBase64: null,
        text,
      };
    }
  }
}
