const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  ApplicationCommandOptionType,
} = require('discord.js');
const db = require('./db');

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const TTL = 10 * 60 * 1000;
let client = null;
const cache = new Map();

async function memo(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  try {
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (e) {
    if (c) return c.v;
    throw e;
  }
}

const guild = () => (client && GUILD_ID ? client.guilds.cache.get(GUILD_ID) : null);
const botReady = () => !!guild();

/* ---------- روابط الدعوة (بيانات السيرفرات للشركاء) ---------- */
function inviteCode(s) {
  const str = String(s || '').trim();
  const m = str.match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]+)/i);
  if (m) return m[1];
  return /^[A-Za-z0-9-]{2,}$/.test(str) ? str : null;
}

async function inviteInfo(link) {
  const code = inviteCode(link);
  if (!code) return null;
  try {
    return await memo('i:' + code, TTL, async () => {
      const r = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, {
        headers: { 'User-Agent': 'StoreSite (1.0)' },
      });
      if (!r.ok) throw new Error('invite ' + r.status);
      const j = await r.json();
      const g = j.guild || {};
      const img = (kind, hash) =>
        hash
          ? `https://cdn.discordapp.com/${kind}/${g.id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=${kind === 'icons' ? 256 : 600}`
          : null;
      return {
        code,
        url: `https://discord.gg/${code}`,
        name: g.name || code,
        description: g.description || '',
        icon: img('icons', g.icon),
        banner: img('banners', g.banner) || img('splashes', g.splash),
        members: j.approximate_member_count || 0,
        online: j.approximate_presence_count || 0,
      };
    });
  } catch (e) {
    return null;
  }
}

/* ---------- أعضاء ورتب (الإدارة) ---------- */
async function memberInfo(userId) {
  return memo('m:' + userId, TTL, async () => {
    const g = guild();
    if (!g) throw new Error('bot-off');
    try {
      const m = await g.members.fetch(userId);
      return {
        id: userId,
        name: m.displayName,
        avatar: m.displayAvatarURL({ extension: 'png', size: 256 }),
      };
    } catch (e) {
      const u = await client.users.fetch(userId);
      return {
        id: userId,
        name: u.globalName || u.username,
        avatar: u.displayAvatarURL({ extension: 'png', size: 256 }),
      };
    }
  });
}

async function roleInfo(roleId) {
  const g = guild();
  if (!g || !roleId) return null;
  const r = g.roles.cache.get(roleId) || (await g.roles.fetch(roleId).catch(() => null));
  if (!r) return null;
  return { id: r.id, name: r.name, color: r.color ? r.hexColor : null };
}

/* ---------- التقييمات ---------- */
async function checkReviewer(userId) {
  const g = guild();
  if (!g) return { ok: false, code: 'bot' };
  let m;
  try {
    m = await g.members.fetch(userId);
  } catch (e) {
    return { ok: false, code: 'notmember' };
  }
  const rid = db.data.settings.reviewRoleId;
  if (rid && !m.roles.cache.has(rid)) return { ok: false, code: 'norole' };
  const role = rid ? g.roles.cache.get(rid) : m.roles.highest;
  return {
    ok: true,
    name: m.displayName,
    avatar: m.displayAvatarURL({ extension: 'png', size: 128 }),
    roleName: role && role.id !== g.id ? role.name : '',
  };
}

async function announce(r) {
  const g = guild();
  const cid = db.data.settings.reviewChannelId;
  if (!g || !cid) return;
  try {
    const ch = await g.channels.fetch(cid);
    if (!ch || !ch.isTextBased()) return;
    const e = new EmbedBuilder()
      .setColor(0xf3b94a)
      .setAuthor({ name: r.username, iconURL: r.avatar || undefined })
      .setTitle('★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))
      .setDescription(r.text)
      .setFooter({ text: r.source === 'site' ? 'تقييم من الموقع' : 'تقييم من الديسكورد' })
      .setTimestamp(new Date(r.createdAt));
    if (r.roleName) e.addFields({ name: 'الرتبة', value: r.roleName, inline: true });
    await ch.send({ embeds: [e] });
  } catch (err) {
    console.error('تعذر إرسال التقييم إلى الديسكورد:', err.message);
  }
}

async function submitReview({ userId, rating, text, source, fallbackName, fallbackAvatar }) {
  rating = Math.round(Number(rating));
  text = String(text || '').trim();
  if (!(rating >= 1 && rating <= 5)) return { ok: false, code: 'rating' };
  if (text.length < 5 || text.length > 500) return { ok: false, code: 'text' };
  const day = 24 * 60 * 60 * 1000;
  if (db.data.reviews.some((r) => r.userId === userId && Date.now() - new Date(r.createdAt) < day)) {
    return { ok: false, code: 'again' };
  }
  const chk = await checkReviewer(userId);
  if (!chk.ok) return chk;
  const review = {
    id: db.id(),
    userId,
    username: chk.name || fallbackName || 'عميل',
    avatar: chk.avatar || fallbackAvatar || '',
    rating,
    text,
    roleName: chk.roleName,
    source,
    createdAt: new Date().toISOString(),
    hidden: false,
  };
  db.data.reviews.push(review);
  db.save();
  announce(review);
  return { ok: true, review };
}

async function onInteraction(i) {
  if (!i.isChatInputCommand() || i.commandName !== 'review') return;
  await i.deferReply({ ephemeral: true });
  const res = await submitReview({
    userId: i.user.id,
    rating: i.options.getInteger('rating'),
    text: i.options.getString('comment'),
    source: 'discord',
    fallbackName: i.user.globalName || i.user.username,
    fallbackAvatar: i.user.displayAvatarURL({ extension: 'png', size: 128 }),
  });
  const msg = {
    again: 'يمكنك إضافة تقييم واحد كل 24 ساعة.',
    norole: 'هذا التقييم متاح لأصحاب رتبة العملاء فقط.',
    notmember: 'يجب أن تكون عضوًا في السيرفر.',
    bot: 'التقييم غير متاح حاليًا.',
    text: 'اكتب تعليقًا من 5 إلى 500 حرف.',
    rating: 'اختر تقييمًا من 1 إلى 5.',
  };
  await i.editReply(res.ok ? 'شكرًا لك، تم نشر تقييمك في الموقع.' : msg[res.code] || 'تعذر حفظ التقييم.');
}

/* ---------- تشغيل البوت ---------- */
async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !GUILD_ID) {
    console.log('تنبيه: البوت غير مفعّل (DISCORD_BOT_TOKEN أو DISCORD_GUILD_ID ناقص). الموقع سيعمل بدون ربط الرتب.');
    return;
  }
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.once(Events.ClientReady, async () => {
    console.log('البوت جاهز:', client.user.tag);
    try {
      const g = await client.guilds.fetch(GUILD_ID);
      await g.roles.fetch();
      await g.commands.create({
        name: 'review',
        description: 'قيّم المتجر',
        options: [
          {
            name: 'rating',
            description: 'التقييم من 1 إلى 5',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 5,
          },
          {
            name: 'comment',
            description: 'تعليقك',
            type: ApplicationCommandOptionType.String,
            required: true,
            max_length: 500,
          },
        ],
      });
    } catch (e) {
      console.error('تعذر تجهيز السيرفر:', e.message);
    }
  });
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((e) => console.error(e.message)));
  client.on('error', (e) => console.error('Discord:', e.message));
  await client.login(token).catch((e) => {
    client = null;
    console.error('فشل تسجيل دخول البوت:', e.message);
  });
}

module.exports = {
  start,
  botReady,
  inviteCode,
  inviteInfo,
  memberInfo,
  roleInfo,
  checkReviewer,
  submitReview,
};
