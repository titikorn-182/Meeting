import { createServer } from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { initialState, users } from '../../src/demo/fixtures/workspace.ts';
import { DEFAULT_ROLE_PAGES } from '../../src/lib/access-control.ts';

// Deterministic loopback-only Auth/RPC double. No external Supabase project is contacted.
export async function localAuthServer(port) {
  const origin = `http://127.0.0.1:${port}`;
  const org = '11111111-1111-4111-8111-111111111111';
  const accounts = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'alice@example.test',
      name: 'Alice Session',
    },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'bob@example.test', name: 'Bob Session' },
  ];
  const tokens = new Map();
  const refreshTokens = new Map();
  const passwords = new Map(accounts.map((account) => [account.id, 'local-test-password']));
  const recoveryCodes = new Map();
  const emailRequests = [];
  let passwordUpdates = 0;
  let signupIssuesSession = true;
  let workspaceAccess = true;
  let claimResponse = {
    claimed: 0,
    emailVerificationRequired: false,
    claimPolicy: 'admin_email_match',
  };
  const stats = { signIns: 0, refreshes: 0, signOuts: 0, reads: 0, writes: 0, unexpected: [] };
  let logoutWait;
  let logoutFailure = false;
  let shortSession = true;
  function user(account) {
    return {
      id: account.id,
      email: account.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { email_verified: true },
      email_confirmed_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      identities: [],
    };
  }
  function session(account) {
    const ttl = shortSession ? 1 : 3600;
    shortSession = false;
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account.id, email: account.email, aud: 'authenticated', role: 'authenticated', iss: `${origin}/auth/v1`, iat: now, exp: now + ttl, session_id: randomUUID() })}`;
    const access = `${payload}.${createHmac('sha256', 'loopback-test-only').update(payload).digest('base64url')}`;
    const refresh = randomUUID();
    tokens.set(access, account);
    refreshTokens.set(refresh, account);
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: 'bearer',
      expires_in: ttl,
      expires_at: now + ttl,
      user: user(account),
    };
  }
  function snapshot(account) {
    const profile = {
      ...users[0],
      id: account.id,
      name: account.name,
      initials: account.name.slice(0, 1),
      email: account.email,
      accessRole: 'admin',
    };
    return {
      state: { ...initialState, currentUserId: account.id },
      users: [...users, profile],
      eligibleOwners: [],
      units: ['Test'],
      organization: { id: org, name: 'Local Auth test' },
      roles: ['secretary'],
      permissions: ['policy.manage'],
      features: { personnelManagement: true },
      access: {
        role: 'admin',
        pages: DEFAULT_ROLE_PAGES.admin,
        policies: DEFAULT_ROLE_PAGES,
        policyVersion: 1,
        members: { [account.id]: { role: 'admin', version: 0 } },
      },
    };
  }
  const server = createServer(async (request, response) => {
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url, origin);
      const bearer = request.headers.authorization?.replace(/^Bearer /i, '');
      const account = tokens.get(bearer);
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const data = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/auth/v1/signup') {
        if (accounts.some((a) => a.email === data.email))
          return json(400, { code: 'user_already_exists', msg: 'Account already exists' });
        const created = { id: randomUUID(), email: data.email, name: 'Signup Test' };
        accounts.push(created);
        passwords.set(created.id, data.password);
        shortSession = false;
        return json(200, signupIssuesSession ? session(created) : user(created));
      }
      if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/resend') {
        if (data.email === 'rate@example.test')
          return json(429, { code: 'over_email_send_rate_limit', msg: 'Test throttle' });
        const found = accounts.find((item) => item.email === data.email);
        const code = found ? randomUUID() : undefined;
        if (found && url.pathname.endsWith('/recover'))
          recoveryCodes.set(code, { account: found, challenge: data.code_challenge });
        emailRequests.push({
          kind: url.pathname.endsWith('/recover') ? 'recovery' : 'confirmation',
          email: data.email,
          code,
          redirectTo: url.searchParams.get('redirect_to'),
        });
        return json(200, {});
      }
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'pkce') {
          const recovery = recoveryCodes.get(data.auth_code);
          const challenge =
            typeof data.code_verifier === 'string'
              ? createHash('sha256').update(data.code_verifier).digest('base64url')
              : '';
          if (!recovery || recovery.challenge !== challenge)
            return json(400, { code: 'flow_state_not_found', msg: 'Invalid recovery test code' });
          recoveryCodes.delete(data.auth_code);
          shortSession = false; // Recovery sessions use normal TTL; password login tests refresh separately.
          return json(200, session(recovery.account));
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          ++stats.refreshes;
          const refreshed = refreshTokens.get(data.refresh_token);
          return refreshed
            ? json(200, session(refreshed))
            : json(400, { code: 'refresh_token_not_found', msg: 'Expired test session' });
        }
        ++stats.signIns;
        const found = accounts.find((item) => item.email === data.email);
        return found && data.password === passwords.get(found.id)
          ? json(200, session(found))
          : json(400, { code: 'invalid_credentials', msg: 'Invalid test credentials' });
      }
      if (url.pathname === '/auth/v1/user' && request.method === 'PUT') {
        if (!account) return json(401, { code: 'bad_jwt', msg: 'Expired test session' });
        if (typeof data.password !== 'string' || data.password === passwords.get(account.id))
          return json(422, { code: 'same_password', msg: 'Choose new password' });
        passwords.set(account.id, data.password);
        passwordUpdates++;
        return json(200, user(account));
      }
      if (url.pathname === '/auth/v1/user')
        return account
          ? json(200, user(account))
          : json(401, { code: 'bad_jwt', msg: 'Expired test session' });
      if (url.pathname === '/auth/v1/.well-known/jwks.json') return json(200, { keys: [] });
      if (url.pathname === '/auth/v1/logout') {
        ++stats.signOuts;
        if (logoutWait) await logoutWait;
        if (logoutFailure)
          return json(400, { code: 'unexpected_failure', msg: 'Test logout failure' });
        tokens.delete(bearer);
        response.writeHead(204);
        response.end();
        return;
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        if (!account) return json(401, { message: 'UNAUTHENTICATED' });
        if (url.pathname.endsWith('/claim_workspace_invitations')) return json(200, claimResponse);
        if (url.pathname.endsWith('/get_workspace_state')) {
          if (!workspaceAccess) return json(403, { code: '42501', message: 'NO_MEMBERSHIP' });
          ++stats.reads;
          return json(200, snapshot(account));
        }
        if (url.pathname.endsWith('/workspace_command')) {
          ++stats.writes;
          return json(200, { id: org });
        }
      }
      stats.unexpected.push(url.pathname);
      json(404, { message: 'Unknown local test endpoint' });
    } catch {
      json(500, { message: 'Local test handler failed' });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    stats,
    emailRequests,
    signupWithSession: (value) => {
      signupIssuesSession = value;
    },
    allowWorkspace: (value) => {
      workspaceAccess = value;
    },
    setClaimResponse: (value) => {
      claimResponse = value;
    },
    passwordUpdates: () => passwordUpdates,
    pauseLogout() {
      let release;
      logoutWait = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        release();
        logoutWait = undefined;
      };
    },
    failLogout(value) {
      logoutFailure = value;
    },
    expireSessions() {
      tokens.clear();
      refreshTokens.clear();
    },
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
