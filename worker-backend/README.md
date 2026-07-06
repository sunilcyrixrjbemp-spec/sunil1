# FieldOps Secondary API — Cloudflare Worker Deployment Guide

This folder contains a lightweight JavaScript API server written for Cloudflare Workers that communicates directly with your secondary D1 database (`expense_management_db_new`).

## Prerequisites

To deploy this worker, you will need:
1. **Node.js** installed on your system (where you run the deployment commands).
2. A Cloudflare account and access to the secondary database.

---

## Deployment Steps

Follow these simple commands in your command line terminal on the computer where you have Node.js:

### 1. Install Wrangler CLI
Wrangler is the official Cloudflare Workers command-line tool.
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
This will open your browser and prompt you to authorize Wrangler.
```bash
wrangler login
```

### 3. Deploy the Worker
Run this command from inside the `worker-backend` directory:
```bash
wrangler deploy
```

---

## Environment Variables / Secrets

The worker expects an API secret key to verify incoming replication requests from your main backend server.

The default secret is defined in `wrangler.toml` under `vars` as:
`API_SECRET = "012001@Sunil"`

If you want to secure this further, you can set it as a Cloudflare secret:
```bash
wrangler secret put API_SECRET
```
*(Enter your chosen secure password when prompted)*

---

## How it works

1. **Read Operations**: Since this Worker is bound directly to D1 (`expense_management_db_new`), D1 queries run in 0ms network latency. Any GET request routed here will load extremely quickly.
2. **Replication Endpoint**: The Python backend on Render automatically sends real-time database changes (INSERT/UPDATE/DELETE) to the `/api/replicate` or `/api/replicate/batch` endpoints of this worker, keeping both D1 databases completely synchronized!
3. **Round-robin Load Balancing**: After August 3, 2026, reads will be split 50/50 round-robin between the primary server and this secondary Cloudflare worker to distribute the load equally and stay well within Cloudflare D1 free-tier read limits.
