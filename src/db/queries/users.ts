import { db } from "../index.js";
import { users, type NewUser } from "../schema.js";
import { eq } from "drizzle-orm";

export async function createUser(data: NewUser) {
  const [newUser] = await db.insert(users).values(data).returning();
  return newUser;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function deleteAllUsers() {
  await db.delete(users);
}

export async function updateUser(userId: string, data: { email: string; hashedPassword: string }) {
  const [updatedUser] = await db
    .update(users)
    .set({
      email: data.email,
      hashedPassword: data.hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updatedUser;
}

export async function upgradeUserToChirpyRed(userId: string) {
  const [updatedUser] = await db
    .update(users)
    .set({
      isChirpyRed: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updatedUser;
}
