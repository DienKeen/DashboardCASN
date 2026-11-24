function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

function verifyAdminPin(request, env) {
    const expectedPin = String(env.ADMIN_PIN || '').trim();
    if (!expectedPin) {
        return { ok: false, reason: 'Variabel ADMIN_PIN belum diatur di Cloudflare Pages.' };
    }
    const providedPin = String(request.headers.get('X-Admin-Pin') || '').trim();
    if (!providedPin || providedPin !== expectedPin) {
        return { ok: false, reason: 'PIN Admin tidak sesuai.' };
    }
    return { ok: true };
}

async function ensureSchema(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            agent TEXT DEFAULT '',
            sj TEXT DEFAULT '',
            sc TEXT DEFAULT '',
            mc TEXT DEFAULT '',
            dsc TEXT DEFAULT '',
            pr TEXT DEFAULT '',
            st TEXT DEFAULT '',
            ch TEXT DEFAULT '',
            is_escalated INTEGER DEFAULT 0,
            do_start TEXT,
            do_open TEXT,
            do_res TEXT,
            do_pending TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Migrasi otomatis jika tabel lama belum memiliki kolom agent
    try {
        await db.prepare(`ALTER TABLE tickets ADD COLUMN agent TEXT DEFAULT ''`).run();
    } catch (_) {
        // Abaikan jika kolom agent sudah ada
    }
}

// GET /api/tickets -> Mengambil seluruh data interaksi & tiket untuk dashboard
export async function onRequestGet({ env }) {
    try {
        const db = env.DB;
        if (!db) {
            return jsonResponse({ ok: false, reason: 'Binding D1 "DB" tidak ditemukan.' }, 500);
        }

        await ensureSchema(db);

        const { results } = await db.prepare(`
            SELECT
                id,
                agent,
                sj,
                sc,
                mc,
                dsc,
                pr,
                st,
                ch,
                is_escalated,
                do_start,
                do_open,
                do_res,
                do_pending
            FROM tickets
        `).all();

        const records = (results || []).map(row => ({
            id: row.id || '',
            agent: row.agent || '',
            sj: row.sj || '',
            sc: row.sc || '',
            mc: row.mc || '',
            dsc: row.dsc || '',
            pr: row.pr || '',
            st: row.st || '',
            ch: row.ch || '',
            isEscalated: Boolean(row.is_escalated),
            doStart: row.do_start || null,
            doOpen: row.do_open || null,
            doRes: row.do_res || null,
            doPending: row.do_pending || null
        }));

        return jsonResponse({
            ok: true,
            count: records.length,
            records
        });
    } catch (err) {
        return jsonResponse({ ok: false, reason: err.message }, 500);
    }
}

// POST /api/tickets -> Menyimpan batch hasil upload Excel/CSV (mode: replace | upsert)
export async function onRequestPost({ request, env }) {
    try {
        const auth = verifyAdminPin(request, env);
        if (!auth.ok) {
            return jsonResponse({ ok: false, reason: auth.reason }, 401);
        }

        const db = env.DB;
        if (!db) {
            return jsonResponse({ ok: false, reason: 'Binding D1 "DB" tidak ditemukan.' }, 500);
        }

        const body = await request.json().catch(() => null);
        if (!body || !Array.isArray(body.records)) {
            return jsonResponse({ ok: false, reason: 'Payload records tidak valid.' }, 400);
        }

        const mode = body.mode === 'replace' ? 'replace' : 'upsert';
        const records = body.records.filter(r => r && r.id);

        await ensureSchema(db);

        const stmts = [];
        if (mode === 'replace') {
            stmts.push(db.prepare(`DELETE FROM tickets`));
        }

        const insertStmt = db.prepare(`
            INSERT INTO tickets (
                id, agent, sj, sc, mc, dsc, pr, st, ch,
                is_escalated, do_start, do_open, do_res, do_pending, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                agent = excluded.agent,
                sj = excluded.sj,
                sc = excluded.sc,
                mc = excluded.mc,
                dsc = excluded.dsc,
                pr = excluded.pr,
                st = excluded.st,
                ch = excluded.ch,
                is_escalated = excluded.is_escalated,
                do_start = excluded.do_start,
                do_open = excluded.do_open,
                do_res = excluded.do_res,
                do_pending = excluded.do_pending,
                updated_at = CURRENT_TIMESTAMP
        `);

        for (const r of records) {
            stmts.push(
                insertStmt.bind(
                    String(r.id).trim(),
                    String(r.agent || '').trim(),
                    String(r.sj || '').trim(),
                    String(r.sc || '').trim(),
                    String(r.mc || '').trim(),
                    String(r.dsc || '').trim(),
                    String(r.pr || '').trim(),
                    String(r.st || '').trim(),
                    String(r.ch || '').trim(),
                    r.isEscalated ? 1 : 0,
                    r.doStart || null,
                    r.doOpen || null,
                    r.doRes || null,
                    r.doPending || null
                )
            );
        }

        if (stmts.length > 0) {
            await db.batch(stmts);
        }

        return jsonResponse({
            ok: true,
            mode,
            saved: records.length
        });
    } catch (err) {
        return jsonResponse({ ok: false, reason: err.message }, 500);
    }
}

// DELETE /api/tickets -> Mengosongkan tabel saat tombol Reset diklik
export async function onRequestDelete({ request, env }) {
    try {
        const auth = verifyAdminPin(request, env);
        if (!auth.ok) {
            return jsonResponse({ ok: false, reason: auth.reason }, 401);
        }

        const db = env.DB;
        if (!db) {
            return jsonResponse({ ok: false, reason: 'Binding D1 "DB" tidak ditemukan.' }, 500);
        }

        await ensureSchema(db);
        await db.prepare(`DELETE FROM tickets`).run();

        return jsonResponse({ ok: true });
    } catch (err) {
        return jsonResponse({ ok: false, reason: err.message }, 500);
    }
}
