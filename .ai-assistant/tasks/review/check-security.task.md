---
task: check-security
chatmode: reviewer
tools: [read, glob, grep]
---

# Task: Check Security

> **Purpose:** Review code for security vulnerabilities
> **Chatmode:** Reviewer (read-only)
> **When:** When handling user input, auth, or sensitive data

## Steps

1. **Identify sensitive areas** - Auth, input, data handling
2. **Check for vulnerabilities** - Apply OWASP checklist
3. **Document findings** - Note issues with severity
4. **Recommend fixes** - Provide remediation guidance

## Security Checklist

### Input Validation
- [ ] All user input is validated
- [ ] Input length is limited
- [ ] Input type is verified
- [ ] Unexpected input is rejected

### Output Encoding
- [ ] Data is escaped before rendering (XSS prevention)
- [ ] HTML entities are encoded
- [ ] JavaScript contexts are properly escaped

### Authentication
- [ ] Credentials are not logged
- [ ] Session tokens are secure
- [ ] Password handling is correct

### Authorization
- [ ] Access controls are checked
- [ ] User can only access their data
- [ ] Privilege escalation prevented

### Data Protection
- [ ] Sensitive data is not exposed
- [ ] Secrets are not in code
- [ ] Data is encrypted in transit

### Injection Prevention
- [ ] SQL queries are parameterized
- [ ] Command execution is sanitized
- [ ] Path traversal is prevented

## Common Vulnerabilities

### XSS (Cross-Site Scripting)
```typescript
// Bad
element.innerHTML = userInput;

// Good
element.textContent = userInput;
```

### SQL Injection
```typescript
// Bad
query(`SELECT * FROM users WHERE id = ${userId}`);

// Good
query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Command Injection
```typescript
// Bad
exec(`ls ${userPath}`);

// Good
execFile('ls', [sanitizedPath]);
```

### Path Traversal
```typescript
// Bad
readFile(`./uploads/${filename}`);

// Good
const safePath = path.join(uploadsDir, path.basename(filename));
```

## Search Commands

```bash
# Find potential XSS
grep -rn "innerHTML\|dangerouslySetInnerHTML" src/

# Find potential SQL injection
grep -rn "query.*\${" src/

# Find exec/spawn calls
grep -rn "exec\|spawn\|execSync" src/

# Find hardcoded secrets (basic)
grep -rn "password\|secret\|api.key\|token" src/ --include="*.ts"
```

## Secrets Scanning (Critical)

```bash
# API keys and credentials in code
grep -rn -E "(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[:=]\s*['\"][^'\"]+['\"]" .

# Base64-encoded secrets (40+ chars)
grep -rn -E "['\"][A-Za-z0-9+/]{40,}={0,2}['\"]" .

# URLs with embedded credentials
grep -rn -E "https?://[^:]+:[^@]+@" .

# AWS keys pattern
grep -rn -E "AKIA[0-9A-Z]{16}" .

# Private keys
grep -rn -E "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----" .

# Environment variable assignments with secrets
grep -rn -E "(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*['\"][^'\"]+['\"]" .

# Common secret file patterns
find . -name "*.pem" -o -name "*.key" -o -name ".env.local" -o -name "credentials.json"
```

## Files to Always Check

- `*.json` - Config files may contain hardcoded secrets
- `.env*` files - Should be gitignored, flag if committed
- `settings*.json` - IDE/tool settings may leak paths or credentials
- `docker-compose*.yml` - May contain environment secrets
- `*config*.js/ts` - Application configs

## Output Format

```markdown
## Security Review: [Component/Feature]

### Findings

#### 🔴 Critical
- **[Vulnerability Type]** in `file.ts:42`
  - Issue: [description]
  - Risk: [what could happen]
  - Fix: [remediation]

#### 🟡 Warning
- **[Potential Issue]** in `file.ts:88`
  - Issue: [description]
  - Recommendation: [guidance]

### Checked Areas
- [x] Input validation
- [x] Output encoding
- [x] Authentication
- [ ] Not applicable: [area]

### Conclusion
[Secure / Needs fixes before deployment]
```

## Transition

After security review:
- Critical issues → `implement/edit-file` to fix (mandatory)
- Warnings → Document in todo, fix before production
- Clean → Proceed with workflow
