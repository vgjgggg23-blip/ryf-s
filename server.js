require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const crypto = require('crypto');

const db = require('./lib/db');
const dc = require('./lib/discord');
const { isFont } = require('./lib/fonts');
const R = require('./lib/render');

const PORT = Number(process.env.PORT) || 3000;
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(
  cookieSession({
    name: 'sid',
    keys: [SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    httpOnly: true,
    secure: SITE_URL.startsWith('https://'),
  })
);

// حماية من الطلبات القادمة من مواقع أخرى
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const o = req.get('origin');
  if (o) {
    try {
      if (new URL(o).host !== req.get('host')) return res.status(403).send('forbidden');
    } catch (e) {
      return res.status(403).send('forbidden');
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(
  '/uploads',
  express.static(db.uploads, { maxAge: '7d', setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') })
);

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isAdmin = (req) => !!(req.session.user && ADMIN_IDS.includes(req.session.user.id));
const ctxOf = (req) => ({
  user: req.session.user || null,
  isAdmin: isAdmin(req),
  path: req.path,
  query: req.query,
});
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(n) ? n : '/');

/* ---------- الصفحات العامة ---------- */
const page = (name) =>
  ah(async (req, res) => {
    const ctx = ctxOf(req);
    const out = await R.pages[name](ctx);
    res.send(R.layout(ctx, out));
  });
app.get('/', page('home'));
app.get('/about', page('about'));
app.get('/management', page('management'));
app.get('/partners', page('partners'));
app.get('/reviews', page('reviews'));
app.get('/accounts', page('accounts'));

/* ---------- تسجيل الدخول بديسكورد ---------- */
const avatarUrl = (u) =>
  u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

app.get('/auth/login', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).send('تسجيل الدخول غير مهيأ: أضف DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET في ملف .env');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth = { state, next: safeNext(req.query.next) };
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: SITE_URL + '/auth/callback',
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  });
  res.redirect('https://discord.com/oauth2/authorize?' + q);
});

app.get(
  '/auth/callback',
  ah(async (req, res) => {
    const o = req.session.oauth;
    req.session.oauth = null;
    if (!o || !req.query.code || req.query.state !== o.state) return res.redirect('/');
    const tr = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: SITE_URL + '/auth/callback',
      }),
    });
    if (!tr.ok) return res.redirect('/');
    const tok = await tr.json();
    const ur = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!ur.ok) return res.redirect('/');
    const u = await ur.json();
    req.session.user = { id: u.id, name: u.global_name || u.username, avatar: avatarUrl(u) };
    res.redirect(o.next);
  })
);

app.get('/auth/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

/* ---------- إضافة تقييم من الموقع ---------- */
app.post(
  '/reviews',
  ah(async (req, res) => {
    const u = req.session.user;
    if (!u) return res.redirect('/auth/login?next=/reviews');
    const r = await dc.submitReview({
      userId: u.id,
      rating: req.body.rating,
      text: req.body.text,
      source: 'site',
      fallbackName: u.name,
      fallbackAvatar: u.avatar,
    });
    res.redirect('/reviews?m=' + (r.ok ? 'ok' : r.code));
  })
);

/* ---------- لوحة التحكم ---------- */
const requireAdmin = (req, res, next) => {
  if (isAdmin(req)) return next();
  if (req.path.startsWith('/admin/api')) return res.status(403).json({ error: 'غير مصرح' });
  if (!req.session.user) return res.redirect('/auth/login?next=/admin');
  res.status(403).send('ليس لديك صلاحية دخول لوحة التحكم.');
};

app.get(
  '/admin',
  requireAdmin,
  ah(async (req, res) => {
    const ctx = ctxOf(req);
    res.send(R.layout(ctx, await R.pages.admin(ctx)));
  })
);

const TEXT = {
  siteName: 60, tagline: 120, heroTitle: 120, heroText: 400, story: 3000,
  mission: 400, vision: 400, founded: 40, location: 80, commercialReg: 40,
};
const ID_RE = /^\d{15,22}$/;
const IMG_RE = /^\/uploads\/[\w.-]+$/;
const bad = (res, m) => res.status(400).json({ error: m });

app.post('/admin/api/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  const s = db.data.settings;
  for (const [k, n] of Object.entries(TEXT)) {
    if (typeof b[k] === 'string') s[k] = b[k].trim().slice(0, n);
  }
  if (typeof b.discordInvite === 'string') {
    const v = b.discordInvite.trim();
    if (v && !dc.inviteCode(v)) return bad(res, 'رابط الدعوة غير صحيح');
    s.discordInvite = v;
  }
  for (const k of ['reviewRoleId', 'reviewChannelId']) {
    if (typeof b[k] === 'string') {
      const v = b[k].trim();
      if (v && !ID_RE.test(v)) return bad(res, 'الرقم غير صحيح');
      s[k] = v;
    }
  }
  if (b.colors && typeof b.colors === 'object') {
    for (const k of Object.keys(s.colors)) {
      if (/^#[0-9a-f]{6}$/i.test(b.colors[k] || '')) s.colors[k] = b.colors[k];
    }
  }
  if (b.fonts && typeof b.fonts === 'object') {
    s.fonts = s.fonts || {};
    for (const k of ['display', 'body']) {
      if (isFont(b.fonts[k])) s.fonts[k] = b.fonts[k];
    }
  }
  if (b.images && typeof b.images === 'object') {
    for (const k of Object.keys(s.images)) {
      const v = b.images[k];
      if (typeof v === 'string' && (v === '' || IMG_RE.test(v))) s.images[k] = v;
    }
  }
  db.save();
  res.json({ ok: true });
});

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: db.uploads,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
  }),
  fileFilter: (req, file, cb) => cb(null, !!EXT[file.mimetype]),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
app.post('/admin/api/upload', requireAdmin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'الصورة أكبر من 5 ميجابايت' : 'تعذر رفع الصورة');
    if (!req.file) return bad(res, 'الملف يجب أن يكون صورة (png, jpg, webp, gif)');
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

const LISTS = {
  management(b) {
    const userId = String(b.userId || '').trim();
    const roleId = String(b.roleId || '').trim();
    if (!ID_RE.test(userId)) return { error: 'رقم حساب العضو غير صحيح' };
    if (roleId && !ID_RE.test(roleId)) return { error: 'رقم الرتبة غير صحيح' };
    return { item: { userId, roleId, title: String(b.title || '').trim().slice(0, 60) } };
  },
  partners(b) {
    const invite = String(b.invite || '').trim();
    const code = dc.inviteCode(invite);
    if (!code) return { error: 'رابط الدعوة غير صحيح' };
    return { item: { invite: `https://discord.gg/${code}` } };
  },
  accounts(b) {
    const platform = String(b.platform || '').trim().slice(0, 40);
    if (!platform) return { error: 'اكتب اسم الحساب' };
    const url = String(b.url || '').trim();
    if (url && !R.safeUrl(url)) return { error: 'الرابط يجب أن يبدأ بـ http أو https' };
    const image = String(b.image || '');
    return {
      item: {
        platform,
        handle: String(b.handle || '').trim().slice(0, 80),
        url,
        image: IMG_RE.test(image) ? image : '',
      },
    };
  },
};

app.post('/admin/api/:list(management|partners|accounts)', requireAdmin, (req, res) => {
  const r = LISTS[req.params.list](req.body || {});
  if (r.error) return bad(res, r.error);
  db.data[req.params.list].push({ id: db.id(), ...r.item });
  db.save();
  res.json({ ok: true });
});

app.delete('/admin/api/:list(management|partners|accounts|reviews)/:id', requireAdmin, (req, res) => {
  const l = db.data[req.params.list];
  const i = l.findIndex((x) => x.id === req.params.id);
  if (i >= 0) l.splice(i, 1);
  db.save();
  res.json({ ok: true });
});

app.post('/admin/api/reviews/:id/toggle', requireAdmin, (req, res) => {
  const r = db.data.reviews.find((x) => x.id === req.params.id);
  if (r) r.hidden = !r.hidden;
  db.save();
  res.json({ ok: true });
});

app.use((req, res) => res.status(404).send(R.layout(ctxOf(req), { title: 'غير موجودة', active: '', body: '<div class="wrap page"><div class="empty">الصفحة غير موجودة.</div></div>' })));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('حدث خطأ غير متوقع.');
});

app.listen(PORT, () => {
  console.log(`الموقع يعمل على ${SITE_URL}`);
  if (!ADMIN_IDS.length) console.log('تنبيه: ADMIN_IDS فارغ، لن يستطيع أحد دخول لوحة التحكم.');
  dc.start();
});
