/* HTTP surface for the chat: the admin (the trainer) writes to one athlete or to all of them;
 * each athlete reads and answers their own thread. Same factory shape as diet/routes.js.
 * Clients poll while a thread is on screen; a push covers the rest of the time.
 */
import { z } from 'zod';
import * as store from './store.js';

const Text = z.string().trim().min(1).max(2000);
const ToAthletes = z.object({
  to: z.union([z.literal('all'), z.array(z.string().min(1).max(40)).min(1).max(500)]),
  text: Text
});

// A notification shows a preview, not the whole message.
const preview = s => (s.length > 120 ? s.slice(0, 117) + '…' : s);
const PUSH = {
  es: text => ({ title: 'Mensaje de tu entrenador', body: preview(text) }),
  en: text => ({ title: 'Message from your trainer', body: preview(text) })
};

// `after` lets a polling client fetch only what is new since the last message it has.
const since = (th, req) => {
  const after = +new URL(req.url, 'http://x').searchParams.get('after') || 0;
  return th.msgs.filter(m => m.at > after);
};

export function messageRoutes({ json, readBody, readSession, requireAdmin, users, isAdmin, readState, sendPush }) {
  const athletes = () => users().filter(u => !isAdmin(u) && !u.disabled);
  const exists = uid => !!uid && users().some(u => u.id === uid);
  const idParam = req => new URL(req.url, 'http://x').searchParams.get('id');

  return {
    // Unread count and last message per athlete, for the panel's list.
    'GET /api/trainer/messages/summary': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const threads = {};
      for (const u of users()) {
        const th = store.read(u.id);
        if (!th.msgs.length) continue;
        threads[u.id] = { unread: store.unread(th, 'trainer'), last: th.msgs[th.msgs.length - 1] };
      }
      json(res, 200, { threads });
    },

    'GET /api/trainer/messages': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const athlete = idParam(req);
      if (!exists(athlete)) return json(res, 404, { error: 'no such user' });
      const th = store.read(athlete);
      json(res, 200, { msgs: since(th, req), read: th.read });
    },

    'POST /api/trainer/messages': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = ToAthletes.safeParse(await readBody(req));
      if (!parsed.success) return json(res, 400, { error: 'invalid message' });
      const { to, text } = parsed.data;
      const list = to === 'all' ? athletes().map(u => u.id) : [...new Set(to)];
      // The trainer has no thread of their own: an admin id is refused like an unknown one.
      const missing = list.filter(a => !users().some(u => u.id === a && !isAdmin(u)));
      if (missing.length) return json(res, 404, { error: 'no such user', missing });
      if (!list.length) return json(res, 400, { error: 'no athletes to message' });
      const sent = list.map(a => ({ athlete: a, msg: store.append(a, 'trainer', text) }));
      // Fire-and-forget, like the diet push: a failed notification is not a failed message.
      for (const a of list) {
        const lang = readState(a)?.lang === 'es' ? 'es' : 'en';
        sendPush(a, { ...PUSH[lang](text), tag: 'trainer-msg', url: '#/messages' }).catch(() => {});
      }
      json(res, 200, { sent });
    },

    'POST /api/trainer/messages/read': async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      if (!exists(body.id)) return json(res, 404, { error: 'no such user' });
      store.markRead(body.id, 'trainer');
      json(res, 200, { ok: true });
    },

    'GET /api/athlete/messages': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const th = store.read(user.id);
      json(res, 200, {
        msgs: since(th, req), read: th.read,
        unread: store.unread(th, 'athlete'),
        last: th.msgs[th.msgs.length - 1] || null
      });
    },

    'POST /api/athlete/messages': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      const parsed = Text.safeParse((await readBody(req)).text);
      if (!parsed.success) return json(res, 400, { error: 'invalid message' });
      const msg = store.append(user.id, 'athlete', parsed.data);
      // The trainer panel is Spanish-only (D6), so its notification is too.
      for (const a of users().filter(isAdmin))
        sendPush(a.id, { title: 'Mensaje de ' + user.name, body: preview(msg.text), tag: 'athlete-msg-' + user.id, url: '#/admin/messages/' + user.id }).catch(() => {});
      json(res, 200, { msg });
    },

    'POST /api/athlete/messages/read': async (req, res) => {
      const user = readSession(req);
      if (!user) return json(res, 401, { error: 'not signed in' });
      store.markRead(user.id, 'athlete');
      json(res, 200, { ok: true });
    }
  };
}
