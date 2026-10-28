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
