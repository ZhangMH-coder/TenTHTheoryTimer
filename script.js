// 常量定义
const TEN_THOUSAND_HOURS_IN_SECONDS = 10000 * 60 * 60; // 10000 小时对应的秒数

// 应用状态
const state = {
  totalSeconds: 0, // 累计秒数
  running: false, // 是否在计时
  sessionStart: null, // 会话开始时间戳(ms)
  backgroundDataUrl: null, // 背景图的 DataURL
  meteorEnabled: false, // 是否开启流星(流星)特效
  animationPaused: false, // 是否处于暂停状态
  overlayAlpha: 0.35, // 背景遮罩强度(0~1)
  // 新增：按技术分别累计(Map by tech)
  techTotals: {}, // 各技术累计秒数(Total seconds per tech)
  currentTech: '通用', // 当前选择的技术(Current selected tech)
  sessionTech: null, // 当前会话绑定的技术(Bound tech for current session)
  bgFit: 'cover', // 可选: cover(覆盖)/contain(包含)/stretch(拉伸)
  bgAttachment: 'fixed', // 可选: fixed(固定)/scroll(跟随滚动)
};

// DOM 引用
const dom = {
  totalTime: document.getElementById('total-time'),
  sessionTime: document.getElementById('session-time'),
  progressBar: document.getElementById('progress-bar'),
  progressPercent: document.getElementById('progress-percent'),
  startBtn: document.getElementById('start-btn'),
  pauseBtn: document.getElementById('pause-btn'),
  resetBtn: document.getElementById('reset-btn'),
  quickAddButtons: document.querySelectorAll('[data-add-min]'),
  bgFile: document.getElementById('bg-file'),
  clearBg: document.getElementById('clear-bg'),
  toggleMeteor: document.getElementById('toggle-meteor'),
  exportBtn: document.getElementById('export-btn'),
  importFile: document.getElementById('import-file'),
  meteorLayer: document.getElementById('meteor-layer'),
  toggleMeteorPauseBtn: document.getElementById('toggle-meteor-pause'),
  overlayStrength: document.getElementById('overlay-strength'), // 背景遮罩强度滑杆(Overlay strength slider)
  // 新增：技术相关 DOM(Tech-related DOM)
  techSelect: document.getElementById('tech-select'),
  techInput: document.getElementById('tech-input'),
  techAddBtn: document.getElementById('tech-add'),
  techList: document.getElementById('tech-list'),
  bgFitSelect: document.getElementById('bg-fit'),
  bgAttachmentSelect: document.getElementById('bg-attachment'),
};

// 计时器刷新间隔(ms)
let uiTimer = null;

// 流星(流星)相关：画布上下文与数据
let meteorCtx = null;
let meteors = []; // 流星对象数组
let lastFrameTime = 0; // 动画上一帧时间戳
let meteorFrameId = null; // requestAnimationFrame id

// ===================== 业务逻辑函数 =====================

/**
 * 格式化秒数为 HH:MM:SS (Format seconds to HH:MM:SS)
 * @param {number} seconds - 秒数(Seconds)
 * @returns {string} 格式化后的时间字符串(Formatted string)
 */
function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * 更新界面显示(Update UI)
 * - 显示当前选中技术的累计时长与进度(Show total for selected tech)
 * - 显示当前会话时长(Show current session duration)
 * - 渲染各技术累计列表(Render totals list)
 */
function updateUI() {
  // 计算当前会话增加的秒数(Calculate session seconds)
  let sessionSeconds = 0;
  if (state.running && state.sessionStart) {
    const now = Date.now();
    sessionSeconds = Math.floor((now - state.sessionStart) / 1000);
  }

  // 当前技术累计(含会话增量仅在绑定技术与当前技术一致时)(Current tech total with session increment when bound tech matches)
  const base = (state.techTotals?.[state.currentTech] || 0);
  const effectiveSession = (state.running && state.sessionTech === state.currentTech) ? sessionSeconds : 0;
  const currentTotal = base + effectiveSession;

  dom.totalTime.textContent = formatHMS(currentTotal);
  dom.sessionTime.textContent = formatHMS(sessionSeconds);

  const percent = Math.min(100, (currentTotal / TEN_THOUSAND_HOURS_IN_SECONDS) * 100);
  dom.progressBar.style.width = `${percent}%`;
  dom.progressPercent.textContent = (percent).toFixed(2);

  // 渲染各技术累计列表(Render list)
  renderTechList();
}

/**
 * 开始会话计时(Start session)
 * - 记录开始时间戳(Bind start timestamp)
 * - 绑定当前选择的技术(Bind current tech)
 * - 启动 UI 刷新定时器(Start UI timer)
 */
function startSession() {
  if (state.running) return;
  state.running = true;
  state.sessionStart = Date.now();
  state.sessionTech = state.currentTech;

  // 每 250ms 刷新一次界面(Refresh UI every 250ms)
  if (!uiTimer) {
    uiTimer = setInterval(updateUI, 250);
  }
  saveState();
}

/**
 * 暂停会话计时(Stop/pause session)
 * - 将当前会话的增量累加到“会话绑定技术”的累计秒数(Add increment to bound tech)
 * - 停止会话(Stop session)
 */
function stopSession() {
  if (!state.running) return;
  const now = Date.now();
  const increment = Math.floor((now - state.sessionStart) / 1000);
  const tech = state.sessionTech || state.currentTech;
  if (!state.techTotals[tech]) state.techTotals[tech] = 0;
  state.techTotals[tech] += Math.max(0, increment);
  // 同步旧字段为总和(Keep legacy total as sum)
  state.totalSeconds = Object.values(state.techTotals).reduce((a, b) => a + b, 0);
  state.running = false;
  state.sessionStart = null;
  state.sessionTech = null;
  updateUI();
  saveState();
}

/**
 * 复位所有数据(Reset all data)
 * - 清除所有技术累计与会话(Clear totals and session)
 * - 保留背景与特效开关(Keep background & effects)
 */
function resetAll() {
  const ok = confirm('确认复位所有计时数据？此操作不可撤回(Confirm reset all?)');
  if (!ok) return;
  state.techTotals = { '通用': 0 };
  state.currentTech = '通用';
  state.totalSeconds = 0;
  state.running = false;
  state.sessionStart = null;
  state.sessionTech = null;
  updateUI();
  saveState();
}

/**
 * 快捷添加分钟到“当前技术”累计时长(Quick add minutes to current tech)
 * @param {number} minutes - 要添加的分钟数(Minutes to add)
 */
function addMinutes(minutes) {
  const secs = Math.max(0, Math.floor(minutes * 60));
  const tech = state.currentTech;
  if (!state.techTotals[tech]) state.techTotals[tech] = 0;
  state.techTotals[tech] += secs;
  // 同步旧字段(Legacy total)
  state.totalSeconds = Object.values(state.techTotals).reduce((a, b) => a + b, 0);
  updateUI();
  saveState();
}

/**
 * 保存状态到本地存储(localStorage)(Save state to localStorage)
 */
function saveState() {
  // 计算总和以兼容旧字段(Calc sum for legacy field)
  const legacyTotal = Object.values(state.techTotals || {}).reduce((a, b) => a + b, 0);
  const payload = {
    totalSeconds: legacyTotal, // 兼容旧版本(Legacy)
    running: state.running,
    sessionStart: state.sessionStart,
    backgroundDataUrl: state.backgroundDataUrl,
    meteorEnabled: state.meteorEnabled,
    animationPaused: state.animationPaused, // 保存流星暂停状态(Save meteor paused)
    overlayAlpha: state.overlayAlpha, // 保存遮罩强度(Save overlay strength)
    // 新增：技术相关(Tech fields)
    techTotals: state.techTotals,
    currentTech: state.currentTech,
    sessionTech: state.sessionTech,
  };
  localStorage.setItem('tenk_timer_state', JSON.stringify(payload));
}

/**
 * 从本地存储加载状态(Load state from localStorage)
 * - 若在计时中，保持会话开始时间不变，继续刷新(Keep session)
 */
function loadState() {
  try {
    const raw = localStorage.getItem('tenk_timer_state');
    if (!raw) {
      // 无历史数据时，应用默认遮罩强度(Apply default overlay)
      applyOverlayAlphaToDOM(state.overlayAlpha);
      if (dom.overlayStrength) dom.overlayStrength.value = String(state.overlayAlpha);
      // 初始化默认技术(Init default tech)
      state.techTotals = { '通用': 0 };
      state.currentTech = '通用';
      return;
    }
    const payload = JSON.parse(raw);
    // 加载技术字段(Load tech fields)
    if (payload.techTotals && typeof payload.techTotals === 'object') {
      state.techTotals = payload.techTotals;
    } else {
      state.techTotals = { '通用': (payload.totalSeconds || 0) };
    }
    state.currentTech = payload.currentTech || Object.keys(state.techTotals)[0] || '通用';
    state.sessionTech = payload.sessionTech || null;

    // 同步非技术字段(Other fields)
    state.running = !!payload.running;
    state.sessionStart = payload.sessionStart || null;
    state.backgroundDataUrl = payload.backgroundDataUrl || null;
    state.meteorEnabled = !!payload.meteorEnabled;
    state.animationPaused = !!payload.animationPaused;
    state.overlayAlpha = (typeof payload.overlayAlpha === 'number') ? payload.overlayAlpha : state.overlayAlpha;

    // 应用背景(Apply background)
    if (state.backgroundDataUrl) {
      setBackgroundImage(state.backgroundDataUrl);
    }
    // 应用遮罩强度(Apply overlay)
    applyOverlayAlphaToDOM(state.overlayAlpha);
    if (dom.overlayStrength) dom.overlayStrength.value = String(state.overlayAlpha);

    // 应用流星开关(Apply meteors)
    dom.toggleMeteor.checked = state.meteorEnabled;
    setupMeteor(state.meteorEnabled);

    // 若启用了特效，应用暂停/继续的播放状态与按钮文案(Update meteor play state)
    if (state.meteorEnabled && dom.toggleMeteorPauseBtn) {
      setMeteorPlayState(state.animationPaused);
      dom.toggleMeteorPauseBtn.textContent = state.animationPaused ? '继续流星(Resume meteors)' : '暂停流星(Pause meteors)';
      dom.toggleMeteorPauseBtn.disabled = !state.meteorEnabled;
    }
  } catch (e) {
    console.error('加载状态失败(Load state failed)', e);
  }
}

/**
 * 设置背景图(Set background image)
 * @param {string} dataUrl - 图片的 DataURL(Image DataURL)
 */
function setBackgroundImage(dataUrl) {
  const imgUrl = `url(${dataUrl})`;
  // 采用两层背景：图片 + 渐变(Image + gradient)
  document.body.style.backgroundImage = `${imgUrl}, linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0b1020 100%)`;
  // 保证不重复且固定，避免滚动出现“多张”(no-repeat & fixed to avoid duplicate on scroll)
  document.body.style.backgroundRepeat = 'no-repeat, no-repeat';
  document.body.style.backgroundAttachment = 'fixed, fixed';
  document.body.style.backgroundSize = 'cover, auto';
  document.body.style.backgroundPosition = 'center, center';
}

/**
 * 处理用户上传的背景图文件(Handle background upload)
 * @param {File} file - 图片文件(Image file)
 */
function handleBackgroundUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    state.backgroundDataUrl = dataUrl;
    setBackgroundImage(dataUrl);
    saveState();
  };
  reader.readAsDataURL(file);
}

function clearBackground() {
  // 清除所有内联背景相关样式，恢复CSS默认渐变(Clear inline background styles and restore CSS default gradient)
  state.backgroundDataUrl = null; // 同步清空状态(Sync state to null)
  document.body.style.backgroundImage = '';
  document.body.style.backgroundRepeat = '';
  document.body.style.backgroundAttachment = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundPosition = '';
  saveState();
}

/**
 * 导出数据为 JSON(Export data JSON)
 */
function exportData() {
  const payload = {
    // 导出技术累计(Export tech totals)
    techTotals: state.techTotals,
    currentTech: state.currentTech,
    // 会话相关(Session fields)
    running: state.running,
    sessionStart: state.sessionStart,
    sessionTech: state.sessionTech,
    // 视觉相关(Visual fields)
    backgroundDataUrl: state.backgroundDataUrl,
    meteorEnabled: state.meteorEnabled,
    animationPaused: state.animationPaused,
    overlayAlpha: state.overlayAlpha,
    // 兼容旧字段(Legacy)
    totalSeconds: Object.values(state.techTotals || {}).reduce((a, b) => a + b, 0),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tenk-timer-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导入 JSON 数据文件(Import JSON data)
 * @param {File} file - JSON 文件(JSON file)
 */
function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      // 技术累计(Tech totals)
      if (data.techTotals && typeof data.techTotals === 'object') {
        state.techTotals = data.techTotals;
      } else {
        state.techTotals = { '通用': Number(data.totalSeconds) || 0 };
      }
      state.currentTech = data.currentTech || Object.keys(state.techTotals)[0] || '通用';
      // 会话相关(Session)
      state.running = !!data.running;
      state.sessionStart = data.sessionStart || null;
      state.sessionTech = data.sessionTech || null;
      // 视觉相关(Visual)
      state.backgroundDataUrl = data.backgroundDataUrl || null;
      state.meteorEnabled = !!data.meteorEnabled;
      state.animationPaused = !!data.animationPaused;
      state.overlayAlpha = (typeof data.overlayAlpha === 'number') ? data.overlayAlpha : state.overlayAlpha;

      if (state.backgroundDataUrl) setBackgroundImage(state.backgroundDataUrl);
      dom.toggleMeteor.checked = state.meteorEnabled;
      setupMeteor(state.meteorEnabled);

      renderTechOptions();
      renderTechList();
      updateUI();
      saveState();
      alert('导入成功(Import succeeded)');
    } catch (e) {
      alert('导入失败：文件格式错误(Import failed: invalid format)');
    }
  };
  reader.readAsText(file);
}

// ===================== 流星(流星)特效：DOM 版本（替换自“慢速流星”）(Meteor effects: DOM version) =====================

// DOM 流星相关状态
let meteorStyleEl = null; // 动态样式(style)节点(Dynamic style element)
let meteorTimers = []; // 记录已设定的定时器(Timers)
let starsCreated = false; // 是否已创建背景星星(Stars created)

/**
 * 确保创建用于插入关键帧的 <style> 标签(Ensure style element)
 * @returns {HTMLStyleElement} 样式节点(Style element)
 */
function ensureMeteorStyleEl() {
  if (!meteorStyleEl) {
    meteorStyleEl = document.getElementById('meteor-style');
    if (!meteorStyleEl) {
      meteorStyleEl = document.createElement('style');
      meteorStyleEl.id = 'meteor-style';
      document.head.appendChild(meteorStyleEl);
    }
  }
  return meteorStyleEl;
}

/**
 * 初始化流星层容器(Init meteor layer)
 * - 设置为fixed全屏覆盖、pointer-events:none (fixed full screen, pointer-events:none)
 */
function initMeteorLayer() {
  if (!dom.meteorLayer) {
    dom.meteorLayer = document.getElementById('meteor-layer');
  }
}

/**
 * 创建背景星星(Create stars)
 * @param {number} count - 星星数量(Star count)
 */
function createStars(count = 150) {
  if (starsCreated) return; // 避免重复创建(Avoid duplicate)
  initMeteorLayer();
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = Math.random() * 2 + 0.5;
    star.style.left = `${x}vw`;
    star.style.top = `${y}vh`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDelay = `${Math.random() * 4}s`;
    dom.meteorLayer.appendChild(star);
  }
  starsCreated = true;
}

/**
 * 创建一颗慢速流星(DOM 元素)(Create a slow meteor DOM)
 */
function createMeteorDOM() {
  initMeteorLayer();
  const meteor = document.createElement('div');
  meteor.className = 'meteor';

  // 随机位置与尺寸(Random position & size)
  const startX = Math.random() * 100;
  const startY = Math.random() * 30;
  const width = Math.random() * 2 + 1;
  const height = Math.random() * 80 + 50;
  const rotation = Math.random() * 60 - 30;
  const duration = Math.random() * 15 + 10; // 10-25 秒(10-25s)

  meteor.style.left = `${startX}vw`;
  meteor.style.top = `${startY}vh`;
  meteor.style.width = `${width}px`;
  meteor.style.height = `${height}px`;
  meteor.style.transform = `rotate(${rotation}deg)`;
  meteor.style.animationDuration = `${duration}s`;

  dom.meteorLayer.appendChild(meteor);
}

/**
 * 清理流星层(Clear meteor layer)
 */
function clearMeteorLayer() {
  if (!dom.meteorLayer) return;
  dom.meteorLayer.innerHTML = '';
}

/**
 * 取消后续计划生成的流星(Cancel scheduled meteors)
 */
function cancelScheduledMeteors() {
  meteorTimers.forEach(t => clearTimeout(t));
  meteorTimers = [];
}

/**
 * 设置流星特效开关(Set up meteor effect)
 * @param {boolean} enabled - 是否开启(Enabled)
 */
function setupMeteor(enabled) {
  if (enabled) {
    ensureMeteorStyleEl();
    initMeteorLayer();
    createStars(150);
    // 预生成几颗流星(Pre-generate some meteors)
    for (let i = 0; i < 3; i++) {
      const t = setTimeout(() => createMeteorDOM(), i * 3000);
      meteorTimers.push(t);
    }
  } else {
    cancelScheduledMeteors();
    clearMeteorLayer();
    state.animationPaused = false; // 关闭时复位暂停状态(Reset paused state)
    if (dom.toggleMeteorPauseBtn) {
      dom.toggleMeteorPauseBtn.textContent = '暂停流星(Pause meteors)';
      dom.toggleMeteorPauseBtn.disabled = true;
    }
  }
}

// ===================== 技术选择与管理(Tech selection & management) =====================

/**
 * 初始化技术选择 UI(Init tech UI)
 */
function initTechUI() {
  // 确保至少有一个技术(Ensure at least one tech)
  if (!state.techTotals || Object.keys(state.techTotals).length === 0) {
    state.techTotals = { '通用': state.totalSeconds || 0 };
    state.currentTech = '通用';
  }
  renderTechOptions();
  renderTechList();
}

/**
 * 渲染技术下拉选项(Render tech select options)
 */
function renderTechOptions() {
  if (!dom.techSelect) return;
  dom.techSelect.innerHTML = '';
  Object.keys(state.techTotals).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dom.techSelect.appendChild(opt);
  });
  dom.techSelect.value = state.currentTech;
}

/**
 * 渲染各技术累计列表(Render totals by tech list)
 */
function renderTechList() {
  if (!dom.techList) return;
  dom.techList.innerHTML = '';
  const entries = Object.entries(state.techTotals || {});
  entries.forEach(([name, secs]) => {
    const li = document.createElement('li');
    li.textContent = `${name}：${formatHMS(secs)}`;
    li.style.color = (name === state.currentTech) ? 'var(--primary)' : 'inherit';
    dom.techList.appendChild(li);
  });
}

/**
 * 新增技术(Add new tech)
 */
function addTech() {
  const name = (dom.techInput?.value || '').trim();
  if (!name) {
    alert('请输入技术名称(Please enter tech name)');
    return;
  }
  if (state.techTotals[name] != null) {
    alert('该技术已存在(Tech already exists)');
    return;
  }
  state.techTotals[name] = 0;
  state.currentTech = name;
  if (dom.techInput) dom.techInput.value = '';
  renderTechOptions();
  updateUI();
  saveState();
}

/**
 * 切换当前技术(Set current tech)
 * @param {string} name - 技术名称(Tech name)
 */
function setCurrentTech(name) {
  if (!name) return;
  state.currentTech = name;
  renderTechOptions();
  updateUI();
  saveState();
}

// ===================== 事件绑定与初始化(Event binding & init) =====================

/**
 * 绑定所有交互事件(Bind events)
 */
function bindEvents() {
  // 统一事件绑定入口(Unified event bindings entry)
  // 计时相关(Timer controls)
  dom.startBtn.addEventListener('click', startSession);
  dom.pauseBtn.addEventListener('click', stopSession);
  dom.resetBtn.addEventListener('click', resetAll);
  // 快捷加时(Quick add)
  dom.quickAddButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const min = Number(btn.getAttribute('data-add-min')) || 0;
      addMinutes(min);
    });
  });
  // 背景上传/清除(Background upload/clear)
  if (dom.bgFile) dom.bgFile.addEventListener('change', (e) => handleBackgroundUpload(e.target.files?.[0]));
  if (dom.clearBg) dom.clearBg.addEventListener('click', clearBackground);
  // 背景遮罩强度(Overlay strength)
  if (dom.overlayStrength) dom.overlayStrength.addEventListener('input', (e) => setOverlayStrength(e.target.value));
  // 流星特效(Meteors)
  dom.toggleMeteor.addEventListener('change', (e) => setupMeteor(e.target.checked));
  if (dom.toggleMeteorPauseBtn) dom.toggleMeteorPauseBtn.addEventListener('click', toggleMeteorPause);
  // 数据导出导入(Data export/import)
  dom.exportBtn.addEventListener('click', exportData);
  dom.importFile.addEventListener('change', (e) => importData(e.target.files?.[0]));
  // 技术管理(Tech management)
  if (dom.techAddBtn) dom.techAddBtn.addEventListener('click', addTech);
  if (dom.techSelect) dom.techSelect.addEventListener('change', (e) => setCurrentTech(e.target.value));
  // 新增：背景适配与滚动行为(Background fit & attachment)
  if (dom.bgFitSelect) dom.bgFitSelect.addEventListener('change', (e) => setBgFit(e.target.value));
  if (dom.bgAttachmentSelect) dom.bgAttachmentSelect.addEventListener('change', (e) => setBgAttachment(e.target.value));
}

/**
 * 应用初始化入口(App init)
 */
function init() {
  bindEvents();
  loadState();
  initTechUI();
  updateUI();

  // 如果正在计时，确保定时器在运行(Ensure UI timer when running)
  if (state.running && !uiTimer) {
    uiTimer = setInterval(updateUI, 250);
  }
}

// 启动应用(Init app)
init();

/**
 * 设置当前已生成的流星的播放状态(Set play state for meteors)
 * @param {boolean} paused - 是否暂停(Paused)
 */
function setMeteorPlayState(paused) {
  const nodes = dom.meteorLayer?.querySelectorAll('.meteor') || [];
  nodes.forEach(m => {
    m.style.animationPlayState = paused ? 'paused' : 'running';
  });
}

/**
 * 暂停/继续流星动画(Pause/Resume meteor animation)
 * - 暂停：设置所有流星动画为 paused，并取消后续定时器(Pause and cancel timers)
 * - 继续：设置所有流星动画为 running，并重新补充生成(Resume and schedule)
 */
function toggleMeteorPause() {
  if (!dom.toggleMeteorPauseBtn) return;
  state.animationPaused = !state.animationPaused;
  setMeteorPlayState(state.animationPaused);
  dom.toggleMeteorPauseBtn.textContent = state.animationPaused ? '继续流星(Resume meteors)' : '暂停流星(Pause meteors)';
  if (!state.animationPaused) {
    // 重新补充几颗流星(Refill meteors)
    for (let i = 0; i < 2; i++) {
      const t = setTimeout(() => createMeteorDOM(), i * 2000);
      meteorTimers.push(t);
    }
  } else {
    cancelScheduledMeteors();
  }
}

/**
 * 将遮罩强度应用到DOM(Apply overlay alpha to DOM)
 * @param {number} alpha - 遮罩透明度(Overlay alpha)
 */
function applyOverlayAlphaToDOM(alpha) {
  const clamped = Math.max(0, Math.min(1, Number(alpha)));
  // 通过CSS变量控制body::before的透明度(Use CSS variable for body::before overlay)
  document.documentElement.style.setProperty('--overlay-alpha', String(clamped));
}

/**
 * 设置遮罩强度(Set overlay strength)
 * @param {number} alpha - 遮罩透明度(0~1)
 */
function setOverlayStrength(alpha) {
  const clamped = Math.max(0, Math.min(1, Number(alpha)));
  state.overlayAlpha = clamped;
  applyOverlayAlphaToDOM(clamped);
  saveState();
}
/**
 * 背景适配值映射(Map background fit value)
 * 将用户选择的适配模式转换为CSS的background-size值(Convert user fit mode to CSS background-size)
 */
function mapFit(fit) {
  switch (fit) {
    case 'contain':
      return 'contain';
    case 'stretch':
      return '100% 100%';
    case 'cover':
    default:
      return 'cover';
  }
}

/**
 * 应用背景样式到body(Apply background styles to body)
 * 根据state中的背景数据与适配设置统一更新背景样式(Update background using state.backgroundDataUrl, bgFit, bgAttachment)
 */
function applyBackgroundStyles() {
  const url = state.backgroundDataUrl ? `url(${state.backgroundDataUrl})` : null;
  if (!url) return; // 无背景数据(No background data)
  const size = mapFit(state.bgFit);
  // 采用两层背景：图片 + 渐变(Image + gradient)
  document.body.style.backgroundImage = `${url}, linear-gradient(120deg, #0b1b2a 0%, #0e2a47 50%, #123b66 100%)`;
  document.body.style.backgroundRepeat = 'no-repeat, no-repeat';
  document.body.style.backgroundAttachment = `${state.bgAttachment}, fixed`;
  document.body.style.backgroundSize = `${size}, auto`;
  document.body.style.backgroundPosition = 'center, center';
}

/**
 * 设置背景适应模式(Set background fit)
 * 更新state并应用样式(Update state and apply styles)
 */
function setBgFit(fit) {
  state.bgFit = fit || 'cover';
  applyBackgroundStyles();
  saveState();
}

/**
 * 设置背景滚动行为(Set background attachment)
 * 更新state并应用样式(Update state and apply styles)
 */
function setBgAttachment(attachment) {
  state.bgAttachment = attachment || 'fixed';
  applyBackgroundStyles();
  saveState();
}

/**
 * 设置背景图(Set background image)
 * 当用户上传图片时调用(Invoked after user uploads image)
 */
function setBackgroundImage(dataUrl) {
  // 保存到state并统一由applyBackgroundStyles应用(Save to state and apply via applyBackgroundStyles)
  if (dataUrl) {
    state.backgroundDataUrl = dataUrl;
  }
  applyBackgroundStyles();
}