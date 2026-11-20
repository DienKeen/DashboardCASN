const INIT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_date TEXT,
    interaction_date TEXT,
    sub_category TEXT,
    detail_category TEXT,
    is_escalated INTEGER,
    status_name TEXT,
    channel TEXT,
    payload TEXT NOT NULL,
    updated_at TEXT
  )
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.dbcasn || env.DB;
    const expectedPin = String(env.ADMIN_PIN || '2026');

    if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const valid = String(body.pin || '') === expectedPin;
      return new Response(JSON.stringify({ ok: valid }), {
        status: valid ? 200 : 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/tickets') {
      if (!db) {
        return new Response(JSON.stringify({ ok: false, reason: 'D1_NOT_BOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await db.prepare(INIT_TABLE_SQL).run();

      if (request.method === 'GET') {
        const { results } = await db.prepare('SELECT payload FROM tickets').all();
        const records = results.map(row => JSON.parse(row.payload));
        return new Response(JSON.stringify({ ok: true, records }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const providedPin = request.headers.get('X-Admin-Pin') || '';
      if (providedPin !== expectedPin) {
        return new Response(JSON.stringify({ ok: false, reason: 'PIN Admin tidak valid atau belum login' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const { mode, records } = await request.json();
        const statements = [];

        if (mode === 'replace') {
          statements.push(db.prepare('DELETE FROM tickets'));
        }

        const now = new Date().toISOString();
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO tickets 
          (id, ticket_date, interaction_date, sub_category, detail_category, is_escalated, status_name, channel, payload, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const r of records) {
          statements.push(
            stmt.bind(
              r.id,
              r.ticketDateYMD || null,
              r.interactionDateYMD || null,
              r.subCategory || null,
              r.detailCategory || null,
              r.isEscalated ? 1 : 0,
              r.statusName || null,
              r.channel || null,
              JSON.stringify(r),
              now
            )
          );
        }

        await db.batch(statements);
        return new Response(JSON.stringify({ ok: true, count: records.length }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'DELETE') {
        await db.prepare('DELETE FROM tickets').run();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
