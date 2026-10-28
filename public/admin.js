(function () {
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  async function api(url, method, body) {
    var r = await fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'فشل الطلب');
    return j;
  }

  function setPath(o, p, v) {
    var k = p.split('.');
    var c = o;
    for (var i = 0; i < k.length - 1; i++) c = c[k[i]] = c[k[i]] || {};
    c[k[k.length - 1]] = v;
  }

  function formData(f) {
    var o = {};
    new FormData(f).forEach(function (v, k) { if (typeof v === 'string') setPath(o, k, v); });
    return o;
  }

  document.querySelectorAll('form[data-settings]').forEach(function (f) {
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api('/admin/api/settings', 'POST', formData(f));
        toast('تم الحفظ');
        if (f.id === 'colors' || f.id === 'general' || f.id === 'images') setTimeout(function () { location.reload(); }, 600);
      } catch (err) { toast(err.message, true); }
    });
  });

  document.querySelectorAll('form[data-add]').forEach(function (f) {
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api('/admin/api/' + f.dataset.add, 'POST', formData(f));
        toast('تمت الإضافة');
        setTimeout(function () { location.reload(); }, 500);
      } catch (err) { toast(err.message, true); }
    });
  });

  document.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', async function () {
      if (!confirm('هل أنت متأكد من الحذف؟')) return;
      try {
        await api('/admin/api/' + b.dataset.del, 'DELETE');
        location.reload();
      } catch (err) { toast(err.message, true); }
    });
  });

  document.querySelectorAll('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', async function () {
      try {
        await api('/admin/api/reviews/' + b.dataset.toggle + '/toggle', 'POST', {});
        location.reload();
      } catch (err) { toast(err.message, true); }
    });
  });

  document.querySelectorAll('input[type=file][data-target]').forEach(function (inp) {
    inp.addEventListener('change', async function () {
      var file = inp.files[0];
      if (!file) return;
      var fd = new FormData();
      fd.append('file', file);
      try {
        var r = await fetch('/admin/api/upload', { method: 'POST', body: fd });
        var j = await r.json();
        if (!r.ok) throw new Error(j.error || 'تعذر رفع الصورة');
        document.getElementById(inp.dataset.target).value = j.url;
        var p = document.getElementById(inp.dataset.prev);
        if (p) { p.src = j.url; p.hidden = false; }
        toast('تم رفع الصورة، اضغط حفظ');
      } catch (err) { toast(err.message, true); }
    });
  });

  document.querySelectorAll('[data-clear]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.getElementById(b.dataset.clear).value = '';
      var p = document.getElementById(b.dataset.prev);
      if (p) p.hidden = true;
      toast('اضغط حفظ لتأكيد الإزالة');
    });
  });
})();
