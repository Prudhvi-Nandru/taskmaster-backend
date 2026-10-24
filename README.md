# TaskMaster Backend

A team task-management REST API built with **Node.js, Express, PostgreSQL, Prisma, JWT, and Socket.IO**. It includes user authentication, teams, task assignment and lifecycle management, search/filter/sort/pagination, comments, file attachments, persisted notifications, and an optional task-description drafting endpoint.

## Requirements

- Node.js 20+
- Docker Desktop / Docker Engine (recommended) or PostgreSQL 14+
- npm

## Quick start (local development)

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell: `Copy-Item .env.example .env`. Set `JWT_SECRET` to a random secret of at least 32 characters.

2. Start PostgreSQL:

   ```bash
   docker compose up -d db
   ```

3. Install packages and generate the Prisma client:

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Start the API:

   ```bash
   npm run dev
   ```

   API base URL: `http://localhost:4000`; health check: `GET /health`.

5. Optional sample data:

   ```bash
   npm run prisma:seed
   ```

   Demo credentials: `demo@example.com` / `ChangeMe123!`. Change or remove this demo account before any shared deployment.

### Run everything in Docker

Create `.env` first, then:

```bash
docker compose up --build
```

The API container expects the database to be ready; for a first-time deployment, apply migrations before serving production traffic. Recommended production flow: run `npm run prisma:deploy` as a release step, then start the API.

## Authentication

Register or log in to receive a short-lived JWT. Send it as:

```http
Authorization: Bearer <token>
```

`POST /api/auth/logout` revokes active JWTs by incrementing the user's token version. This also signs out other sessions for that account. Log in again to receive a fresh token.

## API overview

All request/response bodies use JSON unless uploading a file. IDs are opaque strings. Errors use a consistent shape: `{ "error": "...", "message": "...", "details": [...] }`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Authenticate |
| POST | `/api/auth/logout` | Revoke active JWT sessions |
| GET | `/api/auth/me` | View profile |
| PATCH | `/api/auth/me` | Update name/avatar URL |
| POST | `/api/teams` | Create team (creator becomes owner) |
| GET | `/api/teams` | List user's teams |
| POST | `/api/teams/join` | Join via invite code |
| GET | `/api/teams/:teamId/members` | List team members |
| POST | `/api/tasks` | Create task in a team |
| GET | `/api/tasks` | List, filter, search, sort, paginate tasks |
| GET | `/api/tasks/assigned-to-me` | Tasks assigned to current user |
| GET | `/api/tasks/:taskId` | Task details, comments and attachments |
| PATCH | `/api/tasks/:taskId` | Update task |
| PATCH | `/api/tasks/:taskId/complete` | Mark completed |
| DELETE | `/api/tasks/:taskId` | Delete task (creator only) |
| GET | `/api/tasks/:taskId/comments` | List comments |
| POST | `/api/tasks/:taskId/comments` | Add comment |
| POST | `/api/tasks/:taskId/attachments` | Upload one file (`multipart/form-data`, field `file`) |
| GET | `/api/attachments/:attachmentId/download` | Download attachment |
| DELETE | `/api/attachments/:attachmentId` | Delete own attachment |
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/:id/read` | Mark one notification read |
| PATCH | `/api/notifications/read-all` | Mark all read |
| POST | `/api/ai/task-description` | Draft a task description with OpenAI or a local template fallback |

### Task filtering, search and sorting

`GET /api/tasks?teamId=<id>&status=OPEN&q=database&sort=dueDate&order=asc&page=1&limit=20`

Supported `status`: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Supported `sort`: `createdAt`, `updatedAt`, `dueDate`, `title`, `priority`, `status`. Optional filters include `assigneeId`, `dueBefore`, and `dueAfter`. `limit` is capped at 100. The current user only sees tasks belonging to teams they have joined.

### Example: create a task

```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "title": "Implement login endpoint",
  "description": "Add JWT authentication and validation",
  "dueDate": "2026-11-15T12:00:00.000Z",
  "priority": "HIGH",
  "teamId": "<team-id>",
  "assigneeId": "<team-member-user-id>"
}
```

### AI task-description drafts

`POST /api/ai/task-description` accepts `{ "title": "...", "notes": "..." }`. Without an API key it returns an offline template draft. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to use the OpenAI Responses API. The title and notes are sent to OpenAI when this key is configured; review your data-handling requirements before enabling this integration. Requests time out after `OPENAI_TIMEOUT_MS` (30 seconds by default), and provider errors do not expose the upstream response body.

### Real-time notifications

Connect with Socket.IO and pass the JWT:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: '<jwt>' }
});
socket.on('notification', (notification) => console.log(notification));
```

Notifications are also persisted and available via the REST endpoint. Use HTTPS/WSS in deployment.

## Data model

- `User`: identity, hashed password, profile.
- `Team` and `TeamMember`: team membership and role.
- `Task`: description, status, priority, due date, creator, assignee and team.
- `Comment`: task discussion.
- `Attachment`: metadata for uploaded files.
- `Notification`: persisted notification/read state.

## Security and production checklist

- Passwords use bcrypt with 12 salt rounds. Passwords are never returned by the API. Logout revokes issued JWTs using a per-user token version.
- Request bodies are validated with Zod; Helmet, CORS, and auth rate limiting are enabled.
- Team membership is checked before reading or modifying team tasks and collaboration data.
- Uploads have a configurable size limit. Add MIME/type allowlisting, malware scanning, object storage, and download authorization policy before production.
- Set a strong `JWT_SECRET`; never commit `.env`; use HTTPS; restrict `CLIENT_ORIGIN`; configure backups and database access controls.
- Review and tune rate limits, logging, monitoring, retention, and privacy requirements before deployment.
- `OWNER`, `ADMIN`, and `MEMBER` roles are stored; this starter currently enforces membership and selected creator/uploader rules, not a full role-based permission matrix.
- The AI endpoint uses a local template unless `OPENAI_API_KEY` is configured. When enabled, task title and notes are sent to the OpenAI Responses API; review data handling and account access before deployment.

## Tests and quality

```bash
npm test
npm run lint
```

The included test checks the health endpoint. Add database-backed integration tests for authentication, team isolation, task CRUD, comments, uploads, and notification delivery before production use.

## GitHub submission

1. Create a **public** repository on GitHub named `taskmaster-backend`.
2. Extract this ZIP, open a terminal in the project folder, and run:

   ```bash
   git init
   git add .
   git commit -m "Build TaskMaster backend API"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/taskmaster-backend.git
   git push -u origin main
   ```

3. Confirm `.env` and uploaded files are not committed. Add the public repository URL to your submission.

## License

MIT — see `LICENSE`.
