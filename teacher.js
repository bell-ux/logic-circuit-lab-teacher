// 記録は、Apps Scriptがキーを確認できた後にだけ画面へ表示します。
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXBhfwTNkOTqxv7IntzelggV6Mk_sHjMIiglwIPBray8MbIJP0OjRvEFHyjTlWGj8u/exec';
const $ = id => document.getElementById(id);
const problemNames = { P1: 'AND回路', P2: '条件に合う回路', P3: 'NAND応用回路', P4: 'NAND回路' };
let answerSettings = {};
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

function requestAuth(key) {
  return new Promise((resolve, reject) => {
    const callback = 'logicAuth' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('timeout')), 10000);
    function finish(error, result) {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (error) reject(error); else resolve(result);
    }
    window[callback] = data => {
      if (!data || data.ok !== true) finish(new Error('denied'));
      else finish(null, true);
    };
    script.onerror = () => finish(new Error('network'));
    script.src = SCRIPT_URL + '?mode=auth&key=' + encodeURIComponent(key) + '&callback=' + callback;
    document.body.appendChild(script);
  });
}

function requestJsonp(parameters, prefix) {
  return new Promise((resolve, reject) => {
    const callback = prefix + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('timeout')), 10000);
    function finish(error, data) {
      clearTimeout(timer); delete window[callback]; script.remove();
      if (error) reject(error); else resolve(data);
    }
    window[callback] = data => data && data.ok === true ? finish(null, data) : finish(new Error('denied'));
    script.onerror = () => finish(new Error('network'));
    script.src = SCRIPT_URL + '?' + new URLSearchParams({...parameters, callback}).toString();
    document.body.appendChild(script);
  });
}

async function loadAnswerSettings() {
  $('answerPublicationStatus').textContent = '公開設定を読み込んでいます…';
  try {
    const data = await requestJsonp({mode:'answerSettings', key:teacherKey}, 'logicAnswerSettings');
    if (!data.publications) throw new Error('missing settings');
    answerSettings = data.publications;
    renderAnswerPublicationControls();
    $('answerPublicationStatus').textContent = '設定を読み込みました。';
  } catch (error) {
    $('answerPublicationControls').innerHTML = '<p class="empty-state">Apps Scriptが未更新か、公開設定を読み込めません。Code.gsを更新して再デプロイしてください。</p>';
    $('answerPublicationStatus').textContent = '問題の答えは変更されていません。';
  }
}

function renderAnswerPublicationControls() {
  $('answerPublicationControls').innerHTML = Object.keys(problemNames).map(id => {
    const isPublic = answerSettings[id] === true;
    const action = isPublic ? 'false' : 'true';
    const label = isPublic ? `${id.replace('P','問題')}の回答を非公開` : `${id.replace('P','問題')}の回答を公開`;
    return `<article class="consultation-item"><div class="consultation-meta"><strong>${problemNames[id]}</strong><button class="button ${isPublic?'primary':'light'}" data-publish-answer="${id}" data-visible="${action}">${label}</button><span>${isPublic?'生徒に公開中':'非公開'}</span></div></article>`;
  }).join('');
  document.querySelectorAll('[data-publish-answer]').forEach(button => button.addEventListener('click', () => {
    setAnswerPublication(button.dataset.publishAnswer, button.dataset.visible === 'true', button);
  }));
}

async function setAnswerPublication(problem, visible, button) {
  button.disabled = true;
  $('answerPublicationStatus').textContent = '公開設定を保存しています…';
  try {
    const data = await requestJsonp({mode:'setAnswerPublication', key:teacherKey, problem, visible:String(visible)}, 'logicSetAnswer');
    if (!data.publications) throw new Error('missing settings');
    answerSettings = data.publications;
    renderAnswerPublicationControls();
    $('answerPublicationStatus').textContent = visible ? '回答を公開しました。生徒はページを再読み込みして確認できます。' : '回答を非公開にしました。';
  } catch (error) {
    button.disabled = false;
    $('answerPublicationStatus').textContent = '保存できません。Apps Script の更新と再デプロイを確認してください。';
  }
}

function showDashboardLoading() {
  $('missingCount').textContent = '読み込み中…';
  $('missingNumbers').textContent = '記録を取得しています';
  $('consultCount').textContent = '読み込み中…';
  $('updatedAt').textContent = '—';
  $('problemStats').innerHTML = '<tr><td colspan="5">学習記録を読み込んでいます…</td></tr>';
  $('consultations').innerHTML = '<p class="empty-state">相談を読み込んでいます…</p>';
  $('loadStatus').textContent = '読み込み中…';
}

async function unlock(key) {
  $('loginStatus').textContent = '確認しています…';
  try {
    await requestAuth(key);
    teacherKey = key;
    records = [];
    $('loginScreen').hidden = true;
    $('teacherDashboard').hidden = false;
    showDashboardLoading();
    $('loginStatus').textContent = '';
    try {
      records = await requestRecords(teacherKey);
      renderDashboard();
      await loadAnswerSettings();
    } catch (error) {
      $('loadStatus').textContent = '認証済みですが、記録を読み込めません。更新を押してください。';
    }
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
  const successfulRuns = records.filter(r => r.type === 'run' && (r.correct === true || r.correct === 'TRUE'));
  const patterns = new Map();
  // 問題2では、1入力のNOTと2入力のANDまたはORが条件を満たします。
  const validProblem2 = [
    {g1:'NOT',g2:'AND'}, {g1:'NOT',g2:'OR'}
  ];
  validProblem2.forEach(gates => {
    const pattern = `g1：${gates.g1}、g2：${gates.g2}`;
    patterns.set(`P2|${pattern}`, {problem:'P2', pattern, students:new Set()});
  });
  successfulRuns.forEach(record => {
    let gates = record.gates || {};
    if (typeof gates === 'string') { try { gates = JSON.parse(gates); } catch { gates = {}; } }
    const pattern = Object.keys(gates).sort().map(slot => `${slot}：${gates[slot]}`).join('、') || '回路情報なし';
    const key = `${record.problem}|${pattern}`;
    if (!patterns.has(key)) patterns.set(key, {problem:record.problem, pattern, students:new Set()});
    patterns.get(key).students.add(String(record.studentId));
  });
  const answerRows = [...patterns.values()].sort((a,b) => String(a.problem).localeCompare(String(b.problem)) || a.pattern.localeCompare(b.pattern, 'ja'));
  $('answerPatterns').innerHTML = answerRows.length ? answerRows.map(item => `<article class="consultation-item"><div class="consultation-meta"><strong>${escapeHtml(problemNames[item.problem] || item.problem)}</strong><span>${escapeHtml(item.pattern)}</span><span>${item.students.size}人</span></div></article>`).join('') : '<p class="empty-state">正解回路はまだ記録されていません。</p>';
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


async function resetClassData() {
  if (!window.confirm('学習記録をすべて削除し、全問題の答えを非公開に戻します。先生用閲覧キーとシートの見出しは残ります。実行しますか？')) return;
  const button = $('resetClassData');
  button.disabled = true;
  $('loadStatus').textContent = '初期化しています…';
  try {
    const data = await requestJsonp({mode:'resetClassData', key:teacherKey}, 'logicResetClass');
    if (data.ok !== true) throw new Error('reset failed');
    records = [];
    answerSettings = data.publications || {P1:false,P2:false,P3:false,P4:false};
    renderDashboard();
    renderAnswerPublicationControls();
    $('answerPublicationStatus').textContent = '全問の答えを非公開に戻しました。';
    $('loadStatus').textContent = '授業データを初期化しました';
  } catch (error) {
    $('loadStatus').textContent = '初期化に失敗しました。Apps Scriptが最新版か確認してください。';
  } finally { button.disabled = false; }
}

async function refresh() {
  $('loadStatus').textContent = '読み込み中…';
  try { records = await requestRecords(teacherKey); renderDashboard(); await loadAnswerSettings(); }
  catch (error) { $('loadStatus').textContent = '再読み込みに失敗しました。もう一度更新してください。'; }
}
function lock() {
  teacherKey = '';
  records = [];
  answerSettings = {};
  $('answerPublicationControls').innerHTML = '<p class="empty-state">先生キーで認証すると設定できます。</p>';
  $('answerPublicationStatus').textContent = '';
  $('teacherDashboard').hidden = true;
  $('loginScreen').hidden = false;
  $('teacherKey').value = '';
  $('loginStatus').textContent = 'ロックしました。閲覧キーを入力してください。';
}

$('loginForm').addEventListener('submit', event => { event.preventDefault(); unlock($('teacherKey').value.trim()); });
$('refresh').addEventListener('click', refresh);
$('logoutButton').addEventListener('click', lock);
$('applyRange').addEventListener('click', renderDashboard);
$('resetClassData').addEventListener('click', resetClassData);

