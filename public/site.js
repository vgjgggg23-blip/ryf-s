document.querySelectorAll('.starpick').forEach(function (p) {
  var input = document.getElementById(p.dataset.input);
  var btns = Array.prototype.slice.call(p.querySelectorAll('button'));
  function paint(v) {
    btns.forEach(function (b) { b.classList.toggle('on', +b.dataset.v <= v); });
    input.value = v;
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { paint(+b.dataset.v); }); });
  paint(+input.value || 5);
});

document.querySelectorAll('[data-copy]').forEach(function (b) {
  b.addEventListener('click', function () {
    var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = 'نسخ'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(b.dataset.copy).then(function () { done('تم النسخ'); }, function () { done('انسخ يدويًا'); });
    } else { done('انسخ يدويًا'); }
  });
});

/* ===== منع النسخ والقص والقائمة اليمنى وتحديد النص (إلا في الحقول ولوحة التحكم) ===== */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return;
  document.documentElement.classList.add('nocopy');
  function field(t) {
    return !!(t && t.closest && t.closest('input, textarea, [contenteditable="true"]'));
  }
  ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (field(e.target)) return;
      e.preventDefault();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || field(e.target)) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'c' || k === 'x' || k === 'u' || k === 's' || k === 'a') e.preventDefault();
  });
})();

/* ===== منع التكبير والتصغير ===== */
(function () {
  var opts = { passive: false };
  // ctrl + عجلة الماوس، وتكبير اللمس بإصبعين، وإيماءات سفاري
  window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, opts);
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, opts);
  });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, opts);
  // ctrl/cmd مع + و - و = و 0
  window.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var k = e.key;
    if (k === '+' || k === '-' || k === '=' || k === '_' || k === '0' || k === 'Add' || k === 'Subtract') e.preventDefault();
  }, opts);
})();
