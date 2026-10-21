import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function createTestDatabase(projects = null) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_cms.sql', import.meta.url), 'utf8'));
  if (projects) {
    sqlite.prepare("INSERT INTO cms_meta (key, value) VALUES ('seeded', '1')").run();
    projects.forEach((project, index) => sqlite.prepare('INSERT INTO cms_projects VALUES (?, ?, ?, ?, ?)')
      .run(project.slug, JSON.stringify(project), project.hidden ? 1 : 0, projects.length - index, 'test-' + project.slug));
  }
  const wrap = (sql, args = []) => ({
    bind: (...values) => wrap(sql, values),
    execute: () => {
      const statement = sqlite.prepare(sql);
      const values = args.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
      if (statement.columns().length) return { results: statement.all(...values).map(row => ({ ...row })), meta: { changes: 0 } };
      const info = statement.run(...values);
      return { results: [], meta: { changes: Number(info.changes) } };
    },
    async first(column) {
      const row = wrap(sql, args).execute().results[0] || null;
      return column && row ? row[column] : row;
    },
    async all() { return wrap(sql, args).execute(); },
    async run() { return wrap(sql, args).execute(); }
  });
  return {
    prepare: sql => wrap(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close: () => sqlite.close()
  };
}
