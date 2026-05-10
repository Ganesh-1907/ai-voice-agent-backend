import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses, callRequests, calls, orders, products } from "../database/schema";
import { UsersService } from "../users/users.service";

const CALLBACK_STATUSES = ["callback_scheduled", "callback_completed", "called", "not_called"] as const;

@Injectable()
export class UiService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async getDashboardStats(userId: string, requestedBusinessId?: string) {
    const businessIds = await this.resolveAccessibleBusinessIds(userId, requestedBusinessId);
    if (businessIds.length === 0) {
      return {
        totalBusinesses: 0,
        totalProducts: 0,
        totalCalls: 0,
        totalOrders: 0,
      };
    }

    const [productRows, callRows, orderRows] = await Promise.all([
      this.database.db
        .select({ id: products.id })
        .from(products)
        .where(this.buildBusinessFilter(products.businessId, businessIds)),
      this.database.db
        .select({ id: calls.id })
        .from(calls)
        .where(this.buildBusinessFilter(calls.businessId, businessIds)),
      this.database.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(this.buildBusinessFilter(orders.businessId, businessIds), isNotNull(orders.productId))),
    ]);

    return {
      totalBusinesses: businessIds.length,
      totalProducts: productRows.length,
      totalCalls: callRows.length,
      totalOrders: orderRows.length,
    };
  }

  async listCallLeads(userId: string, requestedBusinessId?: string) {
    const businessIds = await this.resolveAccessibleBusinessIds(userId, requestedBusinessId);
    if (businessIds.length === 0) {
      return [];
    }

    const rows = await this.database.db
      .select({
        id: calls.id,
        fromNumber: calls.fromNumber,
        businessId: calls.businessId,
        businessName: businesses.businessName,
        readStatus: calls.readStatus,
        transcript: calls.transcript,
        summary: calls.summary,
        durationSeconds: calls.durationSeconds,
        createdAt: calls.createdAt,
      })
      .from(calls)
      .leftJoin(businesses, eq(calls.businessId, businesses.id))
      .where(this.buildBusinessFilter(calls.businessId, businessIds))
      .orderBy(desc(calls.createdAt));

    return rows.map((row) => ({
      id: row.id,
      fromNumber: row.fromNumber,
      businessId: String(row.businessId),
      businessName: row.businessName ?? "Unknown Business",
      status: row.readStatus === "read" ? "read" : "unread",
      transcript: row.transcript ?? undefined,
      summary: row.summary ?? undefined,
      duration: row.durationSeconds ?? 0,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async updateCallLeadStatus(userId: string, callId: string, status: "read" | "unread") {
    const [existing] = await this.database.db
      .select({ id: calls.id, businessId: calls.businessId })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Call lead not found");
    }

    await this.assertBusinessAccess(userId, String(existing.businessId));

    const [updated] = await this.database.db
      .update(calls)
      .set({
        readStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, callId))
      .returning({ id: calls.id, readStatus: calls.readStatus });

    return {
      id: updated.id,
      status: updated.readStatus === "read" ? "read" : "unread",
    };
  }

  async listOrders(userId: string, requestedBusinessId?: string) {
    const businessIds = await this.resolveAccessibleBusinessIds(userId, requestedBusinessId);
    if (businessIds.length === 0) {
      return [];
    }

    const rows = await this.database.db
      .select({
        id: orders.id,
        businessId: orders.businessId,
        businessName: businesses.businessName,
        productId: orders.productId,
        productName: products.name,
        customerNumber: orders.customerNumber,
        status: orders.status,
        summary: orders.summary,
        transcript: orders.transcript,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(this.buildBusinessFilter(orders.businessId, businessIds), isNotNull(orders.productId)))
      .orderBy(desc(orders.createdAt));

    return rows.map((row) => ({
      id: String(row.id),
      customerNumber: row.customerNumber,
      businessId: String(row.businessId),
      businessName: row.businessName ?? "Unknown Business",
      productId: row.productId === null ? "" : String(row.productId),
      productName: row.productName ?? "Unknown Product",
      status: row.status === "accepted" || row.status === "rejected" ? row.status : "pending",
      summary: row.summary ?? undefined,
      transcript: row.transcript ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async updateOrderStatus(userId: string, orderId: string, status: "pending" | "accepted" | "rejected") {
    const [existing] = await this.database.db
      .select({ id: orders.id, businessId: orders.businessId })
      .from(orders)
      .where(eq(orders.id, Number(orderId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Order not found");
    }

    await this.assertBusinessAccess(userId, String(existing.businessId));

    const now = new Date();
    const [updated] = await this.database.db
      .update(orders)
      .set({
        status,
        acceptedAt: status === "accepted" ? now : null,
        rejectedAt: status === "rejected" ? now : null,
        updatedAt: now,
      })
      .where(eq(orders.id, Number(orderId)))
      .returning({ id: orders.id, status: orders.status });

    return {
      id: String(updated.id),
      status: updated.status,
    };
  }

  async listCallbacks(userId: string, requestedBusinessId?: string) {
    const businessIds = await this.resolveAccessibleBusinessIds(userId, requestedBusinessId);
    if (businessIds.length === 0) {
      return [];
    }

    const rows = await this.database.db
      .select({
        id: callRequests.id,
        businessId: callRequests.businessId,
        businessName: businesses.businessName,
        customerMobile: callRequests.customerMobile,
        fromNumber: callRequests.fromNumber,
        status: callRequests.status,
        requestType: callRequests.requestType,
        summary: callRequests.summary,
        transcript: callRequests.transcript,
        createdAt: callRequests.createdAt,
      })
      .from(callRequests)
      .leftJoin(businesses, eq(callRequests.businessId, businesses.id))
      .where(
        and(
          this.buildBusinessFilter(callRequests.businessId, businessIds),
          or(
            eq(callRequests.requestType, "callback_request"),
            inArray(callRequests.status, [...CALLBACK_STATUSES]),
          ),
        ),
      )
      .orderBy(desc(callRequests.createdAt));

    return rows.map((row) => ({
      id: row.id,
      customerNumber: row.customerMobile ?? row.fromNumber,
      businessId: String(row.businessId),
      businessName: row.businessName ?? "Unknown Business",
      status: row.status === "called" || row.status === "callback_completed" ? "called" : "not_called",
      summary: row.summary ?? undefined,
      transcript: row.transcript ?? undefined,
      createdAt: row.createdAt.toISOString(),
      requestType: row.requestType,
    }));
  }

  async updateCallbackStatus(userId: string, callbackId: string, status: "called" | "not_called") {
    const [existing] = await this.database.db
      .select({ id: callRequests.id, businessId: callRequests.businessId })
      .from(callRequests)
      .where(eq(callRequests.id, callbackId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Callback request not found");
    }

    await this.assertBusinessAccess(userId, String(existing.businessId));

    const now = new Date();
    const [updated] = await this.database.db
      .update(callRequests)
      .set({
        status,
        calledBack: status === "called",
        calledBackAt: status === "called" ? now : null,
        updatedAt: now,
      })
      .where(eq(callRequests.id, callbackId))
      .returning({ id: callRequests.id, status: callRequests.status });

    return {
      id: updated.id,
      status: updated.status,
    };
  }

  private async resolveAccessibleBusinessIds(userId: string, requestedBusinessId?: string) {
    const user = await this.usersService.findByIdOrFail(userId);
    const businessId = requestedBusinessId?.trim();

    if (businessId) {
      if (user.role !== "super_admin" && user.businessId !== businessId) {
        throw new ForbiddenException("You do not have access to this business");
      }

      return [Number(businessId)];
    }

    if (user.role === "super_admin") {
      const rows = await this.database.db.select({ id: businesses.id }).from(businesses);
      return rows.map((row) => row.id);
    }

    return user.businessId ? [Number(user.businessId)] : [];
  }

  private async assertBusinessAccess(userId: string, businessId: string) {
    const user = await this.usersService.findByIdOrFail(userId);
    if (user.role === "super_admin") {
      return;
    }

    if (user.businessId !== businessId) {
      throw new ForbiddenException("You do not have access to this business");
    }
  }

  private buildBusinessFilter(column: typeof calls.businessId | typeof orders.businessId | typeof callRequests.businessId | typeof products.businessId, businessIds: number[]) {
    return businessIds.length === 1 ? eq(column, businessIds[0]) : inArray(column, businessIds);
  }
}
