import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";
import { createUser, deleteAllUsers, getUserByEmail, updateUser, upgradeUserToChirpyRed } from "./db/queries/users.js";
import { createChirp, getChirps, getChirpById, deleteChirp } from "./db/queries/chirps.js";
import { createRefreshToken, getRefreshToken, revokeRefreshToken } from "./db/queries/refresh_tokens.js";
import { hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken, makeRefreshToken,getAPIKey } from "./auth.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

class BadRequestError extends Error {
  constructor(message: string) { super(message); }
}
class UnauthorizedError extends Error {
  constructor(message: string) { super(message); }
}
class ForbiddenError extends Error {
  constructor(message: string) { super(message); }
}
class NotFoundError extends Error {
  constructor(message: string) { super(message); }
}

const app = express();
const PORT = config.api.port;

app.use(express.json());

const middlewareLogResponses = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });
  next();
};

app.use(middlewareLogResponses);

const middlewareMetricsInc = (req: Request, res: Response, next: NextFunction) => {
  config.api.fileserverHits++;
  next();
};

app.get("/api/healthz", (req: Request, res: Response) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
});

app.get("/admin/metrics", (req: Request, res: Response) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>
  `);
});

app.post("/admin/reset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (config.api.platform !== "dev") {
      throw new ForbiddenError("Reset is only allowed in dev environment");
    }
    config.api.fileserverHits = 0;
    await deleteAllUsers();
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(`Hits reset to ${config.api.fileserverHits}`);
  } catch (error) {
    next(error);
  }
});

// Create User
app.post("/api/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== "string") throw new BadRequestError("Email is required");
    if (!password || typeof password !== "string") throw new BadRequestError("Password is required");

    const hashedPassword = await hashPassword(password);
    const newUser = await createUser({ email, hashedPassword });

    res.setHeader("Content-Type", "application/json");
    res.status(201).send(JSON.stringify({
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
      isChirpyRed: newUser.isChirpyRed,
    }));
  } catch (error) {
    next(error);
  }
});

// Update User
app.put("/api/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);
    const { email, password } = req.body;

    if (!email || typeof email !== "string") throw new BadRequestError("Email is required");
    if (!password || typeof password !== "string") throw new BadRequestError("Password is required");

    const hashedPassword = await hashPassword(password);
    const updatedUser = await updateUser(userId, { email, hashedPassword });

    if (!updatedUser) throw new NotFoundError("User not found");

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({
      id: updatedUser.id,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      email: updatedUser.email,
      isChirpyRed: updatedUser.isChirpyRed,
    }));
  } catch (error) {
    next(error);
  }
});

// Login
app.post("/api/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      throw new UnauthorizedError("incorrect email or password");
    }

    const user = await getUserByEmail(email);
    if (!user) throw new UnauthorizedError("incorrect email or password");

    const passwordMatches = await checkPasswordHash(password, user.hashedPassword);
    if (!passwordMatches) throw new UnauthorizedError("incorrect email or password");

    const accessToken = makeJWT(user.id, 3600, config.api.jwtSecret);
    const refreshTokenString = makeRefreshToken();
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await createRefreshToken({
      token: refreshTokenString,
      userId: user.id,
      expiresAt: expiresAt,
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      email: user.email,
      isChirpyRed: user.isChirpyRed,
      token: accessToken,
      refreshToken: refreshTokenString,
    }));
  } catch (error) {
    next(error);
  }
});

// Polka Webhooks endpoint
app.post("/api/polka/webhooks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let apiKey: string;
    try {
      apiKey = getAPIKey(req);
    } catch (err) {
      res.status(401).send();
      return;
    }

    if (apiKey !== config.api.polkaKey) {
      res.status(401).send();
      return;
    }

    const { event, data } = req.body;

    if (event !== "user.upgraded") {
      res.status(204).send();
      return;
    }

    if (!data || !data.userId) {
      throw new BadRequestError("User ID is required");
    }

    const updatedUser = await upgradeUserToChirpyRed(data.userId);
    if (!updatedUser) {
      throw new NotFoundError("User not found");
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


// Refresh & Revoke
app.post("/api/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenString = getBearerToken(req);
    const storedToken = await getRefreshToken(tokenString);

    if (!storedToken || storedToken.revokedAt || new Date() > new Date(storedToken.expiresAt)) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const newAccessToken = makeJWT(storedToken.userId, 3600, config.api.jwtSecret);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({ token: newAccessToken }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/revoke", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenString = getBearerToken(req);
    await revokeRefreshToken(tokenString);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Chirps Endpoints
app.post("/api/chirps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);
    const { body } = req.body;

    if (!body || typeof body !== "string") throw new BadRequestError("Chirp body is required");
    if (body.length > 140) throw new BadRequestError("Chirp is too long. Max length is 140");

    const profaneWords = ["kerfuffle", "sharbert", "fornax"];
    const cleanedBody = body
      .split(" ")
      .map((word: string) => (profaneWords.includes(word.toLowerCase()) ? "****" : word))
      .join(" ");

    const newChirp = await createChirp({ body: cleanedBody, userId });

    res.setHeader("Content-Type", "application/json");
    res.status(201).send(JSON.stringify({
      id: newChirp.id,
      createdAt: newChirp.createdAt,
      updatedAt: newChirp.updatedAt,
      body: newChirp.body,
      userId: newChirp.userId,
    }));
  } catch (error) {
    next(error);
  }
});

// Chirps Endpoints (GET with authorId and sort)
app.get("/api/chirps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let authorId = "";
    const authorIdQuery = req.query.authorId;
    if (typeof authorIdQuery === "string") {
      authorId = authorIdQuery;
    }

    let sortOrder = "asc"; // القيمة الافتراضية
    const sortQuery = req.query.sort;
    if (typeof sortQuery === "string" && (sortQuery === "asc" || sortQuery === "desc")) {
      sortOrder = sortQuery;
    }

    // جلب التغريدات من قاعدة البيانات مع الفلترة حسب authorId إن وجدت
    const allChirps = await getChirps(authorId ? authorId : undefined);

    // ترتيب التغريدات في الذاكرة بناءً على تاريخ الإنشاء (created_at)
    allChirps.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (sortOrder === "desc") {
        return dateB - dateA; // تنازلي (الأحدث أولاً)
      } else {
        return dateA - dateB; // تصاعدي (الأقدم أولاً)
      }
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(
      JSON.stringify(
        allChirps.map((chirp) => ({
          id: chirp.id,
          createdAt: chirp.createdAt,
          updatedAt: chirp.updatedAt,
          body: chirp.body,
          userId: chirp.userId,
        }))
      )
    );
  } catch (error) {
    next(error);
  }
});
   


app.get("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chirpId = req.params.chirpId;
    if (typeof chirpId !== "string") {
      throw new BadRequestError("Invalid chirp ID");
    }
    const chirp = await getChirpById(chirpId);
    if (!chirp) throw new NotFoundError("Chirp not found");

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({
      id: chirp.id,
      createdAt: chirp.createdAt,
      updatedAt: chirp.updatedAt,
      body: chirp.body,
      userId: chirp.userId,
    }));
  } catch (error) {
    next(error);
  }
});


app.delete("/api/chirps/:chirpId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);
    const chirpId = req.params.chirpId;

    if (typeof chirpId !== "string") {
      throw new BadRequestError("Invalid chirp ID");
    }

    const chirp = await getChirpById(chirpId);
    if (!chirp) throw new NotFoundError("Chirp not found");
    if (chirp.userId !== userId) throw new ForbiddenError("Not authorized to delete this chirp");

    await deleteChirp(chirpId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


app.use("/app", middlewareMetricsInc, express.static("./src/app"));

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Type", "application/json");
  if (err instanceof BadRequestError) {
    res.status(400).send(JSON.stringify({ error: err.message }));
  } else if (err instanceof UnauthorizedError || err.message.includes("Invalid") || err.message.includes("token")) {
    res.status(401).send(JSON.stringify({ error: err.message || "Unauthorized" }));
  } else if (err instanceof ForbiddenError) {
    res.status(403).send(JSON.stringify({ error: err.message }));
  } else if (err instanceof NotFoundError) {
    res.status(404).send(JSON.stringify({ error: err.message }));
  } else {
    console.log(err);
    res.status(500).send(JSON.stringify({ error: "Something went wrong" }));
  }
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
