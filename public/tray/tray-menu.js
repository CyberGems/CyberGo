'use strict';

// Suite-standard tray menu (pattern from CyberViewer / CyberLauncher, adapted
// to CyberGo). DOM popup rendered in tray-menu.html; state arrives from the
// main process via tray-preload.cjs and every item reports back through
// 'tray-menu-action'.

const ICONS = {
  window: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="10" y1="4" x2="10" y2="8"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="6" y1="4" x2="6" y2="8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  diamond: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M9 3l3 6 3-6"/></svg>',
  quit: '<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  appDefault: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
};

function getApi() {
  return window.trayMenu || (window.electronAPI && window.electronAPI.trayMenu) || null;
}
const cardEl = document.getElementById('card');
const headEl = document.getElementById('head');
const headDividerEl = document.getElementById('headDivider');
const groupEl = document.getElementById('group');
const exitDividerEl = document.getElementById('exitDivider');
const exitGroupEl = document.getElementById('exitGroup');

let currentState = {
  version: '',
  lang: 'en',
  isVisible: false,
  shortcut: 'Alt+Shift+G',
  hasPassword: false,
  suiteApps: [],
};
let currentView = 'main';

const I18N = {
  en: {
    back: 'Back',
    show: 'Show CyberGo',
    hide: 'Hide CyberGo',
    quickCapture: 'Quick capture',
    reminders: 'Reminders',
    lock: 'Lock',
    lockUnavailable: 'Lock (no password set)',
    statusVisible: 'On screen · Visible',
    statusHidden: 'In tray · Hidden',
    help: 'Help',
    suite: 'More from CyberGems',
    quit: 'Exit',
    about: 'About CyberGo...',
    viewAllSuite: 'More details online...',
  },
  es: {
    back: 'Volver',
    show: 'Mostrar CyberGo',
    hide: 'Ocultar CyberGo',
    quickCapture: 'Captura rápida',
    reminders: 'Avisos',
    lock: 'Bloquear',
    lockUnavailable: 'Bloquear (sin contraseña)',
    statusVisible: 'En pantalla · Visible',
    statusHidden: 'En bandeja · Oculto',
    help: 'Ayuda',
    suite: 'Más de CyberGems',
    quit: 'Salir',
    about: 'Acerca de CyberGo...',
    viewAllSuite: 'Más detalles online...',
  },
};

function t(key, vars = {}) {
  const lang = (currentState && currentState.lang === 'es') ? 'es' : 'en';
  let text = (I18N[lang] && I18N[lang][key]) || (I18N.en && I18N.en[key]) || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

function makeSeparator() {
  const sep = document.createElement('div');
  sep.className = 'submenu-divider';
  sep.setAttribute('role', 'separator');
  return sep;
}

function makeItem(def) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'item' + (def.danger ? ' item-danger' : '') + (def.stacked ? ' item-stacked' : '') + (def.disabled ? ' item-empty' : '');
  // App-style bubble via [data-tooltip]; a native title would use the OS style.
  if (def.title) btn.dataset.tooltip = def.title;

  if (def.img) {
    const img = document.createElement('img');
    img.className = def.stacked ? 'item-suite-img' : 'item-img';
    img.src = def.img;
    img.alt = '';
    img.draggable = false;
    img.addEventListener('error', () => {
      img.style.display = 'none';
      if (!def.stacked) {
        const fallbackIco = document.createElement('span');
        fallbackIco.className = 'item-ico';
        fallbackIco.innerHTML = ICONS[def.fallbackIcon] || ICONS.appDefault;
        btn.prepend(fallbackIco);
      }
    }, { once: true });
    btn.appendChild(img);
  } else if (def.icon) {
    const ico = document.createElement('span');
    ico.className = 'item-ico';
    ico.innerHTML = ICONS[def.icon] || ICONS.appDefault;
    btn.appendChild(ico);
  }

  if (def.stacked) {
    const copy = document.createElement('div');
    copy.className = 'item-copy';
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = def.label;
    copy.appendChild(name);
    if (def.desc) {
      const desc = document.createElement('div');
      desc.className = 'item-desc';
      desc.textContent = def.desc;
      copy.appendChild(desc);
    }
    btn.appendChild(copy);
  } else {
    const lbl = document.createElement('span');
    lbl.className = 'item-label';
    lbl.textContent = def.label;
    btn.appendChild(lbl);
  }

  if (def.shortcut) {
    const sc = document.createElement('span');
    sc.className = 'item-shortcut';
    sc.textContent = def.shortcut;
    btn.appendChild(sc);
  }

  if (def.trailingIcon) {
    const ch = document.createElement('span');
    ch.className = 'item-chevron';
    ch.innerHTML = ICONS[def.trailingIcon] || ICONS.chevron;
    btn.appendChild(ch);
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (def.disabled) return;
    if (def.localAction) {
      currentView = def.localAction;
      renderView();
    } else if (def.action) {
      const api = getApi();
      if (api && api.action) {
        api.action(def.action, def.payload);
      }
    }
  });

  return btn;
}

function renderHead() {
  headEl.replaceChildren();

  if (currentView === 'main') {
    headDividerEl.style.display = 'block';
    const version = (currentState && currentState.version) || '';
    headEl.className = 'head';
    headEl.setAttribute('role', 'button');
    headEl.setAttribute('tabindex', '0');

    const logo = document.createElement('img');
    logo.className = 'head-logo';
    logo.src = '../icon.png';
    logo.alt = '';
    logo.draggable = false;

    const titleWrap = document.createElement('span');
    titleWrap.className = 'head-title';
    titleWrap.innerHTML = `Cyber<span class="head-title-accent">Go</span> <span class="head-ver">v${version}</span>`;

    headEl.appendChild(logo);
    headEl.appendChild(titleWrap);
    headEl.dataset.tooltip = t('about');
    headEl.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const api = getApi();
      if (api && api.action) api.action('about');
    };
    headEl.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const api = getApi();
        if (api && api.action) api.action('about');
      }
    };
  } else {
    headDividerEl.style.display = 'block';
    headEl.className = 'sub-head';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'back-btn';
    backBtn.innerHTML = `${ICONS.chevronLeft}<span>${t('back')}</span>`;
    backBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentView = 'main';
      renderView();
    };

    headEl.appendChild(backBtn);

    if (currentView === 'suite') {
      const brandBtn = document.createElement('button');
      brandBtn.type = 'button';
      brandBtn.className = 'suite-brand-mark';
      brandBtn.innerHTML = `<img class="suite-brand-logo" src="../cybergems-logo.svg" alt="" onerror="this.onerror=null;this.src='../cybergems-logo.png'"><span class="suite-brand-name">CyberGems</span>`;
      brandBtn.onclick = () => {
        const api = getApi();
        if (api && api.action) api.action('suite-home');
      };
      headEl.appendChild(brandBtn);
    } else if (currentView === 'help') {
      const title = document.createElement('span');
      title.className = 'sub-title';
      title.textContent = t('help');
      headEl.appendChild(title);
    }
  }
}

function renderMainView() {
  const isVis = Boolean(currentState && currentState.isVisible);
  const shortcut = (currentState && currentState.shortcut) || '';
  const showSuite = currentState ? currentState.showSuiteRecommendations !== false : true;
  const hasPassword = Boolean(currentState && currentState.hasPassword);

  const items = [];

  // Live status row
  const statusRow = document.createElement('div');
  statusRow.className = 'status-row';
  statusRow.innerHTML = `
    <span class="status-dot ${isVis ? 'active' : 'idle'}" aria-hidden="true"></span>
    <span class="status-text">${isVis ? t('statusVisible') : t('statusHidden')}</span>
  `;
  items.push(statusRow);

  // Show / Hide action
  items.push(
    makeItem({
      action: isVis ? 'hide' : 'show',
      icon: 'window',
      label: isVis ? t('hide') : t('show'),
    })
  );

  // Quick capture
  items.push(
    makeItem({
      action: 'quick-capture',
      icon: 'plus',
      label: t('quickCapture'),
      shortcut: shortcut || undefined,
    })
  );

  // Reminders
  items.push(
    makeItem({
      action: 'reminders',
      icon: 'bell',
      label: t('reminders'),
    })
  );

  // Lock (only meaningful with a password set; shown muted otherwise)
  items.push(
    makeItem({
      action: 'lock',
      icon: 'lock',
      label: hasPassword ? t('lock') : t('lockUnavailable'),
      disabled: !hasPassword,
      title: hasPassword ? undefined : t('lockUnavailable'),
    })
  );

  // Drill-down submenus
  items.push(makeSeparator());
  if (showSuite) {
    items.push(
      makeItem({
        localAction: 'suite',
        icon: 'diamond',
        label: t('suite'),
        trailingIcon: 'chevron',
      })
    );
  }

  groupEl.replaceChildren(...items);

  // Exit button
  exitDividerEl.style.display = 'block';
  exitGroupEl.style.display = 'flex';
  exitGroupEl.replaceChildren(
    makeItem({
      action: 'quit',
      icon: 'quit',
      label: t('quit'),
      danger: true,
    })
  );
}

function renderSuiteView() {
  const apps = (currentState && Array.isArray(currentState.suiteApps)) ? currentState.suiteApps : [];
  const sisterApps = apps.filter((a) => a && a.slug !== 'cybergo');

  const items = sisterApps.map((app) => {
    return makeItem({
      action: 'suite-app',
      payload: { site: app.site, slug: app.slug },
      img: `../suite/${app.slug}.png`,
      icon: 'diamond',
      label: app.name,
      desc: app.desc,
      stacked: true,
    });
  });

  items.push(makeSeparator());
  items.push(
    makeItem({
      action: 'suite-view-all',
      icon: 'arrowRight',
      label: t('viewAllSuite'),
    })
  );

  groupEl.replaceChildren(...items);
  exitDividerEl.style.display = 'none';
  exitGroupEl.style.display = 'none';
}

function renderView() {
  renderHead();

  groupEl.className = 'group';

  if (currentView === 'suite') {
    renderSuiteView();
  } else {
    renderMainView();
  }

  reportSize();
}

function reportSize() {
  if (!cardEl) return;
  requestAnimationFrame(() => {
    const pad = 24;
    let contentH = 0;
    const parts = [headEl, headDividerEl, groupEl, exitDividerEl, exitGroupEl];
    for (const el of parts) {
      if (el && el.style.display !== 'none') {
        contentH += el.getBoundingClientRect().height;
      }
    }
    const cardH = Math.max(cardEl.scrollHeight, Math.ceil(contentH + 2));
    const h = Math.ceil(cardH + 2 * pad);
    const w = Math.ceil(cardEl.offsetWidth + 2 * pad);
    const api = getApi();
    if (api && api.ready && w > 0 && h > 0) {
      api.ready({ width: w, height: h, view: currentView });
    }
  });
}

function hideMenu() {
  currentView = 'main';
  renderView();
  const api = getApi();
  if (api && api.hide) {
    api.hide();
  }
}

// Global key handlers
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (currentView !== 'main') {
      currentView = 'main';
      renderView();
    } else {
      hideMenu();
    }
  }
});

// Disable right-click menu inside tray menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Blur dismiss
window.addEventListener('blur', () => {
  currentView = 'main';
  renderView();
  setTimeout(() => {
    const api = getApi();
    if (api && api.hide) api.hide();
  }, 100);
});

// Initial immediate render so card is never empty
renderView();

function resetToMain() {
  currentView = 'main';
  renderView();
}

// Subscribe to IPC
let ipcInitialized = false;
function initIpc() {
  if (ipcInitialized) return true;
  const api = getApi();
  if (!api) return false;

  if (api.onState) {
    api.onState((state) => {
      if (state) {
        currentState = { ...currentState, ...state };
        if (state.resetView) currentView = 'main';
      }
      renderView();
    });
  }

  if (api.onShow) {
    api.onShow(() => resetToMain());
  }

  if (api.onReset) {
    api.onReset(() => resetToMain());
  }

  if (api.requestState) {
    api.requestState();
  }

  ipcInitialized = true;
  return true;
}

if (!initIpc()) {
  window.addEventListener('DOMContentLoaded', () => {
    if (!initIpc()) {
      setTimeout(initIpc, 50);
      setTimeout(initIpc, 200);
    }
  });
}
