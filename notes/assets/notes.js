/* Shared behaviour for the knowledge-point pages: theme, KaTeX, MCQ widgets.

   MCQ markup:
   <div class="mcq" data-answer="1" data-src="样卷 Q1.1">     (answer: 0-based, "0,2" = multi-select)
     <div class="mcq-q">stem</div>
     <ol class="mcq-src"><li>option</li>...</ol>
     <div class="mcq-exp">explanation</div>
   </div>
*/
(function () {
    var root = document.documentElement;
    function currentTheme() {
        try {
            var t = localStorage.getItem('quiz_theme');
            if (t === 'light' || t === 'dark') return t;
        } catch (e) { /* storage blocked */ }
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    root.setAttribute('data-theme', currentTheme());

    function renderMath(el) {
        if (window.renderMathInElement) {
            window.renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        }
    }

    var LETTERS = 'ABCDEFGH';
    var stats = { done: 0, right: 0, total: 0 };
    var scoreEl = null;

    function updateScore() {
        if (!scoreEl) return;
        scoreEl.textContent = '已做 ' + stats.done + ' / ' + stats.total + ' 题 · 全对 ' + stats.right;
    }

    function setupMcq(box) {
        var answer = (box.getAttribute('data-answer') || '0').split(',').map(function (s) { return parseInt(s, 10); });
        var multi = answer.length > 1 || box.hasAttribute('data-multi');
        var src = box.querySelector('.mcq-src');
        var exp = box.querySelector('.mcq-exp');
        var q = box.querySelector('.mcq-q');
        if (!src || !q) return;
        stats.total += 1;

        var head = document.createElement('div');
        head.className = 'mcq-head';
        var t1 = document.createElement('span');
        t1.className = 'mcq-tag' + (multi ? ' multi' : '');
        t1.textContent = multi ? '多选 · 勾错会抵消勾对' : '单选';
        head.appendChild(t1);
        if (box.getAttribute('data-src')) {
            var t2 = document.createElement('span');
            t2.className = 'mcq-tag';
            t2.textContent = box.getAttribute('data-src');
            head.appendChild(t2);
        }
        box.insertBefore(head, q);

        var opts = document.createElement('div');
        opts.className = 'mcq-opts';
        var buttons = [];
        Array.prototype.forEach.call(src.children, function (li, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcq-opt';
            b.innerHTML = '<span class="letter">' + LETTERS[i] + '</span><span class="txt"></span>';
            b.querySelector('.txt').innerHTML = li.innerHTML;
            opts.appendChild(b);
            buttons.push(b);
        });
        src.parentNode.replaceChild(opts, src);

        var actions = document.createElement('div');
        actions.className = 'mcq-actions';
        var submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'mcq-btn';
        submit.textContent = '提交';
        var result = document.createElement('span');
        result.className = 'mcq-result';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'mcq-btn ghost';
        retry.textContent = '重做';
        retry.hidden = true;
        if (multi) actions.appendChild(submit);
        actions.appendChild(result);
        actions.appendChild(retry);
        if (exp) box.insertBefore(actions, exp); else box.appendChild(actions);

        var picked = [];
        var counted = false;

        function judge() {
            var ok = picked.length === answer.length && answer.every(function (a) { return picked.indexOf(a) >= 0; });
            buttons.forEach(function (b, i) {
                b.disabled = true;
                var isAns = answer.indexOf(i) >= 0;
                var isPick = picked.indexOf(i) >= 0;
                b.classList.remove('picked');
                if (isAns && isPick) b.classList.add('right');
                else if (isPick) b.classList.add('wrong');
                else if (isAns) b.classList.add('missed');
            });
            var key = answer.map(function (a) { return LETTERS[a]; }).join('、');
            if (ok) {
                result.textContent = '✓ 正确';
                result.className = 'mcq-result ok';
            } else if (multi) {
                var good = picked.filter(function (p) { return answer.indexOf(p) >= 0; }).length;
                var bad = picked.length - good;
                result.textContent = '✗ 答案 ' + key + '（勾对 ' + good + '，勾错 ' + bad + '）';
                result.className = 'mcq-result bad';
            } else {
                result.textContent = '✗ 答案 ' + key;
                result.className = 'mcq-result bad';
            }
            submit.hidden = true;
            retry.hidden = false;
            box.classList.add('done');
            if (!counted) {
                counted = true;
                stats.done += 1;
                if (ok) stats.right += 1;
                updateScore();
            }
        }

        buttons.forEach(function (b, i) {
            b.addEventListener('click', function () {
                if (multi) {
                    var at = picked.indexOf(i);
                    if (at >= 0) { picked.splice(at, 1); b.classList.remove('picked'); }
                    else { picked.push(i); b.classList.add('picked'); }
                } else {
                    picked = [i];
                    judge();
                }
            });
        });
        submit.addEventListener('click', function () { if (picked.length) judge(); });
        retry.addEventListener('click', function () {
            picked = [];
            buttons.forEach(function (b) { b.disabled = false; b.className = 'mcq-opt'; });
            result.textContent = '';
            result.className = 'mcq-result';
            submit.hidden = false;
            retry.hidden = true;
            box.classList.remove('done');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('themeBtn');
        if (btn) {
            var sync = function () { btn.textContent = root.getAttribute('data-theme') === 'light' ? '🌙 深色' : '☀️ 浅色'; };
            sync();
            btn.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
                root.setAttribute('data-theme', next);
                try { localStorage.setItem('quiz_theme', next); } catch (e) { /* ignore */ }
                sync();
            });
        }
        Array.prototype.forEach.call(document.querySelectorAll('.mcq'), setupMcq);
        if (stats.total) {
            scoreEl = document.createElement('div');
            scoreEl.className = 'score';
            document.querySelector('.page').appendChild(scoreEl);
            updateScore();
        }
        renderMath(document.body);
    });
})();
