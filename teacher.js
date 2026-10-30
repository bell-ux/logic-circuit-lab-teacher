// 記録は、Apps Scriptがキーを確認できた後にだけ画面へ表示します。
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXBhfwTNkOTqxv7IntzelggV6Mk_sHjMIiglwIPBray8MbIJP0OjRvEFHyjTlWGj8u/exec';
const $ = id => document.getElementById(id);
const problemNames = { P1: 'AND回路', P2: 'NOT＋OR回路', P3: '4つのゲート', P4: 'NAND回路' };
let records = [];
let teacherKey = '';

function requestRecords(key) {
  return new Promise((resolve, reject) => {
    const callback = 'logicTeacher' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('timeout')), 15000);
    function finish(error, result) {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (error) reject(error); else resolve(result);
    }
    window[callback] = data => {
      if (!data || data.ok !== true || !Array.isArray(data.records)) finish(new Error('denied'));
      else finish(null, data.records);
    };
    script.onerror = () => finish(new Error('network'));
    script.src = SCRIPT_URL + '?key=' + encodeURIComponent(key) + '&callback=' + callback;
    document.body.appendChild(script);
  });
}

async function unlock(key) {
  $('loginStatus').textContent = '確認しています…';
  try {
    const data = await requestRecords(key);
    teacherKey = key;
    records = data;
    $('loginScreen').hidden = true;
    $('teacherDashboard').hidden = false;
    renderDashboard();
    $('loginStatus').textContent = '';
  } catch (error) {
    teacherKey = '';
    records = [];
    $('loginStatus').textContent = '認証できませんでした。キーとApps Scriptの公開設定を確認してください。';
  }
}

function renderDashboard() {
  const start = Number($('numberStart').value) || 1;
  const end = Number($('numberEnd').value) || 40;
  const completed = new Set(records.filter(r => r.type === 'run').map(r => Number(r.studentId)).filter(Number.isFinite));
  const missing = [];
  for (let n = start; n <= end; n++) if (!completed.has(n)) missing.push(n);
  $('missingCount').textContent = missing.length + ' 人';
  $('missingNumbers').textContent = missing.length ? '番号：' + missing.join('、') : '全員が演習を実施しています';

  const consultationRows = records.filter(r => r.type === 'consult').sort((a,b) => String(b.time).localeCompare(String(a.time)));
  $('consultCount').textContent = consultationRows.length + ' 件';
  $('consultations').innerHTML = consultationRows.length ? consultationRows.map(r =>
    `<article class="consultation-item"><div class="consultation-meta"><strong>出席番号 ${escapeHtml(r.studentId)}</strong><time>${escapeHtml(formatTime(r.time))}</time><span>${escapeHtml(problemNames[r.problem] || r.problem || '')}</span></div><p>${escapeHtml(r.message || '（相談文なし）')}</p></article>`
  ).join('') : '<p class="empty-state">まだ相談は届いていません。</p>';

  $('problemStats').innerHTML = Object.keys(problemNames).map(id => {
    const runs = records.filter(r => r.type === 'run' && r.problem === id);
    const attempted = new Set(runs.map(r => String(Number(r.studentId))));
    const solved = new Set(runs.filter(r => r.correct === true || r.correct === 'TRUE').map(r => String(Number(r.studentId))));
    const hintUsers = new Set(records.filter(r => r.type === 'hint' && r.problem === id).map(r => String(Number(r.studentId))));
    const rate = attempted.size ? Math.round(solved.size * 100 / attempted.size) : 0;
    return `<tr><th>${problemNames[id]}</th><td>${attempted.size}人</td><td>${solved.size}人</td><td><div class="rate-cell"><strong>${attempted.size ? rate + '%' : '—'}</strong><span class="rate-track"><i style="width:${rate}%"></i></span></div></td><td>${hintUsers.size}人</td></tr>`;
  }).join('');
  $('updatedAt').textContent = new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
  $('loadStatus').textContent = records.length + '件の記録を集計';
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP');
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function refresh() {
  $('loadStatus').textContent = '読み込み中…';
  try { records = await requestRecords(teacherKey); renderDashboard(); }
  catch (error) { $('loadStatus').textContent = '再読み込みに失敗しました。認証し直してください。'; lock(); }
}
function lock() {
  teacherKey = '';
  records = [];
  $('teacherDashboard').hidden = true;
  $('loginScreen').hidden = false;
  $('teacherKey').value = '';
  $('loginStatus').textContent = 'ロックしました。閲覧キーを入力してください。';
}

$('loginForm').addEventListener('submit', event => { event.preventDefault(); unlock($('teacherKey').value.trim()); });
$('refresh').addEventListener('click', refresh);
$('logoutButton').addEventListener('click', lock);
$('applyRange').addEventListener('click', renderDashboard);

