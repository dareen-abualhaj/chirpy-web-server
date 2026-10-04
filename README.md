# Chirpy Backend API 🚀

A robust, feature-rich RESTful backend server built for a Twitter-like social platform ("Chirpy"). Developed with Node.js, Express, and TypeScript, featuring secure authentication, database management with Drizzle ORM, automated webhook integrations, and advanced query capabilities.

## ✨ Features

* **User Management & Authentication**: Secure user registration, login, password hashing with Argon2, JWT-based access tokens, and long-lived refresh tokens with revocation support.
* **Chirps Operations**: Full CRUD operations for chirps with automatic profanity filtering (`kerfuffle`, `sharbert`, `fornax` moderation).
* **Advanced API Querying**:

  * **Filtering**: Retrieve chirps filtered by specific authors using query parameters (`?authorId=...`).
  * **Sorting**: Flexible chronological sorting for chirps (`?sort=asc` or `?sort=desc`).
* **Chirpy Red & Webhooks**: Automated membership upgrades via secure webhooks from Polka, authenticated using custom API keys (`POLKA_KEY`).
* **Admin Metrics & Controls**: Track server request hits and reset database states safely in development mode.

## 🛠️ Tech Stack

* **Language & Runtime**: TypeScript, Node.js
* **Framework**: Express.js
* **Database & ORM**: PostgreSQL, Drizzle ORM
* **Security**: JSON Web Tokens (JWT), Argon2, API Key validation

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your system:

* Node.js
* PostgreSQL

### Installation & Setup

1. **Clone the repository:**

```bash
git clone https://github.com/dareen-abualhaj/chirpy-web-server.git
cd chirpy-web-server
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment variables:**

Create a `.env` file in the root directory and add your configurations:

```env
PORT=8080
DB_URL=postgres://<username>:<password>@localhost:5432/chirpy
JWT_SECRET=<your_jwt_secret>
POLKA_KEY=<your_polka_api_key>
PLATFORM=dev
```

4. **Run the server:**

**Development mode:**

```bash
npm run dev
```

**Build and production mode:**

```bash
npm run build
npm start
```
