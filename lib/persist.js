/*
 * حفظ دائم اختياري في MongoDB (مثل Atlas المجاني).
 * بدون MONGODB_URI يعمل الموقع على ملفات المجلد المحلي فقط (ولا يصلح لقرص Render المؤقت).
 * مع MONGODB_URI: كل تعديل يُحفظ في القاعدة، وتُستعاد البيانات والصور عند كل تشغيل.
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');

const URI = process.env.MONGODB_URI;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const SAFE_NAME = /^[\w.-]+$/;

let state = null;
let files = null;
let client = null;
let timer = null;
let pending = false;
let flushing = Promise.resolve();

const enabled = () => !!state;

async function init() {
  if (!URI) {
    console.log('تنبيه: MONGODB_URI غير مضبوط. البيانات تُحفظ على قرص الخادم فقط وقد تُمسح عند إعادة التشغيل في Render.');
    return;
  }
  const { MongoClient } = require('mongodb');
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const d = client.db(process.env.MONGODB_DB || 'storesite');
  state = d.collection('state');
  files = d.collection('files');

  // 1) استعادة الإعدادات والقوائم
  const doc = await state.findOne({ _id: 'main' });
  if (doc && doc.data) {
    db.replace(doc.data);
    console.log('تمت استعادة البيانات من قاعدة البيانات.');
  } else {
    await state.replaceOne({ _id: 'main' }, { _id: 'main', data: db.data, updatedAt: new Date() }, { upsert: true });
    console.log('تم إنشاء النسخة الأولى في قاعدة البيانات.');
  }

  // 2) استعادة الصور إلى المجلد المحلي
  let n = 0;
  for await (const f of files.find({})) {
    if (!SAFE_NAME.test(f._id)) continue;
    const buf = Buffer.from(f.data.buffer || f.data);
    fs.writeFileSync(path.join(db.uploads, f._id), buf);
    n++;
  }
  if (n) console.log(`تمت استعادة ${n} صورة.`);

  // 3) من الآن كل حفظ يذهب إلى القاعدة (بعد تهدئة قصيرة لدمج الحفظات المتتالية)
  db.onSave = () => {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  };
}

function flush() {
  if (!state || !pending) return flushing;
  pending = false;
  const snapshot = JSON.parse(JSON.stringify(db.data));
  flushing = flushing
    .then(() => state.replaceOne({ _id: 'main' }, { _id: 'main', data: snapshot, updatedAt: new Date() }, { upsert: true }))
    .catch((e) => {
      console.error('تعذر حفظ البيانات في قاعدة البيانات:', e.message);
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 5000);
    });
  return flushing;
}

async function saveFile(name) {
  if (!files || !SAFE_NAME.test(name)) return;
  const data = fs.readFileSync(path.join(db.uploads, name));
  await files.replaceOne(
    { _id: name },
    { _id: name, type: MIME[path.extname(name)] || 'application/octet-stream', data, createdAt: new Date() },
    { upsert: true }
  );
}

async function close() {
  if (!client) return;
  clearTimeout(timer);
  pending = true;
  await flush();
  await client.close().catch(() => {});
}

module.exports = { init, enabled, saveFile, flush, close };
