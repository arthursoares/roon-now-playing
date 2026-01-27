---
workflow: ops
priority: medium
---

# Workflow: Operations & Monitoring

> **Purpose:** Check system health, logs, and operational status
> **Chatmode:** DevOps (or Developer)
> **Command:** `/ops [environment]`

## Scope Flags

| Flag | Description |
|------|-------------|
| `--env=<name>` | Target environment (dev, staging, prod) |
| `--logs` | Fetch recent logs |
| `--health` | Run health checks only |
| `--errors` | Check error tracker (Sentry, etc.) |

## Workflow Steps

### Step 1: Detect Environment

Identify which environment to check. Default to `dev` or `local` if not specified.

```bash
# Check for environment config
cat .env 2>/dev/null | grep NODE_ENV
```

### Step 2: Health Check

Run project-specific health checks.

```bash
# Try standard script
npm run monitor:health 2>/dev/null

# Or try curl if URL known
# curl -I https://api.example.com/health
```

**Report:**
```markdown
### Health Status
| Service | Status | Latency |
|---------|--------|---------|
| API | UP | 45ms |
| Database | UP | - |
```

### Step 3: Check Logs (if --logs)

Retrieve recent logs to check for anomalies.

```bash
# Try standard script
npm run monitor:logs 2>/dev/null

# Or use platform CLI
# heroku logs --tail
# aws logs get-log-events ...
```

### Step 4: Check Errors (if --errors)

Check error tracking system.

```bash
# Try standard script
npm run monitor:errors 2>/dev/null
```

## Project Setup

Add these scripts to `package.json` to enable Ops workflow:

```json
{
  "scripts": {
    "monitor:health": "curl -f https://my-app.com/health",
    "monitor:logs": "heroku logs -n 50",
    "monitor:errors": "sentry-cli issues list"
  }
}
```

## Output Template

```markdown
## Operational Status Report

**Environment:** Production

### Health ✅
- API: OK (200 OK)
- DB: OK

### Recent Logs
- [INFO] Server started at ...
- [WARN] High memory usage detected...

### Active Errors
- No new critical errors in last hour.
```
