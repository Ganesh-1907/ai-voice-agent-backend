import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { BusinessesService } from "../businesses/businesses.service";
import { CallsService } from "../calls/calls.service";
import { CompleteCallDto } from "./dto/complete-call.dto";
import { ExotelCallWebhookDto } from "./dto/exotel-call-webhook.dto";
import { PublicTestCallTurnDto } from "./dto/public-test-call-turn.dto";
import { ProcessAgentTurnDto } from "./dto/process-agent-turn.dto";
import { StartPublicTestCallDto } from "./dto/start-public-test-call.dto";
import { StartTestCallDto } from "./dto/start-test-call.dto";
import { TestCallCompleteDto } from "./dto/test-call-complete.dto";
import { TestCallTurnDto } from "./dto/test-call-turn.dto";
import { TelephonyService } from "./telephony.service";

@ApiTags("Telephony")
@Controller("telephony")
export class TelephonyController {
  constructor(
    @Inject(TelephonyService) private readonly telephonyService: TelephonyService,
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
    @Inject(CallsService) private readonly callsService: CallsService,
  ) {}

  @Public()
  @Get("dev/test-call")
  @Header("Content-Type", "text/html; charset=utf-8")
  testCallUi() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Test Call Console</title>
    <style>
      :root {
        --bg: #f3efe6;
        --panel: #fffaf2;
        --ink: #1f1a14;
        --muted: #6f6255;
        --accent: #f97316;
        --accent-deep: #c2410c;
        --ring: #f59e0b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Trebuchet MS", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 15% 10%, #ffe8c6 0, transparent 32%),
          radial-gradient(circle at 85% 80%, #ffd6ae 0, transparent 28%),
          var(--bg);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .panel {
        width: min(900px, 100%);
        background: var(--panel);
        border: 1px solid #ead8c5;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(92, 62, 35, 0.12);
        overflow: hidden;
      }
      .head {
        background: linear-gradient(120deg, #f97316, #fb923c);
        color: white;
        padding: 20px 24px;
      }
      .head h1 {
        margin: 0;
        font-size: 24px;
        letter-spacing: 0.3px;
      }
      .head p {
        margin: 8px 0 0;
        opacity: 0.95;
      }
      .content {
        display: grid;
        gap: 14px;
        padding: 20px;
      }
      .row {
        display: grid;
        gap: 8px;
      }
      label {
        font-weight: 700;
        font-size: 14px;
      }
      input, textarea {
        width: 100%;
        border: 1px solid #d9c7b3;
        border-radius: 12px;
        padding: 12px;
        font-size: 14px;
        background: #fff;
      }
      input:focus, textarea:focus {
        outline: 3px solid color-mix(in srgb, var(--ring) 35%, transparent);
        border-color: var(--ring);
      }
      textarea { min-height: 110px; resize: vertical; }
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 10px 18px;
        background: var(--accent);
        color: white;
        font-weight: 700;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease;
      }
      button:hover { transform: translateY(-1px); background: var(--accent-deep); }
      .status { color: var(--muted); font-size: 13px; }
      .output {
        border: 1px dashed #cfb394;
        border-radius: 12px;
        padding: 12px;
        background: #fff;
      }
      .reply {
        margin: 0;
        white-space: pre-wrap;
        font-size: 15px;
        line-height: 1.5;
      }
      .meta {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <header class="head">
        <h1>AI Test Call Console</h1>
        <p>Simulate customer turns against a business context without real telephony minutes.</p>
      </header>
      <section class="content">
        <div class="row">
          <label for="businessId">Business ID</label>
          <input id="businessId" placeholder="Paste business UUID" />
        </div>

        <div class="row">
          <label for="customerText">Customer says</label>
          <textarea id="customerText" placeholder="Hi, do you provide same-day service?"></textarea>
        </div>

        <div class="actions">
          <button id="sendBtn" type="button">Send Test Turn</button>
          <span class="status" id="status">Ready</span>
        </div>

        <div class="output">
          <strong>AI Reply</strong>
          <p id="reply" class="reply">No response yet.</p>
          <div id="meta" class="meta"></div>
        </div>
      </section>
    </main>

    <script>
      const businessIdEl = document.getElementById("businessId");
      const customerTextEl = document.getElementById("customerText");
      const statusEl = document.getElementById("status");
      const replyEl = document.getElementById("reply");
      const metaEl = document.getElementById("meta");
      const sendBtn = document.getElementById("sendBtn");

      async function sendTurn() {
        const businessId = businessIdEl.value.trim();
        const customerText = customerTextEl.value.trim();

        if (!businessId || !customerText) {
          statusEl.textContent = "Enter both Business ID and customer text.";
          return;
        }

        sendBtn.disabled = true;
        statusEl.textContent = "Thinking...";

        try {
          const response = await fetch("/api/telephony/dev/test-call-turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, customerText }),
          });

          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || "Failed to process test turn");
          }

          replyEl.textContent = payload.aiReply?.replyText || "No reply text returned.";
          metaEl.textContent = "Business: " + payload.businessName + " | Mode: " + payload.mode;
          statusEl.textContent = "Done";
        } catch (error) {
          replyEl.textContent = "";
          metaEl.textContent = "";
          statusEl.textContent = error && error.message ? error.message : "Request failed";
        } finally {
          sendBtn.disabled = false;
        }
      }

      sendBtn.addEventListener("click", sendTurn);
      customerTextEl.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          sendTurn();
        }
      });
    </script>
  </body>
</html>`;
  }

  @Public()
  @Post("webhooks/exotel/incoming-call")
  incomingCall(@Body() dto: ExotelCallWebhookDto) {
    return this.telephonyService.handleIncomingWebhook(dto);
  }

  @Post("calls/:callId/agent-turn")
  processAgentTurn(@Param("callId") callId: string, @Body() dto: ProcessAgentTurnDto) {
    return this.telephonyService.processAgentTurn(callId, dto.customerText);
  }

  @Public()
  @Post("dev/test-call-turn")
  testCallTurn(@Body() dto: TestCallTurnDto) {
    return this.telephonyService.simulateAgentTurn(dto.businessId, dto.customerText);
  }

  @Public()
  @Post("public/test-call/start")
  startPublicTestCall(@Body() dto: StartPublicTestCallDto) {
    return this.telephonyService.startPublicTestCall(dto);
  }

  @Public()
  @Post("public/test-call/:callId/turn")
  publicTestCallTurn(@Param("callId") callId: string, @Body() dto: PublicTestCallTurnDto) {
    return this.telephonyService.processAgentTurn(callId, dto.customerText);
  }

  @Public()
  @Post("public/test-call/:callId/complete")
  publicCompleteTestCall(@Param("callId") callId: string) {
    return this.telephonyService.completeTestCall(callId, {});
  }

  @Public()
  @Post("public/test-call/:callId/transcribe")
  @UseInterceptors(FileInterceptor("audio"))
  async transcribePublicTestCallAudio(
    @Param("callId") callId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Audio file is required");
    }

    await this.callsService.getByIdOrFail(callId);

    return this.telephonyService.transcribeAudio({
      buffer: file.buffer,
      filename: file.originalname ?? "public-test-call.webm",
      mimeType: file.mimetype ?? "audio/webm",
    });
  }

  @ApiBearerAuth()
  @Post("test-call/transcribe")
  @UseInterceptors(FileInterceptor("audio"))
  async transcribeTestCallAudio(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body("businessId") businessId: string,
  ) {
    if (!businessId) {
      throw new BadRequestException("businessId is required");
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException("Audio file is required");
    }

    await this.businessesService.assertAccess(user.sub, businessId);

    return this.telephonyService.transcribeAudio({
      buffer: file.buffer,
      filename: file.originalname ?? "test-call.webm",
      mimeType: file.mimetype ?? "audio/webm",
    });
  }

  @ApiBearerAuth()
  @Post("test-call/start")
  async startTestCall(@CurrentUser() user: JwtUser, @Body() dto: StartTestCallDto) {
    await this.businessesService.assertAccess(user.sub, dto.businessId);
    return this.telephonyService.startTestCall(dto);
  }

  @ApiBearerAuth()
  @Post("test-call/:callId/turn")
  async authenticatedTestCallTurn(
    @CurrentUser() user: JwtUser,
    @Param("callId") callId: string,
    @Body() dto: TestCallTurnDto,
  ) {
    await this.businessesService.assertAccess(user.sub, dto.businessId);
    return this.telephonyService.processAgentTurn(callId, dto.customerText);
  }

  @ApiBearerAuth()
  @Post("test-call/:callId/complete")
  async completeTestCall(
    @CurrentUser() user: JwtUser,
    @Param("callId") callId: string,
    @Body() dto: TestCallCompleteDto,
  ) {
    const call = await this.callsService.getByIdOrFail(callId);
    await this.businessesService.assertAccess(user.sub, call.businessId);
    return this.telephonyService.completeTestCall(callId, dto);
  }

  @ApiBearerAuth()
  @Post("businesses/:businessId/calls/:callId/complete")
  async completeCall(
    @CurrentUser() user: JwtUser,
    @Param("businessId") businessId: string,
    @Param("callId") callId: string,
    @Body() body: CompleteCallDto,
  ) {
    await this.businessesService.assertAccess(user.sub, businessId);
    return this.telephonyService.handleCallCompletion({
      businessId,
      callId,
      transcript: body.transcript,
      customerPhone: body.customerPhone,
    });
  }
}
