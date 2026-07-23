# Serverless TODOs — A Serverless Backend with a Lambda Authorizer

A full-stack TODO application built on a **serverless microservice architecture** using
**AWS Lambda, Amazon API Gateway, and Amazon DynamoDB**, with authentication enforced by a
dedicated **Lambda Authorizer**. The frontend is a **React (Vite)** single-page app.

This project was built to demonstrate how serverless architecture works — specifically how an
API Gateway routes requests to independent Lambda functions, and how a Lambda authorizer
centralises authentication in front of those functions in a microservice setup.

**Live demo:** _add your Vercel URL here after deploying_
**API base URL:** `https://xe0rdwsvpk.execute-api.ap-south-1.amazonaws.com`
**Demo login:** `demo@example.com` / `Demo!2026`

---

## Table of contents

1. [What this project demonstrates](#1-what-this-project-demonstrates)
2. [Architecture](#2-architecture)
3. [The Lambda Authorizer (the core of this project)](#3-the-lambda-authorizer-the-core-of-this-project)
4. [Request lifecycle, step by step](#4-request-lifecycle-step-by-step)
5. [API reference](#5-api-reference)
6. [Data model](#6-data-model)
7. [Technology choices and why](#7-technology-choices-and-why)
8. [Project structure](#8-project-structure)
9. [Running it on your local machine (full setup)](#9-running-it-on-your-local-machine-full-setup)
10. [Testing the API](#10-testing-the-api)
11. [Why a hardcoded demo login?](#11-why-a-hardcoded-demo-login)
12. [Trade-offs and what a production version would change](#12-trade-offs-and-what-a-production-version-would-change)
13. [Tearing the project down](#13-tearing-the-project-down)

---

## 1. What this project demonstrates

The brief was: *"Make a serverless backend for a TODOs app using Lambda. This introduces the
use of Lambda authorizers and the idea of API gateways in a microservice architecture."*

This implementation covers every part of that:

- **AWS Lambda** — each API operation (login, list, create, update, delete) is an independent
  function that runs on demand. There is no server to manage and no cost while idle.
- **API Gateway** — a single HTTP front door that routes each `METHOD /path` to the correct
  Lambda, and terminates TLS, handles CORS, and invokes the authorizer.
- **Lambda Authorizer** — a separate function that API Gateway calls *before* any protected
  handler, to decide whether the request is allowed.
- **Microservice architecture** — auth, and each TODO operation, are deployed and scaled
  independently; the gateway ties them together behind one URL.
- **Infrastructure as Code** — the entire cloud stack is defined in one `serverless.yml` file
  and deployed with a single command.

---

## 2. Architecture

```
                        ┌─────────────────────────┐
                        │   React frontend (Vercel)│
                        └────────────┬────────────┘
                                     │  HTTPS request
                                     │  Header: Authorization: Bearer <JWT>
                                     ▼
                    ┌────────────────────────────────────┐
                    │     API Gateway (HTTP API)          │  ← single front door / router
                    │  matches METHOD /path → a Lambda    │
                    └───────────────┬────────────────────┘
                                    │  for protected routes, calls the authorizer FIRST
                                    ▼
                    ┌────────────────────────────────────┐
                    │        Lambda Authorizer            │
                    │  • reads the Bearer token           │
                    │  • verifies the JWT signature       │
                    │  • returns { isAuthorized, userId } │
                    │  • result cached for 5 minutes      │
                    └───────────────┬────────────────────┘
              denied → 401/403      │      allowed
              (handler NEVER runs)  ▼
                    ┌────────────────────────────────────┐
                    │   Business Lambda                   │
                    │   list / create / update / delete   │
                    │   reads userId from authorizer ctx  │
                    └───────────────┬────────────────────┘
                                    ▼
                    ┌────────────────────────────────────┐
                    │   DynamoDB  (single table)          │
                    │   PK = USER#<id>, SK = TODO#<id>    │
                    └────────────────────────────────────┘
```

**Key idea:** a request that fails authorization is rejected at the gateway. The business
Lambda and the database are never invoked — so there is no cost and no exposure for
unauthenticated traffic.

---

## 3. The Lambda Authorizer (the core of this project)

The authorizer is a small, dedicated Lambda function (`backend/src/handlers/authorizer.js`)
whose only job is to answer one question for API Gateway: *"is this request allowed?"*

```js
import jwt from "jsonwebtoken";

const DENY = { isAuthorized: false, context: { userId: "" } };

export const handler = async (event) => {
  try {
    const header = event.headers?.authorization ?? event.headers?.Authorization;
    if (!header?.startsWith("Bearer ")) return DENY;          // no token → deny

    const payload = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);

    // The context object is forwarded to the business Lambda, so the handler
    // knows WHO is calling without having to re-parse the JWT itself.
    return { isAuthorized: true, context: { userId: payload.userId } };
  } catch (err) {
    // Expired, tampered, or wrong-secret tokens all fail verification and land here.
    console.error("Auth failed:", err.message);
    return DENY;                                               // invalid token → deny
  }
};
```

It is wired into API Gateway in `serverless.yml` as a **request authorizer**, and every
protected route references it by name:

```yaml
httpApi:
  authorizers:
    jwtAuth:
      type: request
      functionName: authorizer
      identitySource:
        - $request.header.Authorization   # what the authorizer inspects
      enableSimpleResponses: true         # allows the simple { isAuthorized } response
      resultTtlInSeconds: 300             # cache the decision for 5 minutes

functions:
  listTodos:
    handler: src/handlers/list.handler
    events:
      - httpApi:
          path: /todos
          method: get
          authorizer: { name: jwtAuth }   # this route is protected by the authorizer
```

**Why use an authorizer instead of checking the JWT inside every handler?**

- **Centralisation** — authentication lives in one function. There is a single place to audit,
  fix, or change auth logic, instead of the same code copy-pasted into every handler.
- **Caching** — API Gateway caches the authorizer's decision per token for 5 minutes
  (`resultTtlInSeconds: 300`), so repeated requests skip the verification cost entirely.
- **Blast radius** — unauthenticated requests are stopped at the gateway. The business Lambda
  and DynamoDB are never touched, so they carry no cost and no attack surface for bad requests.
- **Reuse** — the same authorizer can protect additional future microservices (e.g. `/notes`)
  without duplicating any logic.

**Proof that it works** (see [section 10](#10-testing-the-api) for the commands):

| Request | Result | Meaning |
|---|---|---|
| No `Authorization` header | `401 Unauthorized` | Gateway rejects — no credentials present |
| `Authorization: Bearer garbage` | `403 Forbidden` | Authorizer ran, verified, and denied the token |
| `Authorization: Bearer <valid JWT>` | `200 OK` | Authorizer approved; handler runs |

---

## 4. Request lifecycle, step by step

1. The React app sends a request to API Gateway with an `Authorization: Bearer <JWT>` header.
2. API Gateway matches the route (e.g. `GET /todos`).
3. Because the route is protected, API Gateway invokes the **Lambda authorizer** first,
   passing it the `Authorization` header.
4. The authorizer verifies the JWT's signature with the shared `JWT_SECRET`.
   - If valid, it returns `{ isAuthorized: true, context: { userId } }`.
   - If invalid or missing, it returns `{ isAuthorized: false }`, and the gateway responds
     with 401/403 — the business Lambda is never called.
5. On approval, API Gateway invokes the **business Lambda**, attaching the authorizer's
   `context`. The handler reads the caller's id from
   `event.requestContext.authorizer.lambda.userId`.
6. The handler reads or writes **DynamoDB**, scoped to that user's partition, and returns JSON.
7. API Gateway relays the response (with CORS headers) back to the browser.

---

## 5. API reference

| Method | Path | Auth required | Request body | Response |
|---|---|---|---|---|
| `POST` | `/auth/login` | No | `{ "email", "password" }` | `{ "token", "user" }` |
| `GET` | `/todos` | Yes (Bearer) | – | `[ { todo }, ... ]` |
| `POST` | `/todos` | Yes (Bearer) | `{ "title" }` | `{ todo }` |
| `PATCH` | `/todos/{id}` | Yes (Bearer) | `{ "title"?, "completed"? }` | `{ todo }` |
| `DELETE` | `/todos/{id}` | Yes (Bearer) | – | `204 No Content` |

A `todo` object looks like:

```json
{
  "todoId": "4d99f4db-4c6a-4102-bf30-8cebae9f37c6",
  "title": "Learn serverless",
  "completed": false,
  "createdAt": "2026-07-23T13:02:00.373Z"
}
```

---

## 6. Data model

A single DynamoDB table with a composite primary key is used for all items:

| Item | Partition key (PK) | Sort key (SK) | Other attributes |
|---|---|---|---|
| Todo | `USER#<userId>` | `TODO#<todoId>` | `title`, `completed`, `createdAt` |

Listing a user's todos is a single, efficient `Query` on `PK = USER#<userId>` with
`SK begins_with TODO#` — no table scan is ever needed. Because the partition key *is* the
user id (taken from the verified JWT, never from client input), one user cannot construct a
key that reads another user's data. This enforces tenant isolation at the data layer.

The table uses **on-demand (pay-per-request) billing**, so it costs nothing while idle.

---

## 7. Technology choices and why

| Choice | Why it was used |
|---|---|
| **AWS Lambda** | Per-request billing, automatic scaling, zero idle cost. Each operation is one function. |
| **API Gateway (HTTP API)** | Lambda has no public URL of its own. The gateway provides routing, TLS, CORS, and the authorizer hook, and is the single front door of the microservice. |
| **Lambda authorizer** | Centralises auth, is cached by the gateway, and rejects bad requests before any business logic runs. |
| **DynamoDB** | Serverless database with no connection pooling. A relational DB's connection limit conflicts with Lambda's scaling model; DynamoDB is accessed over HTTPS and scales the same way Lambda does. |
| **JWT (jsonwebtoken)** | A stateless, signed token means the authorizer can verify a request without a database lookup. |
| **Serverless Framework v4** | Defines the whole stack as one YAML file (Infrastructure as Code); `serverless deploy` builds everything reproducibly. |
| **React + Vite** | Fast, minimal single-page frontend that consumes the API. |

---

## 8. Project structure

```
serverless-todos/
├── README.md
├── .gitignore
├── backend/
│   ├── serverless.yml            # the entire infrastructure definition (IaC)
│   ├── package.json
│   ├── .env.example              # template for secrets (committed)
│   ├── .env                      # real secrets — NOT committed (gitignored)
│   └── src/
│       ├── handlers/
│       │   ├── authorizer.js     # the Lambda authorizer
│       │   ├── login.js          # issues a JWT
│       │   ├── list.js           # GET    /todos
│       │   ├── create.js         # POST   /todos
│       │   ├── update.js         # PATCH  /todos/{id}
│       │   └── delete.js         # DELETE /todos/{id}
│       └── lib/
│           └── common.js         # shared DynamoDB client + helpers
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── .env.example              # template (committed)
    ├── .env.local                # real API URL — NOT committed (gitignored)
    └── src/
        ├── main.jsx
        └── App.jsx               # the whole UI
```

---

## 9. Running it on your local machine (full setup)

These are the complete steps to run this project from scratch on a fresh machine.

### 9.1 Prerequisites

Install the following:

- **Node.js 22 LTS** — <https://nodejs.org> — verify with `node -v` (should print `v22.x`).
- **AWS CLI v2** — <https://aws.amazon.com/cli/> — verify with `aws --version`.
- **Git** — verify with `git --version`.
- An **AWS account** (the free tier is more than enough for this project).
- A free **Serverless Framework** account — <https://app.serverless.com> (v4 requires a login;
  it is free for individuals and organisations under $2M annual revenue).

### 9.2 Configure AWS credentials

Create an IAM user in the AWS Console (IAM → Users → Create user) with programmatic access,
then run:

```bash
aws configure
# Access key ID:      <your key>
# Secret access key:  <your secret>
# Default region:     ap-south-1        (must match the region in serverless.yml)
# Default output:     json
```

Verify it works:

```bash
aws sts get-caller-identity
```

This should print your AWS account number.

### 9.3 Deploy the backend

```bash
cd backend
npm install

# Create the secrets file from the template:
cp .env.example .env
```

Open `backend/.env` and set the values. Generate a strong JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Your `.env` should look like:

```
JWT_SECRET=<the 64-character hex string you just generated>
DEMO_EMAIL=demo@example.com
DEMO_PASSWORD=Demo!2026
```

Log in to the Serverless CLI once, then deploy:

```bash
npx serverless login       # opens the browser to authenticate (one-time)
npx serverless deploy       # creates all AWS resources; takes 2–4 minutes the first time
```

When it finishes, it prints your API endpoints. **Copy the base URL** (everything before
`/auth/login`), e.g. `https://xe0rdwsvpk.execute-api.ap-south-1.amazonaws.com`.

> **Windows PowerShell note:** if a previous session set an AWS profile, clear it first with
> `$env:AWS_PROFILE=""` before deploying, or open a fresh terminal.

### 9.4 Run the frontend

```bash
cd ../frontend
npm install

# Point the frontend at your deployed API:
cp .env.example .env.local
```

Edit `frontend/.env.local` and set your base URL from the previous step:

```
VITE_API_BASE=https://xe0rdwsvpk.execute-api.ap-south-1.amazonaws.com
```

Then start the dev server:

```bash
npm run dev
```

Open the printed URL (usually <http://localhost:5173>) and log in with the demo credentials.
`localhost:5173` is already allow-listed in the backend's CORS configuration, so it talks to
the live API directly.

> If you change `.env.local`, restart `npm run dev` — Vite only reads env files at startup.

---

## 10. Testing the API

After deploying, you can test the API directly. Set your base URL first:

```bash
API=https://xe0rdwsvpk.execute-api.ap-south-1.amazonaws.com
```

**Log in and capture a token:**

```bash
curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Demo!2026"}'
```

Copy the `token` from the response, then:

```bash
TOKEN=<paste token here>

# Create a todo
curl -s -X POST $API/todos -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"title":"Learn serverless"}'

# List todos
curl -s $API/todos -H "Authorization: Bearer $TOKEN"
```

**Demonstrating the authorizer** — the important test for this project:

```bash
curl -i $API/todos                                    # → 401 Unauthorized (no token)
curl -i $API/todos -H "Authorization: Bearer garbage" # → 403 Forbidden (invalid token)
curl -i $API/todos -H "Authorization: Bearer $TOKEN"  # → 200 OK (valid token)
```

> **Windows PowerShell:** use `curl.exe` (not `curl`) for these, and for requests that send a
> JSON body, prefer `Invoke-RestMethod` because PowerShell mangles inline JSON passed to
> `curl.exe`. Example:
> ```powershell
> $login = Invoke-RestMethod -Uri "$API/auth/login" -Method Post `
>   -ContentType "application/json" `
>   -Body '{"email":"demo@example.com","password":"Demo!2026"}'
> $TOKEN = $login.token
> ```

---

## 11. Why a hardcoded demo login?

This project intentionally uses **one hardcoded demo account** (`demo@example.com` /
`Demo!2026`) instead of a full user-registration system. This is a deliberate scoping
decision, and here is the reasoning:

- **The goal is to demonstrate the Lambda authorizer, not to build a user-management system.**
  An authorizer's job is to verify a token on every protected request. To produce a token to
  verify, you need *some* way to log in. A single fixed account is the simplest thing that
  exercises the entire auth pipeline: **login → issue JWT → authorizer verifies JWT →
  protected route runs.**
- **A full signup flow was out of scope for the brief.** Real registration would add a signup
  endpoint, password hashing (bcrypt), a users table, and duplicate-email handling — none of
  which is mentioned in the problem statement, and all of which would obscure the part being
  demonstrated.
- **The demo password is public on purpose.** It is shared so an evaluator can log in and try
  the live app, exactly like a "Guest login" button on a demo site. It protects nothing of
  value — only a throwaway todo list. The security being demonstrated is **not** the secrecy
  of this password; it is that the authorizer *rejects any request without a valid JWT* (see
  the 401/403/200 test above).

**How this would work in production instead:** users would register with their own email and
password, the password would be stored only as a bcrypt hash in DynamoDB, and login would
verify the hash before issuing a JWT. Short-lived access tokens plus refresh tokens would
replace the single long-lived token used here.

---

## 12. Trade-offs and what a production version would change

These shortcuts were taken to keep the project focused; a production system would address each:

- **`AdministratorAccess` on the deploy user** is too broad — production would use a narrowly
  scoped deployment role.
- **The JWT secret lives in a Lambda environment variable** — it should be stored in AWS
  Secrets Manager or SSM Parameter Store (encrypted).
- **A single hardcoded demo user** — production needs real registration, bcrypt-hashed
  passwords, and refresh tokens (see [section 11](#11-why-a-hardcoded-demo-login)).
- **No rate limiting on `/auth/login`** — production would add API Gateway usage plans or WAF
  to prevent credential-stuffing.
- **No automated tests** — production would add unit tests for the handlers and integration
  tests against a deployed stage.
- **The authorizer's 5-minute cache** means a revoked token can remain valid for up to five
  minutes — an acceptable trade-off here for lower cost and latency.

---

## 13. Tearing the project down

When the project has been evaluated, remove all AWS resources to avoid any charges:

```bash
cd backend
npx serverless remove
```

This deletes every Lambda, the API Gateway, the DynamoDB table, and all associated IAM roles.
The AWS free tier covers this project's usage, so the realistic cost of running it is
effectively zero.
