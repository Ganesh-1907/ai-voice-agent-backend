import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { users } from "../database/schema";

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

    const [user] = await this.database.db
      .insert(users)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      });

    return user;
  }

  async findByEmail(email: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return user ?? null;
  }

  async findByIdOrFail(id: string) {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
}
