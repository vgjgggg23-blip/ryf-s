const db = require('./db');
const dc = require('./discord');
const { FONTS, isFont, fontsUrl } = require('./fonts');

const BUILD = Date.now().toString(36);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUM = new Intl.NumberFormat('en-US');
const DATE = new Intl.DateTimeFormat('ar', { dateStyle: 'medium', numberingSystem: 'latn', calendar: 'gregory' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const imgUrl = (u) => (/^\/uploads\/[\w.-]+$/.test(u || '') ? u : '');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

/* ---------- الألوان ---------- */
function lum(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (hex) => (lum(hex) > 0.179 ? '#10131c' : '#ffffff');
function themeCss() {
  const c = db.data.settings.colors;
  const f = db.data.settings.fonts || {};
  const dsp = isFont(f.display) ? f.display : 'Reem Kufi';
  const bdy = isFont(f.body) ? f.body : 'IBM Plex Sans Arabic';
  return `:root{--display:"${dsp}","IBM Plex Sans Arabic",system-ui,sans-serif;--body:"${bdy}",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;--bg:${c.bg};--surface:${c.surface};--fg:${c.fg};--accent:${c.accent};--gold:${c.gold};--deep:${c.deep};--accent-fg:${onColor(c.accent)};--gold-fg:${onColor(c.gold)};--deep-fg:${onColor(c.deep)}}`;
}

/* ---------- أيقونات ---------- */
const svg = (d) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  bag: svg('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  about: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  team: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 5a3.2 3.2 0 0 1 0 6M18 14c2.2.5 3.5 2.4 3.5 5"/>'),
  partners: svg('<path d="M3 12l5-5 4 3 4-3 5 5-9 8-9-8z"/>'),
  star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>'),
  chat: svg('<path d="M4 5h16v11H9l-5 4V5z"/>'),
  shield: svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>'),
  bolt: svg('<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>'),
  headset: svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'),
};

const NAV = [
  ['/', 'الرئيسية', 'home'],
  ['/about', 'من نحن', 'about'],
  ['/management', 'الإدارة', 'management'],
  ['/partners', 'شركاء النجاح', 'partners'],
  ['/reviews', 'التقييمات', 'reviews'],
  ['/accounts', 'حساباتنا', 'accounts'],
];

const avatar = (src, name, cls = 'av') =>
  src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`
    : `<span class="${cls} ph" aria-hidden="true">${esc((name || '?').trim()[0] || '?')}</span>`;

/* ---------- الهيكل العام ---------- */
function layout(ctx, { title, active, body, scripts = '' }) {
  const s = db.data.settings;
  const u = ctx.user;
  const nav = NAV.map(([h, t, k]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const logo = imgUrl(s.images.siteImage)
    ? `<img class="logo" src="${esc(s.images.siteImage)}" alt="">`
    : `<span class="logo">${ICON.bag}</span>`;
  const userbox = u
    ? `<div class="ubox">${avatar(u.avatar, u.name, 'uav')}<span class="uname">${esc(u.name)}</span>${
        ctx.isAdmin ? '<a class="mini" href="/admin">لوحة التحكم</a>' : ''
      }<a class="mini" href="/auth/logout">خروج</a></div>`
    : `<a class="btn solid sm" href="/auth/login?next=${encodeURIComponent(ctx.path)}">دخول بديسكورد</a>`;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title ? title + ' | ' + s.siteName : s.siteName)}</title>
<meta name="description" content="${esc(s.heroText || s.tagline)}"><meta name="theme-color" content="${esc(s.colors.deep)}">
<meta property="og:title" content="${esc(s.siteName)}"><meta property="og:description" content="${esc(s.heroText || s.tagline)}">${imgUrl(s.images.siteImage) ? `<meta property="og:image" content="${esc(s.images.siteImage)}"><link rel="icon" href="${esc(s.images.siteImage)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsUrl((s.fonts || {}).display, (s.fonts || {}).body))}">
<link rel="stylesheet" href="/style.css?v=${BUILD}">
<link rel="stylesheet" href="/neon.css?v=${BUILD}">
<style>${themeCss()}${imgUrl(s.images.siteBg) ? `body::before{content:"";position:fixed;inset:0;z-index:0;background:linear-gradient(rgba(3,0,8,.45),rgba(3,0,8,.65)),url('${esc(s.images.siteBg)}') center/cover no-repeat;pointer-events:none}` : ''}</style>
</head><body>
<canvas id="fx" aria-hidden="true"></canvas>
<header class="top"><div class="wrap hrow">
  <a class="brand" href="/" aria-label="الرئيسية">${logo}<span>${esc(s.siteName)}</span></a>
  <nav aria-label="القائمة الرئيسية">${nav}</nav>
  ${userbox}
</div></header>
<main>${body}</main>
<footer class="site"><div class="wrap">
  <div class="fcols">
    <div><h4>${esc(s.siteName)}</h4><p>${esc(s.tagline)}</p></div>
    <div><h4>صفحات الموقع</h4>${NAV.slice(1).map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div>
    <div><h4>تواصل معنا</h4>${
      s.discordInvite ? `<a href="${esc(s.discordInvite)}" target="_blank" rel="noopener">سيرفر الديسكورد</a>` : ''
    }<a href="/accounts">حساباتنا الرسمية</a></div>
  </div>
  <div class="fbase"><span>© ${new Date().getFullYear()} ${esc(s.siteName)}. جميع الحقوق محفوظة.</span>${
    s.commercialReg ? `<span>السجل التجاري: <bdi>${esc(s.commercialReg)}</bdi></span>` : ''
  }</div>
</div></footer>
<button id="up" type="button" aria-label="للأعلى" hidden>↑</button>
<script>(function(){var b=document.getElementById('up');if(!b)return;addEventListener('scroll',function(){b.hidden=scrollY<500},{passive:true});b.onclick=function(){scrollTo({top:0,behavior:'smooth'})}})();</script>
<script src="/site.js?v=${BUILD}" defer></script><script src="/fx.js?v=${BUILD}" defer></script>${scripts}
</body></html>`;
}

const head = (crumb, title, sub) =>
  `<section class="pagehead"><div class="wrap"><div class="crumb"><a href="/">الرئيسية</a> / ${crumb}</div><h1>${title}</h1>${
    sub ? `<p>${sub}</p>` : ''
  }</div></section>`;

/* ---------- التقييمات: مساعدات ---------- */
const visibleReviews = () =>
  db.data.reviews.filter((r) => !r.hidden).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const reviewCard = (r) =>
  `<article class="review"><div class="top"><span class="stars" aria-label="${r.rating} من 5">${stars(r.rating)}</span>${
    r.source === 'discord' ? '<span class="src">من الديسكورد</span>' : ''
  }</div><p>${esc(r.text)}</p><footer><span class="who">${avatar(r.avatar, r.username)}<b>${esc(r.username)}</b></span>${
    r.roleName ? `<span class="role-b">${esc(r.roleName)}</span>` : ''
  }<time>${DATE.format(new Date(r.createdAt))}</time></footer></article>`;

function stats() {
  const rs = visibleReviews();
  const n = rs.length;
  const avg = n ? rs.reduce((a, r) => a + r.rating, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map((k) => ({ k, c: rs.filter((r) => r.rating === k).length }));
  return { rs, n, avg, dist };
}

/* ---------- الصفحات ---------- */
async function home() {
  const s = db.data.settings;
  const st = stats();
  const inv = await dc.inviteInfo(s.discordInvite);
  const bn = imgUrl(s.images.siteBanner);
  const join = s.discordInvite
    ? `<a class="btn line" href="${esc(s.discordInvite)}" target="_blank" rel="noopener">سيرفر المتجر على ديسكورد</a>`
    : '';
  const sb = imgUrl(s.images.storeBanner);
  const si = imgUrl(s.images.storeImage);
  const body = `
<section class="hero"${bn ? ` style="--hero-img:url('${esc(bn)}')"` : ''}><div class="wrap hgrid">
  <div>
    <div class="kicker">${esc(s.tagline)}</div>
    <h1>${esc(s.heroTitle)}</h1>
    <p class="lead">${esc(s.heroText)}</p>
    <div class="cta"><a class="btn light" href="/reviews">آراء العملاء</a>${join}</div>
  </div>
  <div class="hcard">
    <div class="rate"><span class="num">${st.n ? st.avg.toFixed(1) : '—'}</span><span class="stars" aria-hidden="true">${stars(Math.round(st.avg))}</span></div>
    <div class="row"><span>عدد التقييمات</span><b>${NUM.format(st.n)}</b></div>
    ${inv ? `<div class="row"><span>أعضاء السيرفر</span><b>${NUM.format(inv.members)}</b></div><div class="row"><span>المتصلون الآن</span><b>${NUM.format(inv.online)}</b></div>` : ''}
  </div>
</div></section>

<script>(function(){
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var st=document.querySelector('.store');
if(st){st.addEventListener('pointermove',function(e){if(e.pointerType==='touch')return;var r=st.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width-.5,ny=(e.clientY-r.top)/r.height-.5;st.style.setProperty('--ry',(-nx*8).toFixed(2)+'deg');st.style.setProperty('--rx',(ny*8).toFixed(2)+'deg');st.style.setProperty('--sc',1.01)});st.addEventListener('pointerleave',function(){st.style.setProperty('--ry','0deg');st.style.setProperty('--rx','0deg');st.style.setProperty('--sc',1)})}
var c=document.querySelector('.hcard');if(!c)return;
c.style.transition='none';
var hover=false,tx=0,ty=0,cx=0,cy=0,cs=1,fy=0,next=0;
function rnd(a){return(Math.random()*2-1)*a}
function loop(t){
 if(!hover&&t>next){tx=rnd(13);ty=rnd(10);next=t+1700+Math.random()*1700}
 var k=hover?.2:.035;
 cx+=(tx-cx)*k;cy+=(ty-cy)*k;
 cs+=((hover?1.04:1)-cs)*.12;
 fy+=((hover?0:Math.sin(t/1100)*7)-fy)*.08;
 c.style.setProperty('--ry',cx.toFixed(2)+'deg');
 c.style.setProperty('--rx',cy.toFixed(2)+'deg');
 c.style.setProperty('--sc',cs.toFixed(3));
 c.style.translate='0 '+fy.toFixed(2)+'px';
 requestAnimationFrame(loop)
}
c.addEventListener('pointerenter',function(e){if(e.pointerType!=='touch')hover=true});
c.addEventListener('pointermove',function(e){if(e.pointerType==='touch')return;hover=true;var r=c.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width-.5,ny=(e.clientY-r.top)/r.height-.5;tx=-nx*2*16;ty=ny*2*16});
c.addEventListener('pointerleave',function(){hover=false;next=0});
requestAnimationFrame(loop);
})();</script>

<section class="block"><div class="wrap">
  <article class="store">
    <div class="sbn"${sb ? ` style="background-image:url('${esc(sb)}')"` : ''}></div>
    <div class="sbd">
      ${si ? `<img class="sav" src="${esc(si)}" alt="">` : `<span class="sav ph">${esc(s.siteName[0] || '?')}</span>`}
      <div class="stx"><h2>${esc(s.siteName)}</h2><p>${esc(s.heroText)}</p></div>
      ${s.discordInvite ? `<a class="btn solid" href="${esc(s.discordInvite)}" target="_blank" rel="noopener">انضم إلى السيرفر</a>` : ''}
    </div>
  </article>
</div></section>

<section class="block"><div class="wrap">
  <div class="sec-head"><h2>لماذا ${esc(s.siteName)}؟</h2></div>
  <div class="feats">
    <div class="feat"><div class="ico">${ICON.shield}</div><h3>منتجات موثوقة</h3><p>نختار ما نقدمه بعناية لتشتري وأنت مطمئن.</p></div>
    <div class="feat"><div class="ico">${ICON.bolt}</div><h3>خدمة سريعة</h3><p>نتابع طلبك ونرد عليك في أسرع وقت.</p></div>
    <div class="feat"><div class="ico">${ICON.tag}</div><h3>أسعار مناسبة</h3><p>أسعار واضحة وتناسب الجميع.</p></div>
    <div class="feat"><div class="ico">${ICON.headset}</div><h3>دعم مباشر</h3><p>فريقنا متواجد في السيرفر لمساعدتك.</p></div>
  </div>
</div></section>

<section class="block"><div class="wrap">
  <div class="sec-head"><h2>كيف تطلب؟</h2></div>
  <div class="steps">
    <div class="step"><h3>انضم إلى السيرفر</h3><p>ادخل سيرفر المتجر على ديسكورد.</p></div>
    <div class="step"><h3>اختر طلبك</h3><p>تواصل مع الفريق وحدّد ما تحتاجه.</p></div>
    <div class="step"><h3>استلم وقيّم</h3><p>استلم طلبك وشاركنا رأيك في صفحة التقييمات.</p></div>
  </div>
</div></section>

<section class="block alt"><div class="wrap">
  <div class="sec-head"><h2>تصفح الموقع</h2></div>
  <div class="hub">
    <a class="tile" href="/about"><div class="ico">${ICON.about}</div><h3>من نحن</h3><p>قصة المتجر ورؤيته.</p><span class="go">اقرأ المزيد ←</span></a>
    <a class="tile" href="/management"><div class="ico">${ICON.team}</div><h3>الإدارة</h3><p>الفريق الذي يقود المتجر.</p><span class="go">تعرّف على الفريق ←</span></a>
    <a class="tile" href="/partners"><div class="ico">${ICON.partners}</div><h3>شركاء النجاح</h3><p>السيرفرات التي نعمل معها.</p><span class="go">شركاؤنا ←</span></a>
    <a class="tile" href="/reviews"><div class="ico">${ICON.star}</div><h3>التقييمات</h3><p>آراء العملاء المرتبطة برتب الديسكورد.</p><span class="go">اقرأ التقييمات ←</span></a>
    <a class="tile" href="/accounts"><div class="ico">${ICON.chat}</div><h3>حساباتنا</h3><p>قنوات التواصل الرسمية.</p><span class="go">تواصل معنا ←</span></a>
  </div>
</div></section>
${
  st.n
    ? `<section class="block"><div class="wrap"><div class="sec-head"><h2>من آراء عملائنا</h2></div><div class="cards">${st.rs
        .slice(0, 3)
        .map(reviewCard)
        .join('')}</div><div class="cta"><a class="btn ghost" href="/reviews">كل التقييمات ←</a></div></div></section>`
    : ''
}
<section class="block"><div class="wrap">
  <div class="sec-head"><h2>أسئلة شائعة</h2></div>
  <div class="faq">
    <details><summary>كيف أقدم طلبي؟</summary><p>انضم إلى سيرفر المتجر على ديسكورد وتواصل مع الفريق، وسنساعدك خطوة بخطوة.</p></details>
    <details><summary>كيف أتواصل مع الدعم؟</summary><p>من خلال السيرفر أو حساباتنا الرسمية في صفحة «حساباتنا».</p></details>
    <details><summary>هل التقييمات حقيقية؟</summary><p>نعم، التقييمات مرتبطة بحسابات ديسكورد ورتب العملاء في السيرفر.</p></details>
  </div>
</div></section>
<section class="block"><div class="wrap"><div class="ctaband">
  <h2>جاهز تبدأ معنا؟</h2><p>انضم إلى مجتمعنا وتعرّف على خدماتنا.</p>
  <div class="cta">${s.discordInvite ? `<a class="btn solid" href="${esc(s.discordInvite)}" target="_blank" rel="noopener">انضم إلى السيرفر</a>` : ''}<a class="btn ghost" href="/reviews">آراء العملاء</a></div>
</div></div></section>`;
  return { title: '', active: 'home', body };
}

async function about() {
  const s = db.data.settings;
  const paras = String(s.story || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const facts = [
    ['تاريخ التأسيس', s.founded],
    ['المقر', s.location],
    ['السجل التجاري', s.commercialReg],
  ].filter(([, v]) => v);
  const body = `${head('من نحن', 'من نحن', 'قصة المتجر ورسالته.')}
<div class="wrap page"><div class="two"><div class="prose">${paras}</div>${
    facts.length
      ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
      : ''
  }</div>${
    s.mission || s.vision
      ? `<div class="mv">${s.mission ? `<div><h3>رسالتنا</h3><p>${esc(s.mission)}</p></div>` : ''}${
          s.vision ? `<div><h3>رؤيتنا</h3><p>${esc(s.vision)}</p></div>` : ''
        }</div>`
      : ''
  }</div>`;
  return { title: 'من نحن', active: 'about', body };
}

async function management() {
  const list = await Promise.all(
    db.data.management.map(async (m) => {
      const [info, role] = await Promise.all([
        dc.memberInfo(m.userId).catch(() => null),
        m.roleId ? dc.roleInfo(m.roleId).catch(() => null) : null,
      ]);
      return { m, info, role };
    })
  );
  const cards = list
    .map(({ m, info, role }) => {
      const name = info ? info.name : 'عضو';
      const title = m.title || (role && role.name) || '';
      return `<article class="person">${avatar(info && info.avatar, name, 'pav')}<h3>${esc(name)}</h3>${
        title ? `<span class="rolechip"${role && role.color ? ` style="--rc:${esc(role.color)}"` : ''}><i></i>${esc(title)}</span>` : ''
      }</article>`;
    })
    .join('');
  const body = `${head('الإدارة', 'الإدارة', 'الفريق الذي يقود المتجر ويتابع كل طلب.')}
<div class="wrap page">${
    cards ? `<div class="team">${cards}</div>` : '<div class="empty">لم تتم إضافة أعضاء الإدارة بعد.</div>'
  }</div>`;
  return { title: 'الإدارة', active: 'management', body };
}

const serverCard = (info, fallbackLink) => {
  if (!info) {
    return `<article class="srv"><div class="bn"></div><span class="ic ph">؟</span><div class="bd"><h3>سيرفر ديسكورد</h3><p>تعذر جلب بيانات السيرفر الآن.</p><a class="btn solid block" href="${esc(fallbackLink)}" target="_blank" rel="noopener">الانتقال إلى السيرفر</a></div></article>`;
  }
  const ic = info.icon
    ? `<img class="ic" src="${esc(info.icon)}" alt="" loading="lazy">`
    : `<span class="ic ph">${esc((info.name || '?')[0])}</span>`;
  return `<article class="srv"><div class="bn"${
    info.banner ? ` style="background-image:url('${esc(info.banner)}')"` : ''
  }></div>${ic}<div class="bd"><h3>${esc(info.name)}</h3><div class="dots"><span class="on"><i></i>${NUM.format(
    info.online
  )} متصل</span><span class="mem"><i></i>${NUM.format(info.members)} عضو</span></div>${
    info.description ? `<p>${esc(info.description)}</p>` : ''
  }<a class="btn solid block" href="${esc(info.url)}" target="_blank" rel="noopener">الانتقال إلى السيرفر</a></div></article>`;
};

async function partners() {
  const infos = await Promise.all(db.data.partners.map((p) => dc.inviteInfo(p.invite)));
  const cards = db.data.partners.map((p, i) => serverCard(infos[i], p.invite)).join('');
  const body = `${head('شركاء النجاح', 'شركاء النجاح', 'سيرفرات نعمل معها لنقدم لك تجربة أفضل.')}
<div class="wrap page">${
    cards ? `<div class="servers">${cards}</div>` : '<div class="empty">لم تتم إضافة شركاء بعد.</div>'
  }</div>`;
  return { title: 'شركاء النجاح', active: 'partners', body };
}

const MSG = {
  ok: ['ok', 'تم نشر تقييمك في الموقع والديسكورد. شكرًا لك.'],
  again: ['err', 'يمكنك إضافة تقييم واحد كل 24 ساعة.'],
  norole: ['err', 'التقييم متاح لأصحاب رتبة العملاء في السيرفر فقط.'],
  notmember: ['err', 'يجب أن تكون عضوًا في سيرفر الديسكورد لتقييم المتجر.'],
  bot: ['err', 'التقييم غير متاح حاليًا، حاول لاحقًا.'],
  text: ['err', 'اكتب تعليقًا من 5 إلى 500 حرف.'],
  rating: ['err', 'اختر عدد النجوم.'],
};

async function reviews(ctx) {
  const s = db.data.settings;
  const st = stats();
  const flash = MSG[ctx.query.m] ? `<div class="flash ${MSG[ctx.query.m][0]}">${MSG[ctx.query.m][1]}</div>` : '';
  let roleName = '';
  if (s.reviewRoleId) {
    const r = await dc.roleInfo(s.reviewRoleId).catch(() => null);
    roleName = r ? r.name : '';
  }
  const form = ctx.user
    ? `<form class="box rform" method="post" action="/reviews"><h3>أضف تقييمك</h3>
<div class="starpick" data-input="rating" role="group" aria-label="عدد النجوم">${[1, 2, 3, 4, 5]
        .map((v) => `<button type="button" data-v="${v}" aria-label="${v}">★</button>`)
        .join('')}</div>
<input type="hidden" name="rating" id="rating" value="5">
<textarea name="text" required minlength="5" maxlength="500" placeholder="اكتب تجربتك مع المتجر"></textarea>
<button class="btn solid" type="submit">إرسال التقييم</button>
<small>${roleName ? `متاح لأصحاب رتبة «${esc(roleName)}». ` : ''}يظهر تقييمك في الموقع وفي سيرفر الديسكورد. يمكنك أيضًا استخدام الأمر <bdi>/review</bdi> داخل السيرفر.</small></form>`
    : `<div class="box"><h3>أضف تقييمك</h3><p class="muted">سجّل الدخول بحساب ديسكورد لتقييم المتجر.</p><a class="btn solid" href="/auth/login?next=/reviews">دخول بديسكورد</a></div>`;
  const summary = `<div class="summary"><div class="rate"><span class="num">${st.n ? st.avg.toFixed(1) : '—'}</span><span class="stars" aria-hidden="true">${stars(
    Math.round(st.avg)
  )}</span></div><small class="muted">من ${NUM.format(st.n)} تقييمًا</small><div class="bars">${st.dist
    .map(
      ({ k, c }) =>
        `<div class="bar"><span>${k}</span><i style="--w:${st.n ? Math.round((c / st.n) * 100) : 0}%"></i><span>${NUM.format(c)}</span></div>`
    )
    .join('')}</div></div>`;
  const body = `${head('التقييمات', 'التقييمات', 'آراء العملاء بعد استلام طلباتهم.')}
<div class="wrap page">${flash}<div class="rwrap"><aside>${summary}${form}</aside><div>${
    st.n ? `<div class="cards">${st.rs.map(reviewCard).join('')}</div>` : '<div class="empty">لا توجد تقييمات بعد. كن أول من يقيّم.</div>'
  }</div></div></div>`;
  return { title: 'التقييمات', active: 'reviews', body };
}

async function accounts() {
  const cards = db.data.accounts
    .map((a) => {
      const link = safeUrl(a.url);
      const img = imgUrl(a.image);
      return `<div class="acct">${
        img ? `<img class="aav" src="${esc(img)}" alt="">` : `<span class="aav ph">${esc((a.platform || '?')[0])}</span>`
      }<div class="t"><small>${esc(a.platform)}</small><b>${esc(a.handle || '')}</b></div><div class="acts">${
        link ? `<a class="btn ghost sm" href="${esc(link)}" target="_blank" rel="noopener">فتح</a>` : ''
      }${a.handle ? `<button class="copy" type="button" data-copy="${esc(a.handle)}">نسخ</button>` : ''}</div></div>`;
    })
    .join('');
  const body = `${head('حساباتنا', 'حساباتنا', 'تابعنا وتواصل معنا عبر القنوات الرسمية فقط.')}
<div class="wrap page">${cards ? `<div class="accounts">${cards}</div>` : '<div class="empty">لا توجد حسابات حاليًا.</div>'}</div>`;
  return { title: 'حساباتنا', active: 'accounts', body };
}

/* ---------- لوحة التحكم ---------- */
const field = (label, name, value, o = {}) => {
  const id = 'f_' + name.replace(/\W/g, '_');
  const input = o.area
    ? `<textarea id="${id}" name="${name}" rows="${o.rows || 4}" maxlength="${o.max || 500}">${esc(value)}</textarea>`
    : `<input id="${id}" name="${name}" type="${o.type || 'text'}" value="${esc(value)}"${o.max ? ` maxlength="${o.max}"` : ''}${
        o.dir ? ` dir="${o.dir}"` : ''
      }>`;
  return `<label class="fld" for="${id}"><span>${label}</span>${input}${o.hint ? `<em>${o.hint}</em>` : ''}</label>`;
};

const imageField = (label, key, value, hint) => {
  const id = 'img_' + key;
  return `<div class="fld imgf"><span>${label}</span><div class="imgrow">
${imgUrl(value) ? `<img id="prev_${key}" class="prev" src="${esc(value)}" alt="">` : `<img id="prev_${key}" class="prev" alt="" hidden>`}
<div><input type="hidden" id="${id}" name="images.${key}" value="${esc(value)}">
<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-target="${id}" data-prev="prev_${key}">
<button type="button" class="btn ghost sm" data-clear="${id}" data-prev="prev_${key}">إزالة الصورة</button></div></div>${
    hint ? `<em>${hint}</em>` : ''
  }</div>`;
};

async function admin() {
  const s = db.data.settings;
  const c = s.colors;
  const colorNames = [
    ['bg', 'خلفية الموقع'],
    ['surface', 'لون البطاقات'],
    ['fg', 'لون النص'],
    ['accent', 'اللون الرئيسي (الأزرار)'],
    ['gold', 'لون التمييز (النجوم والعناوين الصغيرة)'],
    ['deep', 'لون الواجهة الداكنة (الرئيسية والتذييل)'],
  ];

  const mgmtRows = await Promise.all(
    db.data.management.map(async (m) => {
      const info = await dc.memberInfo(m.userId).catch(() => null);
      const role = m.roleId ? await dc.roleInfo(m.roleId).catch(() => null) : null;
      return `<tr><td>${avatar(info && info.avatar, info ? info.name : '?', 'tav')} ${esc(info ? info.name : 'غير معروف')}</td><td dir="ltr">${esc(
        m.userId
      )}</td><td>${esc(m.title || (role && role.name) || m.roleId || '—')}</td><td><button class="btn danger sm" data-del="management/${m.id}">حذف</button></td></tr>`;
    })
  );
  const partnerRows = await Promise.all(
    db.data.partners.map(async (p) => {
      const info = await dc.inviteInfo(p.invite);
      return `<tr><td>${esc(info ? info.name : '—')}</td><td dir="ltr">${esc(p.invite)}</td><td><button class="btn danger sm" data-del="partners/${p.id}">حذف</button></td></tr>`;
    })
  );
  const acctRows = db.data.accounts
    .map(
      (a) =>
        `<tr><td>${imgUrl(a.image) ? `<img class="tav" src="${esc(a.image)}" alt="">` : ''} ${esc(a.platform)}</td><td dir="ltr">${esc(a.handle)}</td><td dir="ltr">${esc(
          a.url
        )}</td><td><button class="btn danger sm" data-del="accounts/${a.id}">حذف</button></td></tr>`
    )
    .join('');
  const revRows = db.data.reviews
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(
      (r) =>
        `<tr${r.hidden ? ' class="dim"' : ''}><td>${esc(r.username)}</td><td>${stars(r.rating)}</td><td class="wide">${esc(r.text)}</td><td>${
          r.source === 'discord' ? 'ديسكورد' : 'الموقع'
        }</td><td class="nw"><button class="btn ghost sm" data-toggle="${r.id}">${r.hidden ? 'إظهار' : 'إخفاء'}</button> <button class="btn danger sm" data-del="reviews/${
          r.id
        }">حذف</button></td></tr>`
    )
    .join('');

  const botNote = dc.botReady()
    ? '<div class="flash ok">البوت متصل بالسيرفر.</div>'
    : '<div class="flash err">البوت غير متصل. تأكد من DISCORD_BOT_TOKEN و DISCORD_GUILD_ID في ملف .env. بدونه لن تعمل الرتب وصور الإدارة والتقييمات.</div>';

  const body = `${head('لوحة التحكم', 'لوحة التحكم', 'تحكم كامل في محتوى الموقع.')}
<div class="wrap page admin">${botNote}
<nav class="anav"><a href="#general">عام</a><a href="#colors">الألوان</a><a href="#fonts">الخطوط</a><a href="#images">الصور</a><a href="#about">من نحن</a><a href="#mgmt">الإدارة</a><a href="#partners">الشركاء</a><a href="#reviews">التقييمات</a><a href="#accounts">الحسابات</a></nav>

<form class="box" id="general" data-settings><h2>الإعدادات العامة</h2>
<div class="grid2">
${field('اسم المتجر', 'siteName', s.siteName, { max: 60 })}
${field('الوصف المختصر (أعلى الرئيسية والتذييل)', 'tagline', s.tagline, { max: 120 })}
${field('عنوان الرئيسية', 'heroTitle', s.heroTitle, { max: 120 })}
${field('رابط دعوة سيرفر الديسكورد', 'discordInvite', s.discordInvite, { dir: 'ltr', hint: 'يظهر في زر الرئيسية ويُجلب منه عدد الأعضاء والمتصلين.' })}
</div>
${field('نص الرئيسية', 'heroText', s.heroText, { area: true, rows: 3, max: 400 })}
<button class="btn solid" type="submit">حفظ</button></form>

<form class="box" id="colors" data-settings><h2>الألوان الستة</h2>
<div class="colors">${colorNames
    .map(
      ([k, l]) =>
        `<label class="clr"><input type="color" name="colors.${k}" value="${esc(c[k])}"><span>${l}</span><code dir="ltr">${esc(c[k])}</code></label>`
    )
    .join('')}</div>
<button class="btn solid" type="submit">حفظ الألوان</button></form>

<form class="box" id="fonts" data-settings><h2>الخطوط</h2>
<div class="grid2">
${[['display', 'خط العناوين والأرقام الكبيرة'], ['body', 'خط النصوص العادية']]
    .map(
      ([k, l]) =>
        `<label class="fld"><span>${l}</span><select name="fonts.${k}">${FONTS.map(
          ([n]) => `<option value="${esc(n)}"${(s.fonts || {})[k] === n ? ' selected' : ''}>${esc(n)}</option>`
        ).join('')}</select></label>`
    )
    .join('')}
</div>
<p class="muted" id="fontprev" style="font-size:1.4rem;margin:14px 0 4px"><b style="font-family:var(--display)">عنوان تجريبي</b> <span>نص تجريبي بالخط المختار</span></p>
<button class="btn solid" type="submit">حفظ الخطوط</button></form>

<form class="box" id="images" data-settings><h2>الصور</h2>
<div class="grid2">
${imageField('صورة الموقع (الشعار)', 'siteImage', s.images.siteImage, 'مربعة، تظهر بجانب اسم الموقع.')}
${imageField('بنر الموقع', 'siteBanner', s.images.siteBanner, 'خلفية واجهة الرئيسية. يُفضّل عرضي وواسع.')}
${imageField('خلفية الموقع (تحت النجوم)', 'siteBg', s.images.siteBg, 'تظهر خلف كل الصفحات والنجوم فوقها. يُفضّل صورة عريضة داكنة.')}
${imageField('صورة المتجر', 'storeImage', s.images.storeImage, 'مربعة، في بطاقة المتجر بالرئيسية.')}
${imageField('بنر المتجر', 'storeBanner', s.images.storeBanner, 'عريض، أعلى بطاقة المتجر.')}
</div>
<button class="btn solid" type="submit">حفظ الصور</button></form>

<form class="box" id="about" data-settings><h2>صفحة من نحن</h2>
${field('قصة المتجر', 'story', s.story, { area: true, rows: 7, max: 3000, hint: 'افصل بين الفقرات بسطر فارغ.' })}
<div class="grid2">
${field('الرسالة', 'mission', s.mission, { area: true, rows: 3, max: 400 })}
${field('الرؤية', 'vision', s.vision, { area: true, rows: 3, max: 400 })}
${field('تاريخ التأسيس', 'founded', s.founded, { max: 40 })}
${field('المقر', 'location', s.location, { max: 80 })}
${field('السجل التجاري', 'commercialReg', s.commercialReg, { max: 40 })}
</div>
<button class="btn solid" type="submit">حفظ</button></form>

<div class="box" id="mgmt"><h2>الإدارة</h2>
<p class="muted">أضف رقم حساب العضو ورقم رتبته. يظهر اسمه وصورته من الديسكورد تلقائيًا.</p>
<form class="addrow" data-add="management">
${field('رقم حساب العضو (ID)', 'userId', '', { dir: 'ltr' })}
${field('رقم الرتبة (ID)', 'roleId', '', { dir: 'ltr', hint: 'اسم الرتبة هو الذي سيظهر.' })}
${field('مسمى مخصص (اختياري)', 'title', '', { max: 60 })}
<button class="btn solid" type="submit">إضافة</button></form>
<div class="tw"><table><thead><tr><th>العضو</th><th>ID</th><th>الرتبة</th><th></th></tr></thead><tbody>${
    mgmtRows.join('') || '<tr><td colspan="4" class="muted">لا يوجد أعضاء.</td></tr>'
  }</tbody></table></div></div>

<div class="box" id="partners"><h2>شركاء النجاح</h2>
<p class="muted">ألصق رابط دعوة السيرفر. يظهر اسمه وصورته وبنره وعدد أعضائه تلقائيًا.</p>
<form class="addrow" data-add="partners">${field('رابط دعوة السيرفر', 'invite', '', { dir: 'ltr' })}<button class="btn solid" type="submit">إضافة</button></form>
<div class="tw"><table><thead><tr><th>السيرفر</th><th>الرابط</th><th></th></tr></thead><tbody>${
    partnerRows.join('') || '<tr><td colspan="3" class="muted">لا يوجد شركاء.</td></tr>'
  }</tbody></table></div></div>

<div class="box" id="reviews"><h2>التقييمات</h2>
<form data-settings class="addrow">
${field('رقم رتبة العملاء المسموح لها بالتقييم', 'reviewRoleId', s.reviewRoleId, { dir: 'ltr', hint: 'اتركه فارغًا ليقيّم أي عضو في السيرفر.' })}
${field('رقم قناة نشر التقييمات في الديسكورد', 'reviewChannelId', s.reviewChannelId, { dir: 'ltr' })}
<button class="btn solid" type="submit">حفظ</button></form>
<div class="tw"><table><thead><tr><th>العميل</th><th>التقييم</th><th>التعليق</th><th>المصدر</th><th></th></tr></thead><tbody>${
    revRows || '<tr><td colspan="5" class="muted">لا توجد تقييمات.</td></tr>'
  }</tbody></table></div></div>

<div class="box" id="accounts"><h2>الحسابات</h2>
<form class="addrow" data-add="accounts">
${field('اسم الحساب (المنصة)', 'platform', '', { max: 40 })}
${field('المعرّف (يوزر أو رقم)', 'handle', '', { dir: 'ltr', max: 80 })}
${field('الرابط (اختياري)', 'url', '', { dir: 'ltr' })}
<div class="fld imgf"><span>صورة الحساب</span><div class="imgrow"><img id="prev_acct" class="prev" alt="" hidden><div><input type="hidden" id="acct_image" name="image" value=""><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-target="acct_image" data-prev="prev_acct"></div></div></div>
<button class="btn solid" type="submit">إضافة</button></form>
<div class="tw"><table><thead><tr><th>الحساب</th><th>المعرّف</th><th>الرابط</th><th></th></tr></thead><tbody>${
    acctRows || '<tr><td colspan="4" class="muted">لا توجد حسابات.</td></tr>'
  }</tbody></table></div></div>
</div>`;
  return { title: 'لوحة التحكم', active: '', body, scripts: `<script src="/admin.js?v=${BUILD}" defer></script>` };
}

module.exports = {
  layout,
  esc,
  safeUrl,
  imgUrl,
  pages: { home, about, management, partners, reviews, accounts, admin },
};
