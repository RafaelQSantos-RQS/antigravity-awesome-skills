import { beforeEach, describe, expect, it, vi } from 'vitest';

const execSync = vi.fn((command) => {
  if (command === 'git --version') return '';
  if (command === 'git rev-parse --git-dir') return '.git';
  if (command === 'git remote') return 'origin\nupstream\n';
  if (command === 'git rev-parse HEAD') return 'abc123';
  if (command === 'git fetch upstream main') return '';
  if (command === 'git rev-parse upstream/main') return 'abc123';
  return '';
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execSync,
    default: {
      ...actual,
      execSync,
    },
  };
});

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload;
    },
  };
}

async function loadRefreshHandler() {
  const { default: refreshSkillsPlugin } = await import('../../refresh-skills-plugin.js');
  const registrations = [];
  const server = {
    middlewares: {
      use(pathOrHandler, maybeHandler) {
        if (typeof pathOrHandler === 'string') {
          registrations.push({ path: pathOrHandler, handler: maybeHandler });
          return;
        }
        registrations.push({ path: null, handler: pathOrHandler });
      },
    },
  };

  refreshSkillsPlugin().configureServer(server);
  const registration = registrations.find((item) => item.path === '/api/refresh-skills');
  if (!registration) {
    throw new Error('refresh-skills handler not registered');
  }
  return registration.handler;
}

describe('refresh-skills plugin security', () => {
  beforeEach(() => {
    execSync.mockClear();
  });

  it('rejects GET requests for the sync endpoint', async () => {
    const handler = await loadRefreshHandler();
    const req = {
      method: 'GET',
      headers: {
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it('rejects cross-origin POST requests for the sync endpoint', async () => {
    const handler = await loadRefreshHandler();
    const req = {
      method: 'POST',
      headers: {
        host: 'localhost:5173',
        origin: 'http://evil.test',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
  });
});
