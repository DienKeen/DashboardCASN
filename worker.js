export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/tickets') {
      if (!env.DB) {
        return new Response(JSON.stringify({ ok: false, reason: 'D1_NOT_BOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT payload FROM tickets').all();
        const records = results.map(row => JSON.parse(row.payload));
        return new Response(JSON.stringify({ ok: true, records }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const { mode, records } = await request.json();
        const statements = [];

        if (mode === 'replace') {
          statements.push(env.DB.prepare('DELETE FROM tickets'));
        }

        const now = new Date().toISOString();
        const stmt = env.DB.prepare(
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

        await env.DB.batch(statements);
        return new Response(JSON.stringify({ ok: true, count: records.length }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM tickets').run();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
