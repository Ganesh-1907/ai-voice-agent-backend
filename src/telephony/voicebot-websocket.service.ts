import { Inject, Injectable, Logger } from "@nestjs/common";
import { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";

import { AiService } from "../ai/ai.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CallsService } from "../calls/calls.service";
import { LeadsService } from "../leads/leads.service";
import { UpdatesService } from "../updates/updates.service";

type ExotelStartMessage = {
  event: "start";
  stream_sid?: string;
  streamSid?: string;
  start?: {
    stream_sid?: string;
    streamSid?: string;
    call_sid?: string;
    callSid?: string;
    from?: string;
    to?: string;
    media_format?: {
      sample_rate?: string | number;
      sampleRate?: string | number;
      encoding?: string;
    };
  };
};

type ExotelMediaMessage = {
  event: "media";
  stream_sid?: string;
  streamSid?: string;
  media?: {
    payload?: string;
  };
};

type ExotelStopMessage = {
  event: "stop";
  stream_sid?: string;
  streamSid?: string;
  stop?: {
    call_sid?: string;
    callSid?: string;
    reason?: string;
  };
};

type VoicebotSession = {
  ws: WebSocket;
  sessionId: string;
  streamSid?: string;
  callId?: string;
  exotelCallSid?: string;
  business?: Awaited<ReturnType<BusinessesService["getByRoutingNumber"]>>;
  fromNumber?: string;
  toNumber?: string;
  startedAt?: Date;
  sampleRate: number;
  audioEncoding: "linear16" | "mulaw";
  audioChunks: Buffer[];
  processing: boolean;
  sendingAudio: boolean;
  echoUntilMs?: number;
  flushTimer?: NodeJS.Timeout;
  sequenceNumber: number;
  mediaChunk: number;
  inboundMediaMessages: number;
  inboundBytes: number;
  speechStarted: boolean;
  silenceMs: number;
  bufferedAudioMs: number;
};

@Injectable()
export class VoicebotWebSocketService {
  private readonly logger = new Logger(VoicebotWebSocketService.name);
  private readonly processingPrompt = "One moment.";
  private readonly speechStartThreshold = 1800;
  private readonly speechEndThreshold = 1200;
  private readonly noiseArtifactRmsThreshold = 1200;
  private readonly silenceFlushMs = 1200;
  private readonly maxTurnAudioMs = 6000;
  private readonly minTranscriptionAudioMs = 350;
  private readonly trimSilencePaddingMs = 160;
  private readonly greetingAudioCache = new Map<string, Buffer>();
  private server?: WebSocketServer;

  constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(CallsService) private readonly callsService: CallsService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(UpdatesService) private readonly updatesService: UpdatesService,
    @Inject(LeadsService) private readonly leadsService: LeadsService,
  ) {}

  attach(httpServer: HttpServer) {
    if (this.server) {
      return;
    }

    this.server = new WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "", "http://localhost");
      if (url.pathname !== "/api/telephony/voicebot/media") {
        return;
      }

      this.server?.handleUpgrade(request, socket, head, (ws) => {
        this.server?.emit("connection", ws, request);
      });
    });

    this.server.on("connection", (ws, request) => {
      const url = new URL(request.url ?? "", "http://localhost");
      const sampleRate = Number(url.searchParams.get("sample-rate") ?? url.searchParams.get("sample_rate") ?? "8000");
      const session: VoicebotSession = {
        ws,
        sessionId: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        sampleRate: Number.isFinite(sampleRate) ? sampleRate : 8000,
        audioEncoding: "mulaw",
        audioChunks: [],
        processing: false,
        sendingAudio: false,
        sequenceNumber: 1,
        mediaChunk: 1,
        inboundMediaMessages: 0,
        inboundBytes: 0,
        speechStarted: false,
        silenceMs: 0,
        bufferedAudioMs: 0,
      };

      this.logger.log(
        `[${session.sessionId}] websocket connected path=${url.pathname} sampleRate=${session.sampleRate} remote=${request.socket.remoteAddress ?? "unknown"}`,
      );

      ws.on("message", (data) => {
        void this.handleMessage(session, data.toString());
      });

      ws.on("close", () => {
        this.logger.log(
          `[${session.sessionId}] websocket closed callId=${session.callId ?? "none"} mediaMessages=${session.inboundMediaMessages} inboundBytes=${session.inboundBytes}`,
        );
        if (session.flushTimer) {
          clearTimeout(session.flushTimer);
        }
      });

      ws.on("error", (error) => {
        this.logger.error(`[${session.sessionId}] websocket error: ${error.message}`);
      });
    });

    this.logger.log("Exotel voicebot websocket endpoint mounted at /api/telephony/voicebot/media");
    void this.prewarmPromptAudio();
  }

  private async handleMessage(session: VoicebotSession, rawMessage: string) {
    const message = this.parseJson(rawMessage);
    if (!message || typeof message.event !== "string") {
      this.logger.warn(`[${session.sessionId}] ignored non-json/invalid websocket message size=${rawMessage.length}`);
      return;
    }

    if (message.event === "connected") {
      this.logger.log(`[${session.sessionId}] Exotel event=connected`);
      return;
    }

    if (message.event === "start") {
      await this.handleStart(session, message as ExotelStartMessage);
      return;
    }

    if (message.event === "media") {
      this.handleMedia(session, message as ExotelMediaMessage);
      return;
    }

    if (message.event === "stop") {
      await this.handleStop(session, message as ExotelStopMessage);
      return;
    }

    if (message.event === "mark") {
      this.logger.log(`[${session.sessionId}] Exotel event=mark payload=${this.truncate(rawMessage)}`);
      return;
    }

    if (message.event === "dtmf") {
      this.logger.log(`[${session.sessionId}] Exotel event=dtmf payload=${this.truncate(rawMessage)}`);
      return;
    }

    this.logger.debug(`[${session.sessionId}] ignored Exotel event=${message.event}`);
  }

  private async handleStart(session: VoicebotSession, message: ExotelStartMessage) {
    const start = message.start ?? {};
    session.streamSid = message.stream_sid ?? message.streamSid ?? start.stream_sid ?? start.streamSid;
    session.exotelCallSid = start.call_sid ?? start.callSid;
    session.fromNumber = start.from;
    session.toNumber = start.to;

    const sampleRate = Number(start.media_format?.sample_rate ?? start.media_format?.sampleRate);
    if (Number.isFinite(sampleRate) && sampleRate > 0) {
      session.sampleRate = sampleRate;
    }

    const encodingRaw = (start.media_format?.encoding ?? "").toLowerCase();
    if (encodingRaw.includes("linear") || encodingRaw.includes("l16") || encodingRaw.includes("pcm")) {
      session.audioEncoding = "linear16";
    } else {
      session.audioEncoding = "mulaw";
    }

    this.logger.log(
      `[${session.sessionId}] Exotel event=start streamSid=${session.streamSid ?? "missing"} callSid=${session.exotelCallSid ?? "missing"} from=${session.fromNumber ?? "missing"} to=${session.toNumber ?? "missing"} sampleRate=${session.sampleRate} audioEncoding=${session.audioEncoding}`,
    );

    const business =
      (session.fromNumber ? await this.businessesService.getByRoutingNumber(session.fromNumber) : null) ??
      (session.toNumber ? await this.businessesService.getByRoutingNumber(session.toNumber) : null);

    session.business = business;

    if (!business) {
      this.logger.warn(
        `[${session.sessionId}] business mapping failed from=${session.fromNumber ?? "missing"} to=${session.toNumber ?? "missing"}`,
      );
      return;
    }

    this.logger.log(
      `[${session.sessionId}] business mapped businessId=${business.id} businessName="${business.name}" routeNumber=${business.businessPhoneNumber}`,
    );

    const existingCall = session.exotelCallSid
      ? await this.callsService.getByExotelCallSid(session.exotelCallSid)
      : null;

    const call = existingCall ?? (await this.callsService.create({
      businessId: business.id,
      exotelCallSid: session.exotelCallSid,
      fromNumber: session.fromNumber ?? "unknown",
      toNumber: session.toNumber ?? "unknown",
      originalBusinessNumber: session.fromNumber,
      meta: {
        mode: "exotel-voicebot",
        start,
      },
    }))[0];

    session.callId = call.id;
    session.startedAt = new Date();
    this.logger.log(`[${session.sessionId}] call created callId=${session.callId} status=${call.status}`);

    const greeting = this.businessesService.getAgentGreeting(business);
    this.logger.log(`[${session.sessionId}] sending agent greeting text="${this.truncate(greeting)}"`);
    session.sendingAudio = true;
    await this.sendTextReply(session, greeting);
    session.sendingAudio = false;
    session.echoUntilMs = Date.now() + 600;
    // Discard any echo captured on the inbound channel during greeting playback
    session.audioChunks = [];
    session.speechStarted = false;
    session.silenceMs = 0;
    session.bufferedAudioMs = 0;
    await this.callsService.appendConversationTurn(session.callId, {
      speaker: "agent",
      text: greeting,
      createdAt: new Date().toISOString(),
    });
    this.logger.log(`[${session.sessionId}] greeting sent — waiting for customer to speak`);
  }

  private handleMedia(session: VoicebotSession, message: ExotelMediaMessage) {
    const payload = message.media?.payload;
    if (!payload) {
      return;
    }

    const chunk = Buffer.from(payload, "base64");
    session.inboundMediaMessages += 1;
    session.inboundBytes += chunk.length;
    if (session.inboundMediaMessages === 1 || session.inboundMediaMessages % 50 === 0) {
      this.logger.log(
        `[${session.sessionId}] inbound media messages=${session.inboundMediaMessages} bufferedChunks=${session.audioChunks.length} inboundBytes=${session.inboundBytes}`,
      );
    }

    if (!session.business || session.processing) {
      return;
    }

    if (session.sendingAudio || (session.echoUntilMs !== undefined && Date.now() < session.echoUntilMs)) {
      return;
    }

    const bytesPerSample = session.audioEncoding === "mulaw" ? 1 : 2;
    const chunkDurationMs = Math.round((chunk.length / (session.sampleRate * bytesPerSample)) * 1000);
    const averageAmplitude = this.computeAverageAmplitude(chunk, session.audioEncoding);
    const hasSpeechStart = averageAmplitude >= this.speechStartThreshold;
    const hasSpeechContinuation = averageAmplitude >= this.speechEndThreshold;

    if (!session.speechStarted) {
      if (!hasSpeechStart) {
        return;
      }

      session.speechStarted = true;
      session.silenceMs = 0;
      session.bufferedAudioMs = 0;
      this.logger.log(
        `[${session.sessionId}] caller speech detected amplitude=${Math.round(averageAmplitude)} threshold=${this.speechStartThreshold}`,
      );
    }

    session.audioChunks.push(chunk);
    session.bufferedAudioMs += chunkDurationMs;
    session.silenceMs = hasSpeechContinuation ? 0 : session.silenceMs + chunkDurationMs;

    if (session.silenceMs >= this.silenceFlushMs || session.bufferedAudioMs >= this.maxTurnAudioMs) {
      const flushReason = session.silenceMs >= this.silenceFlushMs ? "silence" : "max-duration";
      void this.flushAudio(session, flushReason);
    }
  }

  private async handleStop(session: VoicebotSession, message: ExotelStopMessage) {
    const stop = message.stop ?? {};
    this.logger.log(
      `[${session.sessionId}] Exotel event=stop streamSid=${message.stream_sid ?? message.streamSid ?? session.streamSid ?? "missing"} callSid=${stop.call_sid ?? stop.callSid ?? session.exotelCallSid ?? "missing"} reason=${stop.reason ?? "missing"}`,
    );
    await this.flushAudio(session, "stop");
    await this.finalizeCall(session);
  }

  private async finalizeCall(session: VoicebotSession) {
    if (!session.callId || !session.business) {
      return;
    }

    const durationSeconds = session.startedAt
      ? Math.round((Date.now() - session.startedAt.getTime()) / 1000)
      : undefined;

    try {
      const call = await this.callsService.getByIdOrFail(session.callId);
      const transcript = await this.callsService.buildTranscriptFromMeta(call);

      if (!transcript.trim()) {
        if (durationSeconds !== undefined) {
          await this.callsService.attachTranscript(session.callId, "", undefined, durationSeconds);
        }
        await this.callsService.updateStatus(session.callId, "completed");
        this.logger.log(`[${session.sessionId}] call finalized (no transcript) durationSeconds=${durationSeconds ?? 0}`);
        return;
      }

      const summary = await this.aiService.generateSummary(transcript);
      await this.callsService.attachTranscript(session.callId, transcript, summary, durationSeconds);
      await this.callsService.updateStatus(session.callId, "completed");

      this.logger.log(
        `[${session.sessionId}] call finalized callId=${session.callId} durationSeconds=${durationSeconds ?? 0} transcriptLen=${transcript.length}`,
      );

      await this.updatesService.createFromCall({
        businessId: session.business.id,
        callId: session.callId,
        fromNumber: session.fromNumber ?? "unknown",
        summary,
        transcript,
      });

      const extractedLead = await this.aiService.extractLeadData(transcript);
      await this.leadsService.create(
        session.business.id,
        {
          name: extractedLead.name,
          phone: session.fromNumber ?? "unknown",
          intent: extractedLead.intent,
          notes: extractedLead.notes,
        },
        session.callId,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown finalization error";
      this.logger.error(`[${session.sessionId}] call finalization failed callId=${session.callId}: ${msg}`);
    }
  }

  private async flushAudio(session: VoicebotSession, reason = "manual") {
    if (session.processing || session.audioChunks.length === 0 || !session.business || !session.callId) {
      if (!session.processing && session.audioChunks.length > 0) {
        this.logger.warn(
          `[${session.sessionId}] skipped audio flush chunks=${session.audioChunks.length} hasBusiness=${Boolean(session.business)} hasCallId=${Boolean(session.callId)}`,
        );
      }
      return;
    }

    const pcmBuffer = Buffer.concat(session.audioChunks);
    const bufferedAudioMs = session.bufferedAudioMs;
    session.audioChunks = [];
    session.speechStarted = false;
    session.silenceMs = 0;
    session.bufferedAudioMs = 0;
    if (bufferedAudioMs < this.minTranscriptionAudioMs) {
      this.logger.log(
        `[${session.sessionId}] skipped short audio buffer bytes=${pcmBuffer.length} durationMs=${bufferedAudioMs} sampleRate=${session.sampleRate}`,
      );
      return;
    }

    // Decode μ-law once and reuse for both energy check and WAV creation
    const linear16Buffer = session.audioEncoding === "mulaw" ? this.decodeMuLaw(pcmBuffer) : pcmBuffer;
    const rawRms = this.computeRms(linear16Buffer);
    if (rawRms < 400) {
      this.logger.log(
        `[${session.sessionId}] skipped low-energy audio rms=${Math.round(rawRms)} encoding=${session.audioEncoding} — likely echo or silence`,
      );
      return;
    }

    const trimmedLinear16Buffer = this.trimLinear16Silence(linear16Buffer, session.sampleRate);
    const trimmedAudioMs = Math.round((trimmedLinear16Buffer.length / (session.sampleRate * 2)) * 1000);
    if (trimmedAudioMs < this.minTranscriptionAudioMs) {
      this.logger.log(
        `[${session.sessionId}] skipped short speech after trim rawDurationMs=${bufferedAudioMs} speechDurationMs=${trimmedAudioMs} rawRms=${Math.round(rawRms)} encoding=${session.audioEncoding}`,
      );
      return;
    }

    const rms = this.computeRms(trimmedLinear16Buffer);
    session.processing = true;
    try {
      this.logger.log(
        `[${session.sessionId}] transcribing audio bytes=${pcmBuffer.length} durationMs=${bufferedAudioMs} speechDurationMs=${trimmedAudioMs} rawRms=${Math.round(rawRms)} rms=${Math.round(rms)} encoding=${session.audioEncoding} reason=${reason}`,
      );
      await this.sendTextReply(session, this.processingPrompt);
      const wavBuffer = this.wrapPcmAsWav(trimmedLinear16Buffer, session.sampleRate);
      const transcription = await this.aiService.transcribeAudio({
        buffer: wavBuffer,
        filename: "exotel-voicebot.wav",
        mimeType: "audio/wav",
      });

      const customerText = transcription.text?.trim();
      this.logger.log(
        `[${session.sessionId}] transcription result text="${this.truncate(customerText || "")}" status=${"statusCode" in transcription ? transcription.statusCode ?? "ok" : "ok"} error=${"error" in transcription ? transcription.error ?? "none" : "none"}`,
      );
      if (!customerText) {
        this.logger.warn(`[${session.sessionId}] empty transcription; no AI turn generated`);
        return;
      }

      if (this.isLikelyNoiseTranscription(customerText, rms)) {
        this.logger.warn(
          `[${session.sessionId}] ignored likely noise transcription text="${this.truncate(customerText)}" rms=${Math.round(rms)} reason=${reason}`,
        );
        return;
      }

      await this.callsService.appendConversationTurn(session.callId, {
        speaker: "customer",
        text: customerText,
        createdAt: new Date().toISOString(),
      });
      const call = await this.callsService.getByIdOrFail(session.callId);
      const conversationContext = await this.callsService.buildTranscriptFromMeta(call);
      const aiReply = await this.aiService.processCallTurn(session.business, customerText, conversationContext, {
        ttsOutputFormat: this.getPcmOutputFormat(session),
      });

      this.logger.log(
        `[${session.sessionId}] AI reply text="${this.truncate(aiReply.replyText)}" audioBytes=${aiReply.audioBase64 ? Buffer.byteLength(aiReply.audioBase64, "base64") : 0}`,
      );

      await this.callsService.appendConversationTurn(session.callId, {
        speaker: "agent",
        text: aiReply.replyText,
        createdAt: new Date().toISOString(),
      });

      if (aiReply.audioBase64) {
        if (session.ws.readyState !== session.ws.OPEN) {
          this.logger.warn(`[${session.sessionId}] websocket closed before AI reply audio could be sent`);
          return;
        }
        session.audioChunks = [];
        session.speechStarted = false;
        session.silenceMs = 0;
        session.bufferedAudioMs = 0;
        session.sendingAudio = true;
        await this.sendPcmAudio(session, Buffer.from(aiReply.audioBase64, "base64"));
        session.sendingAudio = false;
      } else {
        this.logger.warn(`[${session.sessionId}] AI reply has no audio; ElevenLabs/TTS likely failed`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown voicebot processing error";
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[${session.sessionId}] Voicebot turn failed: ${message}`, stack);
    } finally {
      session.echoUntilMs = Date.now() + 600;
      session.processing = false;
      session.sendingAudio = false;
    }
  }

  private async sendTextReply(session: VoicebotSession, text: string) {
    if (!session.business || !session.callId) {
      this.logger.warn(
        `[${session.sessionId}] skipped greeting hasBusiness=${Boolean(session.business)} hasCallId=${Boolean(session.callId)}`,
      );
      return;
    }

    this.logger.log(`[${session.sessionId}] preparing outbound audio text="${this.truncate(text)}"`);
    const outputFormat = this.getPcmOutputFormat(session);
    const cacheKey = `${outputFormat}:${text}`;
    let audioBuffer = this.greetingAudioCache.get(cacheKey);
    if (!audioBuffer) {
      const speech = await this.aiService.textToSpeech(text, {
        ttsOutputFormat: outputFormat,
      });
      if (speech.audioBase64) {
        audioBuffer = Buffer.from(speech.audioBase64, "base64");
        this.greetingAudioCache.set(cacheKey, audioBuffer);
      }
    }
    this.logger.log(
      `[${session.sessionId}] outbound audio ready text="${this.truncate(text)}" audioBytes=${audioBuffer?.length ?? 0} cached=${this.greetingAudioCache.has(cacheKey)}`,
    );
    if (audioBuffer) {
      await this.sendPcmAudio(session, audioBuffer);
      return;
    }

    this.logger.log(`Voicebot text-only fallback: ${text}`);
  }

  private async prewarmPromptAudio() {
    await Promise.all([8000, 16000].map((sampleRate) => this.cacheTextAudio(this.processingPrompt, sampleRate)));
  }

  private async cacheTextAudio(text: string, sampleRate: number) {
    const outputFormat = sampleRate >= 16000 ? "pcm_16000" : "pcm_8000";
    const cacheKey = `${outputFormat}:${text}`;
    if (this.greetingAudioCache.has(cacheKey)) {
      return;
    }

    try {
      const speech = await this.aiService.textToSpeech(text, { ttsOutputFormat: outputFormat });
      if (speech.audioBase64) {
        const audioBuffer = Buffer.from(speech.audioBase64, "base64");
        this.greetingAudioCache.set(cacheKey, audioBuffer);
        this.logger.log(`Prewarmed prompt outputFormat=${outputFormat} text="${text}" bytes=${audioBuffer.length}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown TTS prewarm error";
      this.logger.warn(`Prompt prewarm failed outputFormat=${outputFormat}: ${message}`);
    }
  }

  private getPcmOutputFormat(session: VoicebotSession) {
    return session.sampleRate >= 16000 ? "pcm_16000" : "pcm_8000";
  }

  private async sendPcmAudio(session: VoicebotSession, pcmBuffer: Buffer) {
    if (!session.streamSid || session.ws.readyState !== session.ws.OPEN) {
      this.logger.warn(
        `[${session.sessionId}] cannot send audio streamSid=${session.streamSid ?? "missing"} wsState=${session.ws.readyState}`,
      );
      return;
    }

    // Exotel requires outbound media chunks to be at least 3.2k bytes and
    // in multiples of 320 bytes. Pace each chunk by its actual PCM duration.
    const bytesPerSecond = session.sampleRate * 2;
    const chunkSize = Math.max(this.roundUpToMultiple(Math.round(bytesPerSecond / 10), 320), 3200);
    let chunksSent = 0;
    for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
      if (session.ws.readyState !== session.ws.OPEN) {
        this.logger.warn(`[${session.sessionId}] stopped sending audio because websocket closed chunksSent=${chunksSent}`);
        return;
      }

      const chunk = this.padPcmChunk(pcmBuffer.subarray(offset, offset + chunkSize), 320, 3200);
      chunksSent += 1;
      session.ws.send(
        JSON.stringify({
          event: "media",
          streamSid: session.streamSid,
          media: {
            payload: chunk.toString("base64"),
          },
        }),
      );
      if (offset + chunkSize < pcmBuffer.length) {
        await this.sleep(Math.round((chunk.length / bytesPerSecond) * 1000));
      }
    }

    if (session.ws.readyState !== session.ws.OPEN) {
      this.logger.warn(`[${session.sessionId}] skipped mark because websocket closed chunksSent=${chunksSent}`);
      return;
    }

    session.ws.send(
      JSON.stringify({
        event: "mark",
        streamSid: session.streamSid,
        mark: { name: `reply-${Date.now()}` },
      }),
    );
    this.logger.log(
      `[${session.sessionId}] sent audio to Exotel bytes=${pcmBuffer.length} chunks=${chunksSent} streamSid=${session.streamSid}`,
    );
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private roundUpToMultiple(value: number, multiple: number) {
    return Math.ceil(value / multiple) * multiple;
  }

  private padPcmChunk(chunk: Buffer, multiple: number, minimumSize: number) {
    const paddedSize = Math.max(this.roundUpToMultiple(chunk.length, multiple), minimumSize);
    if (paddedSize === chunk.length) {
      return chunk;
    }

    return Buffer.concat([chunk, Buffer.alloc(paddedSize - chunk.length)]);
  }

  private wrapPcmAsWav(pcmBuffer: Buffer, sampleRate: number) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * 2;
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcmBuffer.length, 40);
    return Buffer.concat([header, pcmBuffer]);
  }

  private computeAverageAmplitude(rawBuffer: Buffer, encoding: "linear16" | "mulaw" = "linear16") {
    const buffer = encoding === "mulaw" ? this.decodeMuLaw(rawBuffer) : rawBuffer;
    if (buffer.length < 2) {
      return 0;
    }

    let totalAmplitude = 0;
    let samples = 0;
    for (let index = 0; index + 1 < buffer.length; index += 2) {
      totalAmplitude += Math.abs(buffer.readInt16LE(index));
      samples += 1;
    }

    return samples > 0 ? totalAmplitude / samples : 0;
  }

  private computeRms(linear16Buffer: Buffer): number {
    if (linear16Buffer.length < 2) {
      return 0;
    }

    let sumSquares = 0;
    let samples = 0;
    for (let i = 0; i + 1 < linear16Buffer.length; i += 2) {
      const sample = linear16Buffer.readInt16LE(i);
      sumSquares += sample * sample;
      samples += 1;
    }

    return Math.sqrt(sumSquares / samples);
  }

  private trimLinear16Silence(linear16Buffer: Buffer, sampleRate: number) {
    if (linear16Buffer.length < 2) {
      return linear16Buffer;
    }

    const frameBytes = Math.max(2, Math.round((sampleRate * 20) / 1000) * 2);
    const paddingBytes = Math.round((sampleRate * this.trimSilencePaddingMs) / 1000) * 2;
    let firstSpeechByte = -1;
    let lastSpeechByte = -1;

    for (let offset = 0; offset < linear16Buffer.length; offset += frameBytes) {
      const end = Math.min(offset + frameBytes, linear16Buffer.length);
      const amplitude = this.computeAverageAmplitude(linear16Buffer.subarray(offset, end), "linear16");
      if (amplitude >= this.speechEndThreshold) {
        if (firstSpeechByte < 0) {
          firstSpeechByte = offset;
        }
        lastSpeechByte = end;
      }
    }

    if (firstSpeechByte < 0 || lastSpeechByte < 0) {
      return Buffer.alloc(0);
    }

    const start = Math.max(0, firstSpeechByte - paddingBytes);
    const end = Math.min(linear16Buffer.length, lastSpeechByte + paddingBytes);
    return linear16Buffer.subarray(start - (start % 2), end - (end % 2));
  }

  private decodeMuLaw(muLawBuffer: Buffer): Buffer {
    const pcm = Buffer.alloc(muLawBuffer.length * 2);
    for (let i = 0; i < muLawBuffer.length; i++) {
      const byte = (~muLawBuffer[i]) & 0xff;
      const sign = byte & 0x80;
      const exponent = (byte >> 4) & 0x07;
      const mantissa = byte & 0x0f;
      let magnitude = ((mantissa << 1) + 33) << exponent;
      magnitude -= 33;
      const sample = sign ? -magnitude : magnitude;
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }
    return pcm;
  }

  private isLikelyNoiseTranscription(text: string, rms: number) {
    if (rms >= this.noiseArtifactRmsThreshold) {
      return false;
    }

    const normalized = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    return ["so", "uh", "um", "hm", "hmm"].includes(normalized);
  }

  private parseJson(rawMessage: string) {
    try {
      return JSON.parse(rawMessage) as { event?: string };
    } catch {
      return null;
    }
  }

  private truncate(value: string, maxLength = 180) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
