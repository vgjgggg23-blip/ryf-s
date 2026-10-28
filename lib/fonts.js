/* الخطوط المتاحة (كلها من Google Fonts وتدعم العربية).
   لإضافة خط جديد: أضف سطرًا هنا باسمه كما في Google Fonts، ثم الأوزان المتوفرة له (أو '' إذا له وزن واحد فقط). */
const FONTS = [
  ['IBM Plex Sans Arabic', '400;500;600;700'],
  ['Reem Kufi', '500;700'],
  ['Cairo', '400;500;600;700'],
  ['Tajawal', '400;500;700'],
  ['Almarai', '400;700'],
  ['Changa', '400;500;600;700'],
  ['El Messiri', '400;500;600;700'],
  ['Readex Pro', '400;500;600;700'],
  ['Noto Kufi Arabic', '400;500;600;700'],
  ['Noto Naskh Arabic', '400;500;600;700'],
  ['Vazirmatn', '400;500;600;700'],
  ['Mada', '400;500;600;700'],
  ['Lemonada', '400;500;600;700'],
  ['Baloo Bhaijaan 2', '400;500;600;700'],
  ['Amiri', '400;700'],
  ['Markazi Text', '400;500;600;700'],
  ['Aref Ruqaa', '400;700'],
  ['Lalezar', ''],
  ['Rakkas', ''],
  ['Katibeh', ''],
];
const NAMES = FONTS.map((f) => f[0]);
const isFont = (n) => NAMES.includes(n);

function fontsUrl(display, body) {
  const fam = [...new Set([display, body])]
    .filter(isFont)
    .map((n) => {
      const w = FONTS.find((f) => f[0] === n)[1];
      return 'family=' + n.replace(/ /g, '+') + (w ? ':wght@' + w : '');
    });
  return 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap';
}

module.exports = { FONTS, isFont, fontsUrl };
