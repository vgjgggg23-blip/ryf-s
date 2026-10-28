const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const FILE = path.join(DIR, 'db.json');
const UPLOADS = path.join(DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const defaults = () => ({
  settings: {
    siteName: 'Zeus $tore',
    tagline: 'متجر ديسكورد · كل ما تحتاجه في مكان واحد',
    heroTitle: 'كل ما تحتاجه في مكان واحد',
    heroText: 'خدمة سريعة، منتجات موثوقة، وأسعار مناسبة. نحن هنا لنجعل تجربة تسوقك بسيطة وسهلة وموثوقة.',
    discordInvite: 'https://discord.gg/RYF',
    story: 'اكتب هنا قصة المتجر.\n\nافصل بين الفقرات بسطر فارغ.',
    mission: '',
    vision: '',
    founded: 'يونيو 2026',
    location: '',
    commercialReg: '',
    reviewRoleId: '',
    reviewChannelId: '',
    colors: {
      bg: '#05010f',
      surface: '#0f0724',
      fg: '#f3eeff',
      accent: '#a35cff',
      gold: '#2ff3ff',
      deep: '#030008',
    },
    images: { siteImage: '', siteBanner: '', siteBg: '', storeImage: '', storeBanner: '' },
    fonts: { display: 'Reem Kufi', body: 'IBM Plex Sans Arabic' },
  },
  management: [],
  partners: [],
  accounts: [],
  reviews: [],
});

function load() {
  const d = defaults();
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const js = j.settings || {};
    d.settings = {
      ...d.settings,
      ...js,
      colors: { ...d.settings.colors, ...(js.colors || {}) },
      images: { ...d.settings.images, ...(js.images || {}) },
      fonts: { ...d.settings.fonts, ...(js.fonts || {}) },
    };
    for (const k of ['management', 'partners', 'accounts', 'reviews']) {
      if (Array.isArray(j[k])) d[k] = j[k];
    }
  } catch (e) {
    /* أول تشغيل: نستخدم القيم الافتراضية */
  }
  return d;
}

const db = {
  data: load(),
  dir: DIR,
  uploads: UPLOADS,
  id: () => crypto.randomUUID(),
  save() {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, FILE);
  },
};

if (!fs.existsSync(FILE)) db.save();

module.exports = db;
