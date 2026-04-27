import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { callTurns, calls } from "../database/schema";

type CallStatus = "initiated" | "in_progress" | "answered" | "missed" | "completed" | "failed";

type CallLog = {
  id: string;
  businessId: string;
  exotelCallSid?: string;
  fromNumber: string;
  toNumber: string;
  originalBusinessNumber?: string;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CallsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: {
    businessId: string;
    exotelCallSid?: string;
    fromNumber: string;
    toNumber: string;
    originalBusinessNumber?: string;
    meta?: Record<string, unknown>;
  }) {
    const now = new Date();
    const [created] = await this.database.db
      .insert(calls)
      .values({
        id: randomUUID(),
        businessId: Number(input.businessId),
        exotelCallSid: input.exotelCallSid,
        fromNumber: input.fromNumber,
        toNumber: input.toNumber,
        originalBusinessNumber: input.originalBusinessNumber,
        status: "initiated",
        startedAt: now,
        meta: input.meta ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return [this.mapCall(created)];
  }

  async listByBusiness(businessId: string) {
    const rows = await this.database.db
      .select()
      .from(calls)
      .where(eq(calls.businessId, Number(businessId)))
      .orderBy(desc(calls.createdAt));

    return rows.map((row) => this.mapCall(row));
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

  async updateStatus(callId: string, status: CallStatus) {
    const [updated] = await this.database.db
      .update(calls)
      .set({
        status,
        updatedAt: new Date(),
        endedAt: status === "completed" ? new Date() : undefined,
      })
      .where(eq(calls.id, callId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Call not found");
    }

    return this.mapCall(updated);
  }

  async attachTranscript(callId: string, transcript: string, summary?: string, durationSeconds?: number) {
    const [updated] = await this.database.db
      .update(calls)
      .set({
        transcript,
        summary,
        durationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Call not found");
    }

    return this.mapCall(updated);
  }

  async getBusinessCallOrFail(businessId: string, callId: string) {
    const [call] = await this.database.db
      .select()
      .from(calls)
      .where(and(eq(calls.id, callId), eq(calls.businessId, Number(businessId))))
      .limit(1);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return this.mapCall(call);
  }

  async getByIdOrFail(callId: string) {
    const [call] = await this.database.db.select().from(calls).where(eq(calls.id, callId)).limit(1);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return this.mapCall(call);
  }

  async getByExotelCallSid(exotelCallSid: string) {
    if (!exotelCallSid?.trim()) {
      return null;
    }

    const [call] = await this.database.db
      .select()
      .from(calls)
      .where(eq(calls.exotelCallSid, exotelCallSid.trim()))
      .limit(1);

    return call ? this.mapCall(call) : null;
  }

  async appendConversationTurn(
    callId: string,
    turn: { speaker: "customer" | "agent"; text: string; createdAt: string },
  ) {
    await this.getByIdOrFail(callId);

    await this.database.db.insert(callTurns).values({
      callId,
      speaker: turn.speaker,
      text: turn.text,
      createdAt: new Date(turn.createdAt),
    });

    const [updated] = await this.database.db
      .update(calls)
      .set({ updatedAt: new Date() })
      .where(eq(calls.id, callId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Call not found");
    }

    return this.mapCall(updated);
  }

  async buildTranscriptFromMeta(call: Awaited<ReturnType<CallsService["getByIdOrFail"]>>) {
    const turns = await this.database.db
      .select({ speaker: callTurns.speaker, text: callTurns.text })
      .from(callTurns)
      .where(eq(callTurns.callId, call.id))
      .orderBy(callTurns.createdAt);

    return turns.map((turn) => `${turn.speaker === "agent" ? "Agent" : "Customer"}: ${turn.text}`).join("\n");
  }

  private mapCall(row: typeof calls.$inferSelect): CallLog {
    return {
      id: row.id,
      businessId: String(row.businessId),
      exotelCallSid: row.exotelCallSid ?? undefined,
      fromNumber: row.fromNumber,
      toNumber: row.toNumber,
      originalBusinessNumber: row.originalBusinessNumber ?? undefined,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : undefined,
      durationSeconds: row.durationSeconds ?? undefined,
      transcript: row.transcript ?? undefined,
      summary: row.summary ?? undefined,
      meta: (row.meta ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
