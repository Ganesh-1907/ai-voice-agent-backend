import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { calls, callStatusEnum } from "../database/schema";

@Injectable()
export class CallsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  create(input: {
    businessId: string;
    exotelCallSid?: string;
    fromNumber: string;
    toNumber: string;
    originalBusinessNumber?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.database.db
      .insert(calls)
      .values({
        businessId: input.businessId,
        exotelCallSid: input.exotelCallSid,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber,
        originalBusinessNumber: input.originalBusinessNumber,
        meta: input.meta ?? {},
      })
      .returning();
  }

  listByBusiness(businessId: string) {
    return this.database.db
      .select()
      .from(calls)
      .where(eq(calls.businessId, businessId))
      .orderBy(desc(calls.createdAt));
  }

  async getAnalyticsOverview(businessId: string) {
    const businessCalls = await this.listByBusiness(businessId);
    const totalCalls = businessCalls.length;
    const completedCalls = businessCalls.filter((call) => call.status === "completed").length;
    const inProgressCalls = businessCalls.filter((call) => call.status === "in_progress").length;
    const failedCalls = businessCalls.filter((call) => call.status === "failed").length;
    const durations = businessCalls
      .map((call) => call.durationSeconds ?? 0)
      .filter((duration) => duration > 0);

    const averageDurationSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
        : 0;

    return {
      totalCalls,
      completedCalls,
      inProgressCalls,
      failedCalls,
      averageDurationSeconds,
      recentCalls: businessCalls.slice(0, 10),
    };
  }

  async updateStatus(callId: string, status: (typeof callStatusEnum.enumValues)[number]) {
    const [call] = await this.database.db
      .update(calls)
      .set({
        status,
        updatedAt: new Date(),
        endedAt: status === "completed" ? new Date() : undefined,
      })
      .where(eq(calls.id, callId))
      .returning();

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }

  async attachTranscript(callId: string, transcript: string, summary?: string, durationSeconds?: number) {
    const [call] = await this.database.db
      .update(calls)
      .set({
        transcript,
        summary,
        durationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId))
      .returning();

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }

  async getBusinessCallOrFail(businessId: string, callId: string) {
    const [call] = await this.database.db
      .select()
      .from(calls)
      .where(and(eq(calls.id, callId), eq(calls.businessId, businessId)))
      .limit(1);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }

  async getByIdOrFail(callId: string) {
    const [call] = await this.database.db.select().from(calls).where(eq(calls.id, callId)).limit(1);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }

  async appendConversationTurn(
    callId: string,
    turn: { speaker: "customer" | "agent"; text: string; createdAt: string },
  ) {
    const call = await this.getByIdOrFail(callId);
    const currentMeta = (call.meta ?? {}) as Record<string, unknown>;
    const currentTurns = Array.isArray(currentMeta.turns) ? currentMeta.turns : [];

    const [updatedCall] = await this.database.db
      .update(calls)
      .set({
        meta: {
          ...currentMeta,
          turns: [...currentTurns, turn],
        },
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId))
      .returning();

    return updatedCall;
  }

  buildTranscriptFromMeta(call: Awaited<ReturnType<CallsService["getByIdOrFail"]>>) {
    const meta = (call.meta ?? {}) as Record<string, unknown>;
    const turns = Array.isArray(meta.turns)
      ? (meta.turns as Array<{ speaker?: string; text?: string }>)
      : [];

    return turns
      .filter((turn) => typeof turn.speaker === "string" && typeof turn.text === "string")
      .map((turn) => `${turn.speaker === "agent" ? "Agent" : "Customer"}: ${turn.text}`)
      .join("\n");
  }
}
