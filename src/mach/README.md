# MACH: Mission-driven AI Command Hub

Unified server and worker for processing AI missions through the OpenClaw agent framework.

## Architecture Overview

MACH provides two operational modes:

### 1. Webhook Mode (Recommended for Production)
- Real-time mission processing via Supabase webhooks
- Immediate response to new missions
- Lower resource usage (event-driven)
- Requires publicly accessible endpoint

### 2. Polling Mode (Development/Fallback)
- Periodic database polling for pending missions
- Works behind firewalls/NAT
- Higher resource usage
- Configurable poll interval

## Directory Structure

```
src/mach/
├── server.ts           # Express server (webhook + health endpoints)
├── worker.ts           # Mission processor (integrates OpenClaw agents)
├── routes/
│   ├── webhook.ts      # Supabase webhook handler
│   └── health.ts       # Health check endpoint
├── frontend/           # React dashboard (mission UI)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   └── package.json
└── README.md          # This file
```

## Quick Start

### 1. Environment Setup

Create `.env` file in repository root:

```bash
# Anthropic API (required for Claude agent)
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY

# Supabase configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY

# Server configuration
PORT=3000
NODE_ENV=production

# Worker mode (webhook or polling)
MACH_MODE=webhook  # or 'polling'
MACH_POLL_INTERVAL=5000  # milliseconds (polling mode only)
```

### 2. Database Setup

Run the migration to create the `missions` table:

```bash
psql $DATABASE_URL < scripts/create-missions-table.sql
```

Or use Supabase migrations:

```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  flight_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_created_at ON missions(created_at);
```

### 3. Run the Server

**Development:**
```bash
bun run src/mach/server.ts
```

**Production:**
```bash
# Build first
pnpm build

# Run built output
node dist/mach/server.js
```

### 4. Configure Webhook (Production)

In Supabase Dashboard → Database → Webhooks:

- **Table:** `missions`
- **Events:** `INSERT`
- **Type:** `POST`
- **URL:** `https://your-domain.com/webhook/mission`
- **HTTP Headers:**
  ```
  Content-Type: application/json
  ```

## API Endpoints

### POST /webhook/mission
Receives Supabase webhook for new missions.

**Request Body:**
```json
{
  "type": "INSERT",
  "table": "missions",
  "record": {
    "id": "uuid",
    "objective": "Create a landing page",
    "status": "pending"
  },
  "schema": "public"
}
```

**Response:**
```json
{
  "success": true,
  "missionId": "uuid"
}
```

### GET /health
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "mode": "webhook",
  "timestamp": "2026-02-04T05:00:00.000Z"
}
```

## Mission Processing Flow

1. **Mission Created** → User submits objective via frontend
2. **Trigger** → Webhook fires or polling detects new mission
3. **Status Update** → Mission status → `processing`
4. **Agent Execution** → OpenClaw agent processes objective
5. **Flight Plan Generation** → Agent creates detailed plan
6. **Completion** → Mission status → `complete` or `failed`
7. **Update Database** → Store flight plan and final status

## Integration with OpenClaw

MACH uses OpenClaw's embedded Pi agent:

```typescript
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";

// Process mission with Claude
const result = await runEmbeddedPiAgent({
  prompt: mission.objective,
  model: "claude-3-7-sonnet-20250219",
  provider: "anthropic",
  // ... agent configuration
});
```

**Agent Workspace:** Each mission gets isolated workspace at:
```
~/.openclaw/workspaces/mission-{UUID}/
```

## Deployment

### Railway

1. **Create new project** from GitHub repo
2. **Add environment variables** (see `.env.mach.example`)
3. **Deploy command:**
   ```bash
   pnpm install && pnpm build && node dist/mach/server.js
   ```
4. **Configure webhook** with Railway public URL

### Docker

Build and run:
```bash
docker build -f Dockerfile.mach -t mach-server .
docker run -p 3000:3000 --env-file .env mach-server
```

### Health Monitoring

Monitor via `/health` endpoint:
```bash
curl https://your-domain.com/health
```

Set up uptime monitoring with:
- Better Uptime
- UptimeRobot
- Pingdom

## Frontend Dashboard

React app for mission management:

**Development:**
```bash
cd src/mach/frontend
bun install
bun run dev
```

**Production Build:**
```bash
cd src/mach/frontend
bun run build
# Deploy dist/ to Vercel/Netlify/Cloudflare Pages
```

## Troubleshooting

### Webhook Not Triggering
- Verify Supabase webhook configuration
- Check server is publicly accessible
- Review Supabase logs: Dashboard → Logs → Webhook Logs

### Agent Errors
- Verify `ANTHROPIC_API_KEY` is valid
- Check OpenClaw dependencies are installed
- Review mission logs in database

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Check connection pooling limits
- Review Supabase Dashboard → Settings → Database

### Polling Mode Not Working
- Verify `MACH_MODE=polling` in `.env`
- Check `MACH_POLL_INTERVAL` is reasonable (5000ms default)
- Ensure database credentials are correct

## Security Best Practices

1. **Never commit `.env`** - Use `.env.example` as template
2. **Rotate keys regularly** - Especially after exposure
3. **Use service role key** - Required for bypassing RLS
4. **Validate webhook payloads** - Verify source IP if possible
5. **Monitor API usage** - Watch for unexpected spikes

## Performance Optimization

- **Webhook mode**: Zero polling overhead
- **Connection pooling**: Reuse Supabase client
- **Agent workspace cleanup**: Implement TTL for old workspaces
- **Database indexing**: Ensure indexes on `status` and `created_at`

## Migration from Standalone Worker

The legacy standalone worker (`src/mach-worker.ts`) has been replaced by this unified architecture. Key improvements:

- ✅ Webhook support (real-time processing)
- ✅ No hardcoded credentials
- ✅ Better error handling
- ✅ Health monitoring
- ✅ Integrated with OpenClaw monorepo
- ✅ Production-ready deployment

## Related Documentation

- OpenClaw Agent Framework: `docs/agents/`
- Deployment Guide: `.windsurf/plans/unified-mach-deployment-40e4be.md`
- Original Mach Repo: Archived at `C:\Users\autre\OneDrive\Desktop\Projects (Golden Sheep AI)\mach-ARCHIVED-2026-02-04\`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review OpenClaw documentation
3. Check Supabase logs and webhook configuration
