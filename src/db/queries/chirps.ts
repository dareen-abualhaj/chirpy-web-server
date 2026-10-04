import { db } from "../index.js";
import { NewChirp, chirps } from "../schema.js";
import { asc, eq } from "drizzle-orm";

export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();
  return result;
}

export async function getChirps(authorId?: string) {
  if (authorId) {
    return await db
      .select()
      .from(chirps)
      .where(eq(chirps.userId, authorId))
      .orderBy(asc(chirps.createdAt));
  }
  return await db
    .select()
    .from(chirps)
    .orderBy(asc(chirps.createdAt));
}

export async function getChirpById(id: string) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, id));
  return result;
}
export async function deleteChirp(chirpId: string) {
  await db.delete(chirps).where(eq(chirps.id, chirpId));
}
