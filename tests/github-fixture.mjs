import assert from 'node:assert/strict';

// In-memory GitHub substitute. It never sends a network request or changes a repository.
export function createGithubFixture(initialProjects = []) {
  let counter = 0;
  let head = 'head-0';
  const snapshots = new Map([[head, structuredClone(initialProjects)]]);
  const trees = new Map();
  const commits = new Map();
  const calls = [];
  let conflict = false;
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'api.github.com');
    assert.match(init.headers.Authorization, /^Bearer /);
    const path = url.pathname.replace('/repos/baolamthienphuc-sudo/vuong-chi-v5', '');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path, body, search: url.search });
    const response = (data, status = 200) => Response.json(data, { status });
    if (path === '/git/ref/heads/main') return response({ object: { sha: head } });
    if (path === '/contents/assets/projects-data.js') {
      const snapshot = snapshots.get(url.searchParams.get('ref'));
      assert.ok(snapshot, 'Content must be read at an immutable commit SHA');
      return response({ content: Buffer.from(`window.VC_PROJECTS = ${JSON.stringify(snapshot)};\n`).toString('base64') });
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return response({ tree: { sha: 'base-tree' } });
    if (method === 'POST' && path === '/git/blobs') return response({ sha: `blob-${++counter}` });
    if (method === 'POST' && path === '/git/trees') {
      const entry = body.tree.find(item => item.path === 'assets/projects-data.js');
      const projects = JSON.parse(entry.content.replace(/^window\.VC_PROJECTS\s*=\s*/, '').replace(/;\s*$/, ''));
      const sha = `tree-${++counter}`;
      trees.set(sha, projects);
      return response({ sha });
    }
    if (method === 'POST' && path === '/git/commits') {
      const sha = `commit-${++counter}`;
      commits.set(sha, body);
      return response({ sha });
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      if (conflict) return response({ message: 'Update is not a fast forward' }, 422);
      const commit = commits.get(body.sha);
      assert.equal(body.force, false);
      assert.equal(commit.parents[0], head);
      head = body.sha;
      snapshots.set(head, structuredClone(trees.get(commit.tree)));
      return response({ object: { sha: head } });
    }
    throw new Error(`Unexpected mock GitHub request: ${method} ${path}`);
  };
  return {
    fetch, calls,
    projects: () => structuredClone(snapshots.get(head)),
    setConflict: value => { conflict = value; }
  };
}
