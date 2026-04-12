import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { businesses, users } from "../database/schema";

type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: CreateUserInput) {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("User with this email already exists");
    }

    const bootstrapPhone = this.buildSyntheticPhone();

    const [placeholderBusiness] = await this.database.db
      .insert(businesses)
      .values({
        businessName: `${input.name} Business`,
        slug: this.buildSlug(input.name),
        contactNumber: bootstrapPhone,
        metadata: {
          description: "",
          planCode: "starter",
        },
      })
      .returning();

    const [user] = await this.database.db
      .insert(users)
      .values({
        businessId: placeholderBusiness.id,
        name: input.name,
        email: input.email.toLowerCase(),
        mobile: bootstrapPhone,
        passwordHash: input.passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      });

    return {
      ...user,
      id: String(user.id),
    };
  }

  async findByEmail(email: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return user
      ? {
          ...user,
          id: String(user.id),
          businessId: String(user.businessId),
        }
      : null;
  }

  async findByIdOrFail(id: string) {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, Number(id))).limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      ...user,
      id: String(user.id),
      businessId: String(user.businessId),
    };
  }

  async listByBusiness(businessId: string) {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.businessId, Number(businessId)))
      .orderBy(desc(users.createdAt));

    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      businessId: String(row.businessId),
    }));
  }

  async resetPasswordByEmail(email: string, passwordHash: string) {
    const [user] = await this.database.db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email.toLowerCase()))
      .returning({
        id: users.id,
        email: users.email,
        updatedAt: users.updatedAt,
      });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      ...user,
      id: String(user.id),
    };
  }

  private buildSlug(name: string) {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);

    return `${base || "business"}-${Date.now()}`;
  }

  private buildSyntheticPhone() {
    const suffix = String(Date.now()).slice(-9);
    return `9${suffix}`;
  }
}
