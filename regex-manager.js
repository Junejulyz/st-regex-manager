// ==UserScript==
// @name         正则管理
// @version      1.0
// @description  正则管理/绑定世界书/批量导入/导出/分组/批量启用/禁用
// @author       @Junezzz&Claude
// ==/UserScript==

(async () => {
    if (!window.TavernHelper) {
        console.log('TavernHelper API未找到，脚本无法运行。');
        return;
    }

    const SCRIPT_NAME = 'RegexManagerV10';
    const MAIN_BUTTON_NAME = '正则管理';
    const STORAGE_KEY = 'regex_group_worldbooks';

    // 状态管理
    let currentTab = 'groups'; // 'groups' | 'regexes'
    let currentFilter = 'all'; // 'all' | 'global' | 'preset' | 'character'
    let expandedGroups = new Set(); // 记录已展开的分组名
    let searchQuery = ''; // 主界面搜索关键词

    // --- 数据操作层 ---
    function getGroupWorldbooks(groupName) {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return data[groupName] || [];
    }

    function setGroupWorldbooks(groupName, worldbooks) {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        data[groupName] = worldbooks;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // 主题：'dark'(默认) | 'light'，存于 localStorage
    const THEME_KEY = 'regex_manager_theme';
    // 扁平线性图标（继承 currentColor，自动随主题变色）
    const ICON_SUN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    const ICON_MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    const ICON_CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    const ICON_BOOK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    const ICON_GEAR = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    // 作用域排序：全局 → 预设 → 局部
    const SCOPE_ORDER = { global: 0, preset: 1, character: 2 };
    function byScope(a, b) { return (SCOPE_ORDER[a] ?? 9) - (SCOPE_ORDER[b] ?? 9); }
    function rmThemeClass() { return localStorage.getItem(THEME_KEY) === 'light' ? 'rm-light' : ''; }
    function rmThemeIcon() { return localStorage.getItem(THEME_KEY) === 'light' ? ICON_MOON : ICON_SUN; }

    // 把下拉菜单以 fixed 定位到触发按钮附近，并钳制在视口内（防止被滚动容器裁切 / 跑到屏幕外）
    // 菜单是卡片(position:relative)的子元素，用 absolute 相对卡片定位——单一明确坐标系，不受视口/transform 影响
    function positionDropdown(trigger, content, card) {
        if (!content || !card) return;
        content.style.position = 'absolute';
        content.style.right = 'auto'; content.style.bottom = 'auto';
        content.style.left = '0px'; content.style.top = '0px';
        content.style.visibility = 'hidden';
        const cw = content.offsetWidth, ch = content.offsetHeight;
        const cardRect = card.getBoundingClientRect();
        const r = trigger.getBoundingClientRect();
        const cardW = card.clientWidth, cardH = card.clientHeight, gap = 6, pad = 8;
        // 相对卡片的坐标
        let top = (r.bottom - cardRect.top) + gap;
        if (top + ch > cardH - pad) {
            const up = (r.top - cardRect.top) - gap - ch;
            top = up >= pad ? up : Math.max(pad, cardH - ch - pad);
        }
        let left = (r.right - cardRect.left) - cw;   // 右对齐到触发按钮
        if (left + cw > cardW - pad) left = cardW - cw - pad;
        if (left < pad) left = pad;
        content.style.left = left + 'px';
        content.style.top = top + 'px';
        content.style.visibility = '';
    }

    // 是否有激活角色（局部/character 作用域的正则需要存在角色卡上，否则会丢失）
    function hasActiveCharacter() {
        try { const ctx = SillyTavern.getContext(); return !!ctx && ctx.characterId !== undefined && ctx.characterId !== null; }
        catch (e) { return false; }
    }
    // 去掉酒馆外层 dialog 的背景/边框/自带关闭叉，保持与主面板一致
    function stripPopupChrome(p) {
        try {
            const rootEl = $(p.dlg).find('.rm-root')[0];
            let el = rootEl ? rootEl.parentElement : null;
            while (el && el !== p.dlg) { el.style.padding = '0'; el.style.margin = '0'; el.style.background = 'transparent'; el = el.parentElement; }
            $(p.dlg).css({ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0', overflow: 'visible' });
            $(p.dlg).find('.popup-button-close').hide();
        } catch (e) {}
    }
    // 给弹窗里的 .rm-list-row 列表绑定即时搜索（按行文本过滤）+ 清除键
    function attachListSearch(p) {
        const apply = (q) => {
            q = (q || '').toLowerCase();
            $(p.dlg).find('.rm-list-row').each(function() {
                const t = (this.textContent || '').toLowerCase();
                this.style.display = (!q || t.includes(q)) ? '' : 'none';
            });
        };
        $(p.dlg).on('input', '.rm-popup-search', function() { apply(String($(this).val() || '')); });
        $(p.dlg).on('click', '.rm-search-clear', function() {
            const inp = $(this).siblings('.rm-popup-search');
            inp.val(''); apply(''); inp.trigger('focus');
        });
    }

    // ===== 字体缩放配置 =====
    const FONT_SCALE_KEY = 'regex_manager_font_scale';
    const DEFAULT_FONT_SCALE = 1;
    const ENTRY_POINT_KEY = 'regex_manager_entry_point';
    function getEntryPoint() { return localStorage.getItem(ENTRY_POINT_KEY) || 'quickreply'; }
    function saveEntryPoint(v) { localStorage.setItem(ENTRY_POINT_KEY, v); }
    function fontScale() { const v = parseFloat(localStorage.getItem(FONT_SCALE_KEY)); return (v && v > 0) ? v : DEFAULT_FONT_SCALE; }
    function saveFontScale(v) { localStorage.setItem(FONT_SCALE_KEY, String(v)); }
    function applyFontScale() { try { document.documentElement.style.setProperty('--rm-font-scale', fontScale()); } catch (e) {} }

    // ===== 标签符号（分组识别）配置 =====
    const BRACKET_DEFAULT_KEY = 'regex_manager_bracket_default';
    const BRACKET_EXTRA_KEY = 'regex_manager_bracket_extra';
    const BRACKET_CUSTOMS_KEY = 'regex_manager_bracket_customs';
    const DEFAULT_BRACKET = '[]';
    const BASE_BRACKETS = ['[]', '【】', '《》', '<>', '（）'];
    function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function bracketCustoms() { try { return JSON.parse(localStorage.getItem(BRACKET_CUSTOMS_KEY) || '[]'); } catch (e) { return []; } }
    function bracketPalette() { return [...new Set([...BASE_BRACKETS, ...bracketCustoms()])]; }
    function getDefaultBracketStr() { return localStorage.getItem(BRACKET_DEFAULT_KEY) || DEFAULT_BRACKET; }
    function getExtraBrackets() { try { return JSON.parse(localStorage.getItem(BRACKET_EXTRA_KEY) || '[]'); } catch (e) { return []; } }
    function getBracketPairs() { return [...new Set([getDefaultBracketStr(), ...getExtraBrackets()])].filter(s => typeof s === 'string' && s.length >= 2); }
    function defaultBracketChars() { const d = getDefaultBracketStr(); return [d[0], d[d.length - 1]]; }
    function makePrefix(groupName) { const [o, c] = defaultBracketChars(); return `${o}${groupName}${c}`; }

    // 用所有已配置的标签符号尝试解析前缀，返回 {open, close, inner, rest} 或 null
    function splitPrefix(name) {
        if (typeof name !== 'string') return null;
        for (const pair of getBracketPairs()) {
            const o = pair[0], c = pair[pair.length - 1];
            const m = name.match(new RegExp('^' + escRe(o) + '(.+?)' + escRe(c) + '\\s*'));
            if (m) return { open: o, close: c, inner: m[1], rest: name.replace(m[0], '').trim() };
        }
        return null;
    }
    function parseGroupName(scriptName) { const sp = splitPrefix(scriptName); return sp ? sp.inner : null; }
    function stripPrefix(name) { const sp = splitPrefix(name); return sp ? sp.rest : (typeof name === 'string' ? name : (name || '')); }

    async function getAllRegexes() {
        let all = [];
        
        // 1. 获取 TavernHelper 的正则 (这是基础)
        try {
            const list = TavernHelper.getTavernRegexes({ scope: 'all' });
            if (Array.isArray(list)) {
                list.forEach(r => all.push({ ...r, scope: r.scope || 'global' }));
            }
        } catch (e) {}

        // 2. 读取预设正则 (酒馆原生 Preset Scripts)
        // 预设正则存储在 completion preset 的 extensions.regex_scripts 中。
        // 注意：TavernHelper.getTavernRegexes 不支持 preset scope，必须走 PresetManager。
        try {
            const ctx = SillyTavern.getContext();
            const apis = ['openai', 'textgenerationwebui', 'kobold', 'novel'];
            const seenPreset = new Set();
            for (const api of apis) {
                let mgr;
                try { mgr = ctx.getPresetManager(api); } catch (e) { continue; }
                if (!mgr || typeof mgr.readPresetExtensionField !== 'function') continue;
                let scripts;
                try { scripts = mgr.readPresetExtensionField({ path: 'regex_scripts' }); } catch (e) { continue; }
                if (!Array.isArray(scripts)) continue;
                scripts.forEach(r => {
                    if (!r || !r.id || seenPreset.has(r.id)) return;
                    seenPreset.add(r.id);
                    all.push({ ...r, scope: 'preset', source: api });
                });
            }
        } catch (e) {
            console.warn('Regex Manager: 预设正则读取出错', e);
        }

        // 去重规范化
        const seen = new Set();
        const result = [];
        all.forEach(r => {
            const id = r.id || r.script_name;
            if (!id || seen.has(id)) return;
            seen.add(id);
            
            const normalized = { ...r };
            normalized.script_name = normalized.script_name || normalized.scriptName || '未命名';
            // 预设正则用 disabled 字段，全局/局部正则用 enabled 字段
            if (typeof normalized.enabled !== 'boolean' && typeof normalized.disabled === 'boolean') {
                normalized.enabled = !normalized.disabled;
            } else {
                normalized.enabled = !!normalized.enabled;
            }
            
            // scope 以来源判定为准（preset 来自 PresetManager，其余来自 TavernHelper）
            normalized.scope = normalized.scope || 'global';
            result.push(normalized);
        });
        
        console.log('Regex Manager: 最终发现的正则总数:', result.length, result);
        return result;
    }

    async function getRegexGroups() {
        const allRegexes = await getAllRegexes();
        const groups = new Map();
        for (const regex of allRegexes) {
            const groupName = parseGroupName(regex.script_name);
            if (groupName) {
                if (!groups.has(groupName)) {
                    groups.set(groupName, { regexes: [], enabled: false, scope: regex.scope, worldbooks: getGroupWorldbooks(groupName) });
                }
                const group = groups.get(groupName);
                group.regexes.push(regex);
                if (regex.enabled) group.enabled = true;
            }
        }
        return groups;
    }

    // --- UI 样式 ---
    const CSS_STYLES = `
        /* ===== 设计 Token：深色(默认) ===== */
        .rm-root {
            --rm-bg: #1a1b1f;
            --rm-surface: #25262d;
            --rm-surface-2: #30313a;
            --rm-text: #ededf2;
            --rm-text-dim: #9a9ba5;
            --rm-accent: #6366f1;
            --rm-accent-hi: #818cf8;
            --rm-accent-soft: rgba(99,102,241,0.18);
            --rm-danger: #f87171;
            --rm-danger-soft: rgba(248,113,113,0.15);
            --rm-track: #41424d;
            --rm-shadow: 0 10px 34px rgba(0,0,0,0.5);
            --rm-shadow-sm: 0 2px 8px rgba(0,0,0,0.35);
            color: var(--rm-text);
            font-family: var(--mainFontFamily, inherit);
            font-size: calc(1em * var(--rm-font-scale, 1));
        }
        /* ===== 浅色覆盖 ===== */
        .rm-root.rm-light {
            --rm-bg: #ffffff;
            --rm-surface: #f4f5f8;
            --rm-surface-2: #e8e9ef;
            --rm-text: #1c1d24;
            --rm-text-dim: #74757f;
            --rm-accent: #5b5fe3;
            --rm-accent-hi: #4346cf;
            --rm-accent-soft: rgba(91,95,227,0.12);
            --rm-danger: #dc2626;
            --rm-danger-soft: rgba(220,38,38,0.10);
            --rm-track: #cfd0d8;
            --rm-shadow: 0 10px 34px rgba(0,0,0,0.16);
            --rm-shadow-sm: 0 2px 8px rgba(0,0,0,0.08);
        }

        #regex-manager-v10 {
            display: flex; flex-direction: column; height: 600px; position: relative;
            background: var(--rm-bg); color: var(--rm-text);
            font-family: var(--mainFontFamily, inherit);
            font-size: calc(1em * var(--rm-font-scale, 1));
            border-radius: 14px; overflow: hidden; -webkit-font-smoothing: antialiased;
            box-shadow: var(--rm-shadow);
        }

        /* ===== 顶栏 ===== */
        .rm-tabs {
            display: flex; align-items: center; gap: 4px;
            padding: 10px 10px 6px 10px;
        }
        .rm-tab {
            padding: 7px 14px; cursor: pointer; font-weight: 600; font-size: 0.82em;
            color: var(--rm-text-dim); border-radius: 9px;
            transition: color 0.18s ease, background 0.18s ease;
        }
        .rm-tab:hover:not(.active) { color: var(--rm-text); background: var(--rm-surface); }
        .rm-tab.active { color: var(--rm-accent); background: var(--rm-accent-soft); }
        .rm-tab-close, .rm-theme-toggle {
            width: 34px; height: 34px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; border-radius: 9px; color: var(--rm-text-dim);
            font-size: 1em; transition: color 0.18s ease, background 0.18s ease;
            user-select: none;
        }
        #rm-settings { margin-left: auto; }
        .rm-tab-close:hover, .rm-theme-toggle:hover { color: var(--rm-text); background: var(--rm-surface); }

        /* ===== 内容区 ===== */
        .rm-content { flex: 1; overflow-y: auto; padding: 4px 12px 12px 12px; scrollbar-width: thin; scrollbar-color: var(--rm-surface-2) transparent; }
        .rm-content::-webkit-scrollbar { width: 8px; }
        .rm-content::-webkit-scrollbar-thumb { background: var(--rm-surface-2); border-radius: 4px; }
        .rm-content::-webkit-scrollbar-track { background: transparent; }

        /* 固定副标题区（筛选条 + 工具行不随列表滚动） */
        .rm-subheader { flex-shrink: 0; padding: 4px 12px 0 12px; }
        .rm-search-wrap { position: relative; margin-bottom: 10px; }
        .rm-search-input {
            width: 100%; box-sizing: border-box; height: 34px; padding: 0 30px 0 12px;
            border: none; outline: none; border-radius: 9px;
            background: var(--rm-surface); color: var(--rm-text); font-size: 0.85em;
            font-family: inherit;
        }
        .rm-search-input::placeholder { color: var(--rm-text-dim); }
        .rm-search-input:focus { box-shadow: inset 0 0 0 1.5px var(--rm-accent); }
        .rm-search-clear {
            position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
            width: 18px; height: 18px; display: none; align-items: center; justify-content: center;
            border-radius: 50%; cursor: pointer; font-size: 0.7em; color: var(--rm-text-dim);
            background: var(--rm-surface-2);
        }
        .rm-search-clear:hover { color: var(--rm-text); }
        .rm-search-input:not(:placeholder-shown) ~ .rm-search-clear { display: flex; }
        /* 工具栏内的搜索框：占中间、无下边距 */
        .rm-toolbar .rm-search-wrap { flex: 1; margin: 0; }
        .rm-toolbar .rm-search-input { height: 30px; font-size: 0.8em; }
        .rm-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .rm-selall { display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 0.8em; color: var(--rm-text-dim); user-select: none; flex-shrink: 0; }
        .rm-selall span { font-weight: 600; }
        .rm-mini-btn {
            height: 30px; padding: 0 16px; border: none; border-radius: 8px; cursor: pointer;
            font-size: 0.8em; font-weight: 600; background: var(--rm-accent-soft); color: var(--rm-accent);
            transition: 0.15s;
        }
        .rm-mini-btn:hover { background: var(--rm-accent); color: #fff; }

        /* 行内重命名铅笔 */
        .rm-edit-icon {
            display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
            width: 20px; height: 22px; border-radius: 6px; cursor: pointer; margin-right: -5px;
            color: var(--rm-text-dim); opacity: 0.65; transition: 0.15s;
        }
        .rm-edit-icon:hover { opacity: 1; color: var(--rm-accent); background: var(--rm-accent-soft); }

        /* 分组展开/收起 */
        .rm-expand {
            display: inline-flex; align-items: center; justify-content: center;
            width: 20px; height: 20px; flex-shrink: 0; cursor: pointer;
            color: var(--rm-text-dim); transition: transform 0.18s ease; border-radius: 5px;
        }
        .rm-expand:hover { color: var(--rm-text); background: var(--rm-surface-2); }
        .rm-expand.open { transform: rotate(90deg); }
        .rm-group-name { cursor: pointer; }
        .rm-wb-indicator { display: inline-flex; align-items: center; color: var(--rm-accent); flex-shrink: 0; }
        .rm-group-children { display: flex; flex-direction: column; gap: 5px; margin: -1px 0 8px 26px; }
        .rm-child {
            display: flex; align-items: center; gap: 9px; padding: 8px 12px;
            background: var(--rm-bg); border-radius: 9px;
        }
        .rm-child .rm-name { font-size: 0.84em; }
        .rm-child-out {
            background: none; border: none; cursor: pointer; color: var(--rm-text-dim);
            font-size: 0.76em; font-weight: 600; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;
        }
        .rm-child-out:hover { color: var(--rm-danger); background: var(--rm-danger-soft); }
        .rm-child-add {
            justify-content: center; cursor: pointer; color: var(--rm-text-dim);
            font-size: 0.8em; font-weight: 600; gap: 4px;
        }
        .rm-child-add:hover { color: var(--rm-accent); }
        .rm-add-plus { font-size: 1.05em; line-height: 1; }

        .rm-item {
            display: flex; align-items: center; gap: 9px;
            padding: 9px 12px; margin-bottom: 6px;
            background: var(--rm-surface); border-radius: 11px;
            transition: background 0.15s ease;
        }
        .rm-item:hover { background: var(--rm-surface-2); }

        .rm-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
        .rm-name {
            font-weight: 500; font-size: 0.92em; color: var(--rm-text);
            flex: 1; text-align: left; min-width: 0;
            white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35;
        }
        .rm-meta {
            font-size: 0.72em; color: var(--rm-text-dim); white-space: nowrap; flex-shrink: 0;
            background: var(--rm-surface-2); border-radius: 10px; padding: 1px 7px; font-weight: 600;
        }
        .rm-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .rm-btn-icon {
            background: none; border: none; cursor: pointer; color: var(--rm-text-dim); padding: 0;
            width: 24px; height: 24px; border-radius: 7px; font-size: 1.05em;
            display: flex; align-items: center; justify-content: center; transition: 0.15s;
        }
        .rm-btn-icon:hover { color: var(--rm-text); background: var(--rm-surface-2); }

        .scope-tag {
            padding: 2px 6px; border-radius: 5px; font-size: 0.6em; font-weight: 700;
            color: #fff; flex-shrink: 0; letter-spacing: 0.3px; white-space: nowrap;
            min-width: 30px; text-align: center;
        }
        .scope-global { background: #2563eb; }
        .scope-character { background: #7c3aed; }
        .scope-preset { background: #047857; }

        /* ===== 下拉菜单 ===== */
        .rm-dropdown { position: relative; }
        .rm-dropdown-content {
            display: none; position: absolute; right: 0; top: calc(100% + 6px);
            background: var(--rm-surface); border-radius: 12px; z-index: 10000; min-width: 152px;
            box-shadow: var(--rm-shadow); overflow: hidden; padding: 5px;
        }
        .rm-dropdown.active .rm-dropdown-content { display: block; animation: rm-pop 0.16s ease-out; }
        .rm-floating-menu { animation: rm-pop 0.16s ease-out; }
        .rm-dropdown-up .rm-dropdown-content { top: auto; bottom: calc(100% + 6px); left: 0; right: auto; transform-origin: bottom; }
        .rm-dropdown-item {
            padding: 9px 12px; cursor: pointer; font-size: 0.85em; border-radius: 8px;
            color: var(--rm-text); transition: 0.15s; display: flex; align-items: center; gap: 8px;
        }
        .rm-dropdown-item:hover { background: var(--rm-accent-soft); color: var(--rm-accent); }
        .rm-dropdown-item.danger { color: var(--rm-danger); }
        .rm-dropdown-item.danger:hover { background: var(--rm-danger-soft); color: var(--rm-danger); }

        @keyframes rm-pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes rm-slide-up { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        @keyframes rm-slide-down { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }

        /* ===== 底栏按钮 ===== */
        .rm-footer {
            display: flex; gap: 8px; padding: 9px 12px; flex-direction: row !important;
            background: var(--rm-bg); border-top: 1px solid var(--rm-surface-2);
        }
        .rm-footer .menu_button, .rm-header-btns .menu_button {
            flex: 1; margin: 0 !important; height: 34px !important; min-width: 0 !important;
            padding: 0 12px !important; border-radius: 9px !important; border: none !important;
            display: flex !important; align-items: center; justify-content: center; gap: 6px;
            font-weight: 600; font-size: 0.78em; white-space: nowrap; cursor: pointer;
            background: var(--rm-surface) !important; color: var(--rm-text) !important;
            box-shadow: none !important; text-shadow: none !important; transition: 0.15s;
        }
        .rm-footer .menu_button:hover, .rm-header-btns .menu_button:hover { background: var(--rm-surface-2) !important; }
        .rm-footer .menu_button_bad { background: transparent !important; color: var(--rm-danger) !important; }
        .rm-footer .menu_button_bad:hover { background: var(--rm-danger-soft) !important; }

        .rm-header-btns { display: flex; flex-direction: row; gap: 8px; margin-bottom: 12px; }
        .rm-header-btns .menu_button { height: 32px !important; font-size: 0.8em; }

        .rm-move-wrap { flex: 1; display: flex; }
        .rm-move-wrap > .rm-dropdown-trigger { flex: 1; }

        /* ===== Toggle 开关 ===== */
        .rm-toggle { position: relative; display: inline-block; width: 30px; height: 17px; cursor: pointer; flex-shrink: 0; }
        .rm-toggle input { opacity: 0; width: 0; height: 0; }
        .rm-slider { position: absolute; inset: 0; background: var(--rm-track); transition: 0.25s ease; border-radius: 18px; }
        .rm-slider:before {
            position: absolute; content: ""; height: 11px; width: 11px; left: 3px; top: 3px;
            background: #fff; transition: 0.25s ease; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        input:checked + .rm-slider { background: var(--rm-accent); }
        input:checked + .rm-slider:before { transform: translateX(13px); }

        /* ===== 圆形勾选 ===== */
        .rm-check-round {
            width: 19px; height: 19px; cursor: pointer; appearance: none; -webkit-appearance: none;
            border-radius: 50%; position: relative; transition: 0.18s; flex-shrink: 0; margin: 0;
            background: transparent; box-shadow: inset 0 0 0 2px var(--rm-track);
        }
        .rm-check-round:checked { background: var(--rm-accent); box-shadow: none; }
        .rm-check-round:checked::after {
            content: "✓"; position: absolute; color: #fff; font-size: 12px; font-weight: 700;
            left: 50%; top: 50%; transform: translate(-50%,-50%);
        }

        /* ===== 分段筛选器 ===== */
        .rm-filter-bar { display: flex; background: var(--rm-surface); border-radius: 10px; padding: 3px; margin-bottom: 10px; gap: 3px; }
        .rm-filter-btn {
            flex: 1; text-align: center; padding: 6px; cursor: pointer; font-size: 0.76em;
            border-radius: 7px; transition: 0.15s; color: var(--rm-text-dim); font-weight: 500;
        }
        .rm-filter-btn:hover:not(.active) { color: var(--rm-text); }
        .rm-filter-btn.active { background: var(--rm-bg); color: var(--rm-accent); font-weight: 700; box-shadow: var(--rm-shadow-sm); }

        /* ===== 子弹窗通用 ===== */
        .rm-empty { text-align: center; margin-top: 60px; color: var(--rm-text-dim); font-size: 0.9em; }
        .rm-popup-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .rm-popup-header .rm-section-title { margin: 0; }
        .rm-popup-close {
            width: 28px; height: 28px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            border-radius: 8px; color: var(--rm-text-dim); transition: 0.15s;
        }
        .rm-popup-close:hover { color: var(--rm-text); background: var(--rm-surface); }
        .rm-popup-footer { display: flex; gap: 8px; margin-top: 14px; }
        .rm-btn {
            flex: 1; height: 36px; border: none; border-radius: 9px; cursor: pointer;
            font-weight: 600; font-size: 0.85em; transition: 0.15s; font-family: inherit;
        }
        .rm-btn-sub { background: var(--rm-surface); color: var(--rm-text); }
        .rm-btn-sub:hover { background: var(--rm-surface-2); }
        .rm-btn-primary { background: var(--rm-accent); color: #fff; }
        .rm-btn-primary:hover { background: var(--rm-accent-hi); }
        .rm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .rm-btn-primary:disabled:hover { background: var(--rm-accent); }

        /* 设置面板 */
        .rm-set-section { margin-bottom: 18px; }
        .rm-set-section:last-child { margin-bottom: 0; }
        .rm-set-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .rm-set-label { font-size: 0.85em; font-weight: 600; color: var(--rm-text); flex: 1; }
        .rm-set-val { font-size: 0.8em; color: var(--rm-text-dim); }
        .rm-set-reset { font-size: 0.78em; color: var(--rm-accent); cursor: pointer; font-weight: 600; }
        .rm-set-reset:hover { opacity: 0.8; }
        .rm-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .rm-chip {
            padding: 5px 13px; border-radius: 8px; background: var(--rm-surface); color: var(--rm-text);
            cursor: pointer; font-size: 0.95em; transition: 0.15s; user-select: none;
        }
        .rm-chip:hover { background: var(--rm-surface-2); }
        .rm-chip.active { background: var(--rm-accent); color: #fff; }
        .rm-chip-del {
            display: inline-flex; align-items: center; justify-content: center;
            margin-left: 5px; width: 14px; height: 14px; border-radius: 50%;
            font-size: 0.6em; color: var(--rm-text-dim); cursor: pointer;
            vertical-align: middle; transition: 0.15s; line-height: 1;
        }
        .rm-chip-del:hover { color: var(--rm-danger); background: var(--rm-danger-soft); }
        .rm-range { width: 100%; accent-color: var(--rm-accent); cursor: pointer; }
        /* ===== 设置面板左对齐 ===== */
        .rm-set-section, .rm-set-row, .rm-set-label { text-align: left; }
        .rm-section-title { font-size: 0.95em; font-weight: 600; margin-bottom: 12px; color: var(--rm-text); text-align: left; }
        /* ===== 焦点陷阱（防 mobile 弹键盘）===== */
        .rm-focus-trap { position: absolute; opacity: 0; width: 0; height: 0; padding: 0; border: 0; overflow: hidden; pointer-events: none; }
        .rm-list-box { max-height: 400px; overflow-y: auto; border-radius: 10px; }
        .rm-list-row { padding: 11px 12px; }
        .rm-list-row + .rm-list-row { border-top: 1px solid var(--rm-surface-2); }
        .rm-list-row label { cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--rm-text); }
        .rm-list-row .scope-tag { font-size: 0.6em; }

        /* 移动端：收紧各元素，给标签留更多空间 */
        @media (max-width: 600px) {
            .rm-item { gap: 6px; padding: 8px 9px; }
            .rm-info { gap: 6px; }
            .rm-actions { gap: 4px; }
            .scope-tag { min-width: 24px; padding: 2px 4px; letter-spacing: 0; }
            .rm-edit-icon { width: 18px; height: 18px; }
            .rm-btn-icon { width: 22px; height: 22px; }
            .rm-meta { padding: 1px 6px; }
            .rm-tab { padding: 7px 11px; }
            .rm-content { padding: 4px 8px 10px 8px; }
            .rm-group-children { margin-left: 16px; }
            .rm-toggle { width: 28px; height: 16px; }
            .rm-slider:before { height: 10px; width: 10px; left: 3px; top: 3px; }
            input:checked + .rm-slider:before { transform: translateX(12px); }
        }
        .rm-group-label { font-size: 0.74em; font-weight: 700; color: var(--rm-text-dim); text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px 4px 12px; }
        .rm-list-row span { font-size: 0.9em; }
    `;

    // --- UI 构建函数 ---
    function scopeLabelOf(scope) {
        if (scope === 'global') return '全局';
        if (scope === 'preset') return '预设';
        return '局部';
    }

    function searchInputHtml() {
        const q = (searchQuery || '').replace(/"/g, '&quot;');
        return `<div class="rm-search-wrap"><input type="text" id="rm-search" class="rm-search-input" placeholder="搜索…" value="${q}"><span class="rm-search-clear">✕</span></div>`;
    }

    async function renderGroups(container, header) {
        if (header) header.innerHTML = searchInputHtml() + renderFilterBar();
        let groupsMap = await getRegexGroups();
        let groups = Array.from(groupsMap.entries());
        
        if (currentFilter !== 'all') {
            groups = groups.filter(([_, data]) => data.scope === currentFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            groups = groups.filter(([name, data]) => name.toLowerCase().includes(q) || data.regexes.some(r => (r.script_name || '').toLowerCase().includes(q)));
        }
        groups.sort((a, b) => byScope(a[1].scope, b[1].scope));

        if (groups.length === 0) {
            container.innerHTML = `<div class="rm-empty">暂无匹配分组</div>`;
            return;
        }

        let html = '';
        for (const [name, data] of groups) {
            const expanded = expandedGroups.has(name);
            const wbCount = (data.worldbooks || []).length;
            let children = '';
            if (expanded) {
                children = `<div class="rm-group-children">`;
                for (const r of data.regexes) {
                    children += `
                        <div class="rm-child">
                            <div class="rm-name" title="${r.script_name}">${stripPrefix(r.script_name)}</div>
                            <div class="rm-actions">
                                <label class="rm-toggle">
                                    <input type="checkbox" class="regex-toggle" data-id="${r.id}" ${r.enabled ? 'checked' : ''}>
                                    <span class="rm-slider"></span>
                                </label>
                                <button type="button" class="rm-child-out" data-id="${r.id}" title="移出分组">移出</button>
                            </div>
                        </div>`;
                }
                children += `<div class="rm-child rm-child-add" data-group="${name}" data-scope="${data.scope}"><span class="rm-add-plus">＋</span> 添加正则</div>`;
                children += `</div>`;
            }
            html += `
                <div class="rm-group">
                    <div class="rm-item rm-group-row">
                        <span class="rm-expand ${expanded ? 'open' : ''}" data-group="${name}">${ICON_CHEVRON}</span>
                        <span class="scope-tag scope-${data.scope}">${scopeLabelOf(data.scope)}</span>
                        <div class="rm-info">
                            <span class="rm-edit-icon" data-edit="group" data-name="${name}" title="重命名">${ICON_PENCIL}</span>
                            <div class="rm-name rm-group-name" data-group="${name}" title="${name}">${name}</div>
                            ${wbCount ? `<span class="rm-wb-indicator" title="已绑定 ${wbCount} 本世界书">${ICON_BOOK}</span>` : ''}
                            <span class="rm-meta" title="${data.regexes.length} 条正则">${data.regexes.length}</span>
                        </div>
                        <div class="rm-actions">
                            <label class="rm-toggle">
                                <input type="checkbox" class="group-toggle" data-name="${name}" ${data.enabled ? 'checked' : ''}>
                                <span class="rm-slider"></span>
                            </label>
                            <div class="rm-dropdown">
                                <button type="button" class="rm-btn-icon rm-dropdown-trigger">⋯</button>
                                <div class="rm-dropdown-content">
                                    ${data.scope !== 'global' ? `<div class="rm-dropdown-item" data-action="move" data-scope="global" data-name="${name}">移至全局</div>` : ''}
                                    ${data.scope !== 'character' ? `<div class="rm-dropdown-item" data-action="move" data-scope="character" data-name="${name}">移至局部</div>` : ''}
                                    ${data.scope !== 'preset' ? `<div class="rm-dropdown-item" data-action="move" data-scope="preset" data-name="${name}">移至预设</div>` : ''}
                                    <div class="rm-dropdown-item" data-action="bind" data-name="${name}">绑定世界书</div>
                                    <div class="rm-dropdown-item" data-action="export" data-name="${name}">导出分组</div>
                                    <div class="rm-dropdown-item danger" data-action="delete" data-name="${name}">解散分组</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${children}
                </div>
            `;
        }
        container.innerHTML = html;
    }

    async function renderRegexes(container, header) {
        if (header) header.innerHTML = renderFilterBar() + `
            <div class="rm-toolbar">
                <label class="rm-selall">
                    <input type="checkbox" class="rm-check-round" id="sel-all-cb">
                    <span>全选</span>
                </label>
                ${searchInputHtml()}
                <button type="button" class="rm-mini-btn" id="btn-import-scope">导入</button>
            </div>
        `;
        let allRegexes = await getAllRegexes();
        
        if (currentFilter !== 'all') {
            allRegexes = allRegexes.filter(r => r.scope === currentFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            allRegexes = allRegexes.filter(r => (r.script_name || '').toLowerCase().includes(q));
        }
        allRegexes.sort((a, b) => byScope(a.scope, b.scope));

        if (allRegexes.length === 0) {
            container.innerHTML = `<div class="rm-empty">没有找到匹配正则</div>`;
            return;
        }

        container.innerHTML = allRegexes.map(r => `
                <div class="rm-item">
                    <input type="checkbox" class="rm-check-round regex-sel" data-id="${r.id}">
                    <span class="scope-tag scope-${r.scope}">${scopeLabelOf(r.scope)}</span>
                    <div class="rm-info">
                        <span class="rm-edit-icon" data-edit="regex" data-id="${r.id}" title="重命名">${ICON_PENCIL}</span>
                        <div class="rm-name" title="${r.script_name}">${r.script_name}</div>
                    </div>
                    <div class="rm-actions">
                        <label class="rm-toggle">
                            <input type="checkbox" class="regex-toggle" data-id="${r.id}" ${r.enabled ? 'checked' : ''}>
                            <span class="rm-slider"></span>
                        </label>
                    </div>
                </div>
            `).join('');
    }

    function showUnifiedUI() {
        const content = `
            <style>${CSS_STYLES}</style>
            <div id="regex-manager-v10" class="rm-root ${rmThemeClass()}">
                <div class="rm-tabs">
                    <div class="rm-tab ${currentTab === 'groups' ? 'active' : ''}" data-tab="groups">分组管理</div>
                    <div class="rm-tab ${currentTab === 'regexes' ? 'active' : ''}" data-tab="regexes">正则管理</div>
                    <div class="rm-theme-toggle" id="rm-settings" title="设置">${ICON_GEAR}</div>
                    <div class="rm-theme-toggle" id="rm-theme" title="切换日夜主题">${rmThemeIcon()}</div>
                    <div class="rm-tab-close" id="rm-close" title="关闭">${ICON_CLOSE}</div>
                </div>
                <div class="rm-subheader" id="rm-subheader"></div>
                <div class="rm-content" id="rm-main-list"></div>
                <div class="rm-footer" id="rm-footer-groups" style="display: ${currentTab === 'groups' ? 'flex' : 'none'}">
                    <button type="button" class="menu_button" id="btn-create-group">新建分组</button>
                    <button type="button" class="menu_button" id="btn-import">导入正则</button>
                </div>
                <div class="rm-footer" id="rm-footer-regexes" style="display: ${currentTab === 'regexes' ? 'flex' : 'none'}">
                    <button type="button" class="menu_button menu_button_sub" data-batch="enable">启用</button>
                    <button type="button" class="menu_button menu_button_sub" data-batch="disable">禁用</button>
                    <div class="rm-dropdown rm-dropdown-up rm-move-wrap">
                        <button type="button" class="menu_button menu_button_sub rm-dropdown-trigger">移至 ▾</button>
                        <div class="rm-dropdown-content">
                            <div class="rm-dropdown-item" data-batch="move-global">移至全局</div>
                            <div class="rm-dropdown-item" data-batch="move-local">移至局部</div>
                            <div class="rm-dropdown-item" data-batch="move-preset">移至预设</div>
                        </div>
                    </div>
                    <div class="rm-dropdown rm-dropdown-up rm-move-wrap">
                        <button type="button" class="menu_button menu_button_sub rm-dropdown-trigger">操作 ▾</button>
                        <div class="rm-dropdown-content">
                            <div class="rm-dropdown-item" data-batch="export-bundle">打包导出</div>
                            <div class="rm-dropdown-item" data-batch="export-individual">逐个导出</div>
                            <div class="rm-dropdown-item danger" data-batch="delete">删除选中</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const popup = new SillyTavern.Popup(content, SillyTavern.POPUP_TYPE.DISPLAY, null, { wider: true });
        popup.show();

        // 去掉酒馆外层 dialog 的背景/边框/内边距，避免“窗中窗”，只保留我们的卡片
        try {
            const rootEl = $(popup.dlg).find('#regex-manager-v10')[0];
            let el = rootEl ? rootEl.parentElement : null;
            while (el && el !== popup.dlg) {
                el.style.padding = '0'; el.style.margin = '0'; el.style.background = 'transparent';
                el = el.parentElement;
            }
            $(popup.dlg).css({ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0', overflow: 'visible' });
            // 隐藏酒馆自带的右上角关闭叉（我们用卡片内的 ✕）
            $(popup.dlg).find('.popup-button-close').hide();
        } catch (e) {}

        const mainList = $(popup.dlg).find('#rm-main-list')[0];
        const subHeader = $(popup.dlg).find('#rm-subheader')[0];
        const cardEl = $(popup.dlg).find('#regex-manager-v10')[0];
        const renderListOnly = () => { if (currentTab === 'groups') renderGroups(mainList, null); else renderRegexes(mainList, null); };

        const refreshTab = async () => {
            if (currentTab === 'groups') {
                await renderGroups(mainList, subHeader);
                $(popup.dlg).find('#rm-footer-groups').show();
                $(popup.dlg).find('#rm-footer-regexes').hide();
            } else {
                await renderRegexes(mainList, subHeader);
                $(popup.dlg).find('#rm-footer-groups').hide();
                $(popup.dlg).find('#rm-footer-regexes').show();
            }
        };

        refreshTab();
        
        // 筛选按钮监听
        $(popup.dlg).on('click', '.rm-filter-btn', function() {
            currentFilter = $(this).data('filter');
            refreshTab();
        });

        // 关闭弹窗
        $(popup.dlg).on('click', '#rm-close', () => popup.complete());

        // 搜索：只重渲染列表（表头/输入框不动，焦点保持）
        $(popup.dlg).on('input', '#rm-search', function() {
            searchQuery = String($(this).val() || '');
            renderListOnly();
        });
        $(popup.dlg).on('click', '.rm-search-clear', function() {
            const inp = $(this).siblings('#rm-search');
            inp.val(''); searchQuery = ''; renderListOnly(); inp.trigger('focus');
        });

        // 打开设置
        $(popup.dlg).on('click', '#rm-settings', async () => { await showSettingsUI(cardEl); refreshTab(); });

        // 切换日夜主题
        $(popup.dlg).on('click', '#rm-theme', function() {
            const root = $(popup.dlg).find('#regex-manager-v10');
            const toLight = !root.hasClass('rm-light');
            root.toggleClass('rm-light', toLight);
            localStorage.setItem(THEME_KEY, toLight ? 'light' : 'dark');
            $(this).html(toLight ? ICON_MOON : ICON_SUN);
        });

        // 切换标签
        $(popup.dlg).on('click', '.rm-tab', function() {
            currentTab = $(this).data('tab');
            $(popup.dlg).find('.rm-tab').removeClass('active');
            $(this).addClass('active');
            refreshTab();
        });

        // 分组切换开关
        $(popup.dlg).on('change', '.group-toggle', async function() {
            const name = $(this).data('name');
            const enabled = $(this).is(':checked');
            await toggleGroup(name, enabled);
            refreshTab();
        });

        // 展开/收起分组（点箭头或分组名）
        $(popup.dlg).on('click', '.rm-expand, .rm-group-name', function(e) {
            e.stopPropagation();
            const name = String($(this).data('group'));
            if (expandedGroups.has(name)) expandedGroups.delete(name); else expandedGroups.add(name);
            refreshTab();
        });

        // 子条目：移出分组
        $(popup.dlg).on('click', '.rm-child-out', async function(e) {
            e.stopPropagation();
            await removeRegexFromGroup($(this).data('id'));
            refreshTab();
        });

        // 子条目：添加正则到本组
        $(popup.dlg).on('click', '.rm-child-add', async function(e) {
            e.stopPropagation();
            await showAddToGroupUI(String($(this).data('group')), String($(this).data('scope')));
            refreshTab();
        });

        // ===== 下拉菜单：克隆到 dialog 顶层并 fixed 定位，彻底绕开滚动容器裁切 =====
        let openMenuEl = null, openMenuTrigger = null;
        const closeMenu = () => {
            if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
            openMenuTrigger = null;
        };
        $(popup.dlg).on('click', '.rm-dropdown-trigger', function(e) {
            e.stopPropagation();
            const parent = $(this).parent()[0];
            const isOpen = openMenuTrigger === parent;
            closeMenu();
            if (isOpen) return;
            const tmpl = parent.querySelector('.rm-dropdown-content');
            if (!tmpl) return;
            const menu = tmpl.cloneNode(true);
            menu.removeAttribute('style');
            menu.style.position = 'fixed';
            menu.style.display = 'block';
            menu.style.zIndex = '100000';
            menu.classList.add('rm-floating-menu');
            (cardEl || popup.dlg).appendChild(menu);
            openMenuEl = menu; openMenuTrigger = parent;
            positionDropdown(this, menu, cardEl);
        });

        // 滚动列表时关闭菜单（fixed 菜单不跟随滚动）
        if (mainList) mainList.addEventListener('scroll', closeMenu);

        // 点击菜单与触发器之外关闭
        $(popup.dlg).on('click', function(e) {
            if (!$(e.target).closest('.rm-dropdown-trigger, .rm-floating-menu').length) closeMenu();
        });

        // 分组菜单项操作
        $(popup.dlg).on('click', '.rm-dropdown-item', async function() {
            const action = $(this).data('action');
            const name = $(this).data('name');
            const moveScope = $(this).data('scope');
            closeMenu();
            
            if (action === 'move') {
                await moveGroupScope(name, moveScope);
            } else if (action === 'bind') {
                const groups = await getRegexGroups();
                await showBindWorldbooksUI(name, groups.get(name).scope);
            } else if (action === 'export') {
                await exportGroup(name);
            } else if (action === 'delete') {
                const confirm = await SillyTavern.callGenericPopup(`确定要永久解散分组 "${name}" 吗？`, SillyTavern.POPUP_TYPE.CONFIRM);
                if (confirm) await deleteGroup(name);
            }
            refreshTab();
        });

        // 点击铅笔重命名（分组 / 单条正则）
        $(popup.dlg).on('click', '.rm-edit-icon', async function(e) {
            e.stopPropagation();
            const type = $(this).data('edit');
            if (type === 'group') {
                const name = String($(this).data('name'));
                const newName = await SillyTavern.callGenericPopup('请输入新名称：', SillyTavern.POPUP_TYPE.INPUT, name);
                if (newName && newName.trim() && newName !== name) { await renameGroup(name, newName.trim()); refreshTab(); }
            } else {
                const id = $(this).data('id');
                const cur = $(this).siblings('.rm-name').text();
                const newName = await SillyTavern.callGenericPopup('请输入新名称：', SillyTavern.POPUP_TYPE.INPUT, cur);
                if (newName && newName.trim() && newName !== cur) { await renameRegex(id, newName.trim()); refreshTab(); }
            }
        });

        // 单个正则切换开关
        $(popup.dlg).on('change', '.regex-toggle', async function() {
            const id = $(this).data('id');
            const enabled = $(this).is(':checked');
            await TavernHelper.updateTavernRegexesWith(regexes =>
                regexes.map(r => r.id === id ? { ...r, enabled } : r),
                { scope: 'all' }
            );
            await updatePresetRegexesWith(scripts =>
                scripts.map(s => s.id === id ? { ...s, disabled: !enabled } : s)
            );
            toastr.success(`正则已${enabled ? '启用' : '禁用'}`);
        });

        // 底部按钮
        $(popup.dlg).on('click', '#btn-create-group', async () => { showCreateGroupUI(); popup.complete(); });
        $(popup.dlg).on('click', '#btn-import', async () => {
            await showImportToGroupUI();
            refreshTab();
        });

        // 全选 / 取消全选（单一 checkbox）
        $(popup.dlg).on('change', '#sel-all-cb', function() {
            $(popup.dlg).find('.regex-sel').prop('checked', $(this).is(':checked'));
        });

        // 按作用域导入正则
        $(popup.dlg).on('click', '#btn-import-scope', async () => {
            await importRegexesWithScope();
            refreshTab();
        });

        // 正则批量操作
        $(popup.dlg).on('click', '[data-batch]', async function() {
            closeMenu();
            const ids = $(popup.dlg).find('.regex-sel:checked').map((_, el) => $(el).data('id')).get();
            if (ids.length === 0) return toastr.warning('请先勾选正则');
            const batch = $(this).data('batch');
            if (batch === 'enable') await toggleSelectedRegexes(ids, true);
            else if (batch === 'disable') await toggleSelectedRegexes(ids, false);
            else if (batch === 'move-global') await moveSelectedRegexes(ids, 'global');
            else if (batch === 'move-local') await moveSelectedRegexes(ids, 'character');
            else if (batch === 'move-preset') await moveSelectedRegexes(ids, 'preset');
            else if (batch === 'export-bundle') await exportSelectedRegexes(ids);
            else if (batch === 'export-individual') await exportSelectedRegexesIndividual(ids);
            else if (batch === 'delete') {
                const confirm = await SillyTavern.callGenericPopup(`确定删除选中的 ${ids.length} 条正则吗？`, SillyTavern.POPUP_TYPE.CONFIRM);
                if (confirm) await deleteSelectedRegexes(ids);
            }
            refreshTab();
        });
    }

    // --- 预设正则写入层 (酒馆原生 Preset Scripts) ---
    // 对所有含 regex_scripts 的预设执行 transformer 并写回（仅在内容变化时写）
    async function updatePresetRegexesWith(transformer) {
        const ctx = SillyTavern.getContext();
        const apis = ['openai', 'textgenerationwebui', 'kobold', 'novel'];
        for (const api of apis) {
            let mgr;
            try { mgr = ctx.getPresetManager(api); } catch (e) { continue; }
            if (!mgr || typeof mgr.readPresetExtensionField !== 'function' || typeof mgr.writePresetExtensionField !== 'function') continue;
            let scripts;
            try { scripts = mgr.readPresetExtensionField({ path: 'regex_scripts' }); } catch (e) { continue; }
            if (!Array.isArray(scripts) || scripts.length === 0) continue;
            const before = JSON.stringify(scripts);
            const next = transformer(scripts.map(s => ({ ...s })));
            if (!Array.isArray(next) || JSON.stringify(next) === before) continue;
            try { mgr.writePresetExtensionField({ path: 'regex_scripts', value: next }); }
            catch (e) { console.warn('Regex Manager: 写入预设正则失败', e); }
        }
    }

    // 向当前激活预设追加正则
    async function appendToPresetRegexes(newScripts) {
        if (!newScripts || !newScripts.length) return;
        const ctx = SillyTavern.getContext();
        const mgr = ctx.getPresetManager('openai');
        if (!mgr || typeof mgr.writePresetExtensionField !== 'function') return;
        let scripts = [];
        try { scripts = mgr.readPresetExtensionField({ path: 'regex_scripts' }) || []; } catch (e) {}
        if (!Array.isArray(scripts)) scripts = [];
        try { mgr.writePresetExtensionField({ path: 'regex_scripts', value: [...scripts, ...newScripts] }); }
        catch (e) { console.warn('Regex Manager: 追加预设正则失败', e); }
    }

    // 预设正则(驼峰 disabled) <-> 酒馆正则(下划线 enabled) 格式互转
    // placement: 1=用户输入 2=AI输出 3=斜杠命令 5=世界书
    function presetToTavern(s, targetScope) {
        const placement = Array.isArray(s.placement) ? s.placement : [2];
        return {
            id: s.id || SillyTavern.uuidv4(),
            scope: targetScope,
            script_name: s.scriptName || s.script_name || '未命名',
            find_regex: s.findRegex || s.find_regex || '',
            replace_string: s.replaceString ?? s.replace_string ?? '',
            enabled: !s.disabled,
            source: {
                user_input: placement.includes(1),
                ai_output: placement.includes(2),
                slash_command: placement.includes(3),
                world_info: placement.includes(5)
            },
            destination: { display: !s.promptOnly, prompt: !s.markdownOnly }
        };
    }
    function tavernToPreset(r) {
        const src = r.source || {};
        const placement = [];
        if (src.user_input) placement.push(1);
        if (src.ai_output) placement.push(2);
        if (src.slash_command) placement.push(3);
        if (src.world_info) placement.push(5);
        if (placement.length === 0) placement.push(2);
        const dest = r.destination || {};
        return {
            id: r.id || SillyTavern.uuidv4(),
            scriptName: r.script_name || r.scriptName || '未命名',
            findRegex: r.find_regex || r.findRegex || '',
            replaceString: r.replace_string ?? r.replaceString ?? '',
            trimStrings: r.trim_strings || r.trimStrings || [],
            placement,
            disabled: !r.enabled,
            markdownOnly: dest.prompt === false,
            promptOnly: dest.display === false,
            runOnEdit: r.run_on_edit !== false,
            substituteRegex: r.substitute_regex || 0,
            minDepth: r.min_depth ?? null,
            maxDepth: r.max_depth ?? null
        };
    }

    // 跨作用域移动：matchFn 同时兼容预设(scriptName)与酒馆(script_name)格式
    async function moveRegexes(matchFn, targetScope) {
        const movedToTavern = [];
        if (targetScope !== 'preset') {
            await updatePresetRegexesWith(scripts => {
                const keep = [];
                scripts.forEach(s => { if (matchFn(s)) movedToTavern.push(presetToTavern(s, targetScope)); else keep.push(s); });
                return keep;
            });
        }
        if (targetScope === 'preset') {
            const movedToPreset = [];
            await TavernHelper.updateTavernRegexesWith(regexes => {
                const keep = [];
                regexes.forEach(r => { if (matchFn(r)) movedToPreset.push(tavernToPreset(r)); else keep.push(r); });
                return keep;
            }, { scope: 'all' });
            await appendToPresetRegexes(movedToPreset);
        } else {
            await TavernHelper.updateTavernRegexesWith(regexes => {
                const updated = regexes.map(r => matchFn(r) ? { ...r, scope: targetScope } : r);
                return [...updated, ...movedToTavern];
            }, { scope: 'all' });
        }
    }

    // --- 核心逻辑函数 ---
    async function toggleGroup(groupName, isEnabled) {
        toastr.info(`正在切换分组 "${groupName}"...`);
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(regex => parseGroupName(regex.script_name) === groupName ? { ...regex, enabled: isEnabled } : regex),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => parseGroupName(s.scriptName) === groupName ? { ...s, disabled: !isEnabled } : s)
        );
        const groups = await getRegexGroups();
        const group = groups.get(groupName);
        if (group && group.worldbooks.length > 0) {
            let current = getGlobalWorldbookNames();
            if (isEnabled) current = [...new Set([...current, ...group.worldbooks])];
            else current = current.filter(w => !group.worldbooks.includes(w));
            rebindGlobalWorldbooks(current);
        }
        toastr.success(`分组已${isEnabled ? '开启' : '关闭'}`);
    }

    async function deleteGroup(groupName) {
        await TavernHelper.updateTavernRegexesWith(existing => 
            existing.map(regex => {
                if (parseGroupName(regex.script_name) === groupName) {
                    return { ...regex, script_name: stripPrefix(regex.script_name) };
                }
                return regex;
            }),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => parseGroupName(s.scriptName) === groupName ? { ...s, scriptName: stripPrefix(s.scriptName) } : s)
        );
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete data[groupName];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        toastr.success(`分组 "${groupName}" 已解散（规则已保留）`);
    }

    async function moveGroupScope(groupName, targetScope) {
        if (targetScope === 'character' && !hasActiveCharacter()) return toastr.warning('当前未进入任何角色，无法移至局部');
        await moveRegexes(o => parseGroupName(o.scriptName || o.script_name) === groupName, targetScope);
        const label = targetScope === 'global' ? '全局' : (targetScope === 'preset' ? '预设' : '局部');
        toastr.success(`已移至${label}`);
    }

    async function renameGroup(oldName, newName) {
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(regex => {
                if (parseGroupName(regex.script_name) === oldName) {
                    const sp = splitPrefix(regex.script_name);
                    if (sp) return { ...regex, script_name: `${sp.open}${newName}${sp.close} ${sp.rest}`.trim() };
                }
                return regex;
            }), { scope: 'all' });
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => {
                if (parseGroupName(s.scriptName) === oldName) {
                    const sp = splitPrefix(s.scriptName);
                    if (sp) return { ...s, scriptName: `${sp.open}${newName}${sp.close} ${sp.rest}`.trim() };
                }
                return s;
            })
        );
        const worldbooks = getGroupWorldbooks(oldName);
        setGroupWorldbooks(newName, worldbooks);
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete data[oldName];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    async function exportGroup(groupName) {
        const groups = await getRegexGroups();
        const group = groups.get(groupName);
        if (!group) return;
        const regexes = group.regexes.map(r => {
            const { id, ...obj } = tavernToPreset(r);
            return obj;
        });
        // 把 worldbooks 附在第一个元素上（ST 导入时会忽略未知字段，插件导入时可读取）
        if (regexes.length > 0 && group.worldbooks && group.worldbooks.length > 0) {
            regexes[0].__worldbooks__ = group.worldbooks;
        }
        triggerDownload(
            new Blob([JSON.stringify(regexes, null, 2)], { type: 'application/json' }),
            `${safeFileName(groupName)} (${regexes.length}条).json`
        );
    }

    // --- 导入相关逻辑 ---
    function triggerFileInput({ multiple = false, accept = '.json' }) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file'; input.multiple = multiple; input.accept = accept;
            input.onchange = (e) => resolve(e.target.files);
            input.click();
        });
    }

    async function processImport(regexDataArray, defaultGroupName, worldbooks = []) {
        const finalGroupName = await SillyTavern.callGenericPopup('请输入新分组名称：', SillyTavern.POPUP_TYPE.INPUT, defaultGroupName);
        if (!finalGroupName) return;

        const newRegexes = regexDataArray.map(item => ({
            id: SillyTavern.uuidv4(),
            scope: 'global',
            script_name: `${makePrefix(finalGroupName)} ${stripPrefix(item.script_name || item.scriptName || '未命名')}`,
            find_regex: item.find_regex || item.findRegex || '^$',
            replace_string: item.replace_string ?? item.replaceString ?? '',
            enabled: true,
            source: { user_input: true, ai_output: true, slash_command: false, world_info: false },
            destination: { display: true, prompt: true }
        }));

        await TavernHelper.updateTavernRegexesWith(async existing => {
            const others = existing.filter(r => parseGroupName(r.script_name) !== finalGroupName);
            return [...others, ...newRegexes];
        }, { scope: 'all' });
        setGroupWorldbooks(finalGroupName, worldbooks);
        toastr.success('导入成功');
    }

    async function importAndCreateGroup() {
        const files = await triggerFileInput({ multiple: true });
        if (!files) return;
        let allRegexes = [];
        for (const file of files) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const r = Array.isArray(parsed) ? parsed : (parsed.regexes || [parsed]);
            allRegexes = allRegexes.concat(r);
        }
        await processImport(allRegexes, 'Imported');
    }

    async function importGroupPackage() {
        const files = await triggerFileInput({ multiple: false });
        if (!files) return;
        const text = await files[0].text();
        const parsed = JSON.parse(text);
        let regexes, worldbooks = [];
        if (Array.isArray(parsed)) {
            regexes = parsed;
            if (parsed.length > 0 && Array.isArray(parsed[0].__worldbooks__)) {
                worldbooks = parsed[0].__worldbooks__;
            }
        } else {
            regexes = parsed.regexes || [];
            worldbooks = parsed.worldbooks || [];
        }
        await processImport(regexes, files[0].name.replace('.json', ''), worldbooks);
    }

    // --- 批量正则管理 ---
    async function toggleSelectedRegexes(ids, isEnabled) {
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(r => ids.includes(r.id) ? { ...r, enabled: isEnabled } : r),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => ids.includes(s.id) ? { ...s, disabled: !isEnabled } : s)
        );
    }
    async function deleteSelectedRegexes(ids) {
        await TavernHelper.updateTavernRegexesWith(existing => existing.filter(r => !ids.includes(r.id)), { scope: 'all' });
        await updatePresetRegexesWith(scripts => scripts.filter(s => !ids.includes(s.id)));
    }
    // 批量导出选中的正则为 JSON 文件（兼容全局/局部/预设的字段命名）
    function safeFileName(name, maxLen = 50) {
        return (name || '未命名').replace(/[/\\?%*:|"<>\n\r]/g, '_').trim().slice(0, maxLen) || '未命名';
    }
    function regexToExportObj(r) {
        const { id, ...rest } = tavernToPreset(r);
        return rest;
    }
    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }
    // 打包导出：所有选中正则合为一个 JSON 文件
    async function exportSelectedRegexes(ids) {
        const all = await getAllRegexes();
        const sel = all.filter(r => ids.includes(r.id));
        if (!sel.length) return toastr.warning('没有可导出的正则');
        const firstName = safeFileName(sel[0].script_name || sel[0].scriptName);
        const filename = sel.length === 1 ? `${firstName}.json` : `${firstName}等${sel.length}条.json`;
        const blob = new Blob([JSON.stringify(sel.map(regexToExportObj), null, 2)], { type: 'application/json' });
        triggerDownload(blob, filename);
        toastr.success(`已打包导出 ${sel.length} 条正则`);
    }
    // 逐个导出：每条正则单独一个文件
    async function exportSelectedRegexesIndividual(ids) {
        const all = await getAllRegexes();
        const sel = all.filter(r => ids.includes(r.id));
        if (!sel.length) return toastr.warning('没有可导出的正则');
        for (const r of sel) {
            const blob = new Blob([JSON.stringify(regexToExportObj(r), null, 2)], { type: 'application/json' });
            triggerDownload(blob, `${safeFileName(r.script_name || r.scriptName)}.json`);
            await new Promise(res => setTimeout(res, 80));
        }
        toastr.success(`已逐个导出 ${sel.length} 条正则`);
    }
    async function moveSelectedRegexes(ids, targetScope) {
        if (targetScope === 'character' && !hasActiveCharacter()) return toastr.warning('当前未进入任何角色，无法移至局部');
        const idSet = new Set(ids);
        await moveRegexes(o => idSet.has(o.id), targetScope);
    }
    async function renameRegex(id, newName) {
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(r => r.id === id ? { ...r, script_name: newName } : r),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => s.id === id ? { ...s, scriptName: newName } : s)
        );
    }

    // 把单条正则移出其所在分组（去掉前缀，保留规则与作用域）
    async function removeRegexFromGroup(id) {
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(r => r.id === id ? { ...r, script_name: stripPrefix(r.script_name) } : r),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => s.id === id ? { ...s, scriptName: stripPrefix(s.scriptName) } : s)
        );
    }

    // 把若干正则加入某分组：先对齐到该组作用域，再加 [分组] 前缀
    async function addRegexesToGroup(ids, groupName, groupScope) {
        if (groupScope === 'character' && !hasActiveCharacter()) return toastr.warning('当前未进入任何角色，无法加入局部分组');
        const idSet = new Set(ids);
        await moveRegexes(o => idSet.has(o.id), groupScope);
        const addPrefix = (nm) => `${makePrefix(groupName)} ${stripPrefix(nm)}`;
        await TavernHelper.updateTavernRegexesWith(regexes =>
            regexes.map(r => idSet.has(r.id) ? { ...r, script_name: addPrefix(r.script_name) } : r),
            { scope: 'all' }
        );
        await updatePresetRegexesWith(scripts =>
            scripts.map(s => idSet.has(s.id) ? { ...s, scriptName: addPrefix(s.scriptName) } : s)
        );
    }

    // 选择已有正则加入分组
    async function showAddToGroupUI(groupName, groupScope) {
        const all = await getAllRegexes();
        const candidates = all.filter(r => parseGroupName(r.script_name) !== groupName);
        if (!candidates.length) return toastr.info('没有可添加的正则');
        const rows = candidates.map(r => `
            <div class="rm-list-row">
                <label>
                    <input type="checkbox" class="rm-check-round add-sel" data-id="${r.id}">
                    <span class="scope-tag scope-${r.scope}">${scopeLabelOf(r.scope)}</span>
                    <span>${r.script_name}</span>
                </label>
            </div>`).join('');
        const content = `<style>${CSS_STYLES}</style>
            <div class="rm-root ${rmThemeClass()}">
                <div class="rm-section-title">添加正则到「${groupName}」</div>
                <button type="button" class="rm-focus-trap" tabindex="0" aria-hidden="true"></button>
                <div class="rm-search-wrap"><input type="text" class="rm-search-input rm-popup-search" placeholder="搜索…"><span class="rm-search-clear">✕</span></div>
                <div class="rm-list-box">${rows}</div>
            </div>`;
        const addPopup = new SillyTavern.Popup(content, "text", null, {
            okButton: '添加', cancelButton: '取消', wider: true,
            async onClosing(p) {
                if (p.result === SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
                    const ids = $(p.dlg).find('.add-sel:checked').map((_, el) => $(el).data('id')).get();
                    if (ids.length) { await addRegexesToGroup(ids, groupName, groupScope); toastr.success(`已添加 ${ids.length} 条到「${groupName}」`); }
                }
                return true;
            }
        });
        addPopup.show();
        attachListSearch(addPopup);
    }

    // 选择导入作用域（全局/预设/局部），返回 'global'|'preset'|'character'|null
    async function chooseScope() {
        const html = `<style>${CSS_STYLES}</style>
            <div class="rm-root ${rmThemeClass()}" style="position: relative; background: var(--rm-bg); border-radius: 14px; padding: 22px; box-shadow: var(--rm-shadow);">
                <div class="rm-popup-header"><span class="rm-section-title">导入到哪个类别？</span><div class="rm-popup-close" title="关闭">${ICON_CLOSE}</div></div>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button type="button" class="rm-mini-btn rm-scope-pick" data-scope="global">全局</button>
                    <button type="button" class="rm-mini-btn rm-scope-pick" data-scope="preset">预设</button>
                    <button type="button" class="rm-mini-btn rm-scope-pick" data-scope="character">局部</button>
                </div>
            </div>`;
        const p = new SillyTavern.Popup(html, SillyTavern.POPUP_TYPE.DISPLAY, '', { wider: false });
        const pr = p.show();
        // 去掉酒馆外层 dialog 的背景/边框/自带关闭叉，保持与主面板一致
        try {
            const rootEl = $(p.dlg).find('.rm-root')[0];
            let el = rootEl ? rootEl.parentElement : null;
            while (el && el !== p.dlg) { el.style.padding = '0'; el.style.margin = '0'; el.style.background = 'transparent'; el = el.parentElement; }
            $(p.dlg).css({ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0' });
            $(p.dlg).find('.popup-button-close').hide();
        } catch (e) {}
        let picked = null;
        $(p.dlg).on('click', '.rm-scope-pick', function() { picked = $(this).data('scope'); p.complete(); });
        $(p.dlg).on('click', '.rm-popup-close', function() { p.complete(); });
        await pr;
        return picked;
    }

    // ===== 设置面板 =====
    // 计算：若识别符号改为 newDefault + newExtra，有多少现有分组会不再被识别
    async function bracketChangeAffected(newDefault, newExtra) {
        const newSet = new Set([newDefault, ...newExtra]);
        const all = await getAllRegexes();
        const lost = new Set();
        for (const r of all) {
            const sp = splitPrefix(r.script_name);
            if (sp && !newSet.has(sp.open + sp.close)) lost.add((sp.open + sp.close) + '|' + sp.inner);
        }
        return lost.size;
    }
    // 应用标签更改：若有分组将失效则先确认。返回是否已应用
    async function applyBracketChange(newDefault, newExtra) {
        const n = await bracketChangeAffected(newDefault, newExtra);
        if (n > 0) {
            const ok = await SillyTavern.callGenericPopup(`此更改后将有 ${n} 个分组不再被识别为分组（组内正则不会被删除，只是变回未分组）。确认更改吗？`, SillyTavern.POPUP_TYPE.CONFIRM);
            if (!ok) return false;
        }
        localStorage.setItem(BRACKET_DEFAULT_KEY, newDefault);
        localStorage.setItem(BRACKET_EXTRA_KEY, JSON.stringify(newExtra));
        return true;
    }

    function settingsBodyHtml() {
        const scale = fontScale();
        const pct = Math.round(scale * 100);
        const ep = getEntryPoint();
        const def = getDefaultBracketStr();
        const extra = getExtraBrackets();
        const palette = bracketPalette();
        const customs = bracketCustoms();
        const isCustom = (p) => customs.includes(p) && !BASE_BRACKETS.includes(p);
        const chipDel = (p) => isCustom(p) ? `<span class="rm-chip-del" data-del-pair="${escHtml(p)}" title="删除">✕</span>` : '';
        const defChips = palette.map(p => `<span class="rm-chip ${p === def ? 'active' : ''}" data-role="default" data-pair="${escHtml(p)}">${escHtml(p)}${chipDel(p)}</span>`).join('');
        const extraChips = palette.filter(p => p !== def).map(p => `<span class="rm-chip ${extra.includes(p) ? 'active' : ''}" data-role="extra" data-pair="${escHtml(p)}">${escHtml(p)}${chipDel(p)}</span>`).join('');
        return `
            <div class="rm-set-section">
                <div class="rm-set-row"><span class="rm-set-label">字体大小</span><span class="rm-set-val" id="rm-font-val">${pct}%</span><span class="rm-set-reset" id="rm-font-reset">重置</span></div>
                <input type="range" id="rm-font-slider" class="rm-range" min="0.8" max="1.3" step="0.05" value="${scale}">
            </div>
            <div class="rm-set-section">
                <div class="rm-set-row"><span class="rm-set-label">默认标签（新建分组使用）</span><span class="rm-set-reset" id="rm-bracket-reset">重置</span></div>
                <div class="rm-chip-row">${defChips}</div>
                <div class="rm-set-label" style="margin-top:12px; margin-bottom:8px;">额外识别标签</div>
                <div class="rm-chip-row">${extraChips}</div>
                <div class="rm-set-row" style="margin-top:12px; gap:8px;">
                    <input type="text" id="rm-bracket-input" class="rm-search-input" style="margin:0; flex:1;" placeholder="恰好2个符号，如 〔〕｜｜" maxlength="2">
                    <button type="button" class="rm-mini-btn" id="rm-bracket-add">添加</button>
                </div>
            </div>
            <div class="rm-set-section">
                <div class="rm-set-row"><span class="rm-set-label">入口位置</span><span class="rm-set-val">更改后需刷新页面生效</span></div>
                <div class="rm-chip-row">
                    <span class="rm-chip ${ep === 'quickreply' ? 'active' : ''}" data-role="entry" data-ep="quickreply">快捷回复栏</span>
                    <span class="rm-chip ${ep === 'extensions' ? 'active' : ''}" data-role="entry" data-ep="extensions">魔法棒菜单</span>
                </div>
            </div>`;
    }
    async function showSettingsUI(mainEl) {
        const html = `<style>${CSS_STYLES}</style>
            <div class="rm-root ${rmThemeClass()}" style="background:var(--rm-bg); border-radius:14px; padding:18px; box-shadow:var(--rm-shadow); min-width:300px;">
                <div class="rm-popup-header"><span class="rm-section-title">设置</span><div class="rm-popup-close" title="关闭">${ICON_CLOSE}</div></div>
                <div id="rm-settings-body">${settingsBodyHtml()}</div>
            </div>`;
        const p = new SillyTavern.Popup(html, SillyTavern.POPUP_TYPE.DISPLAY, '', {});
        const pr = p.show();
        stripPopupChrome(p);
        $(p.dlg).find('.rm-root').css('--rm-font-scale', fontScale());
        const body = $(p.dlg).find('#rm-settings-body')[0];
        const rerender = () => { if (body) body.innerHTML = settingsBodyHtml(); };
        const applyScale = (v) => {
            saveFontScale(v);
            applyFontScale();
            $(p.dlg).find('#rm-font-val').text(Math.round(v * 100) + '%');
            $(p.dlg).find('.rm-root').css('--rm-font-scale', v);
            if (mainEl) mainEl.style.setProperty('--rm-font-scale', v);
        };
        $(p.dlg).on('input', '#rm-font-slider', function() {
            applyScale(parseFloat($(this).val()));
        });
        $(p.dlg).on('click', '#rm-font-reset', function() {
            applyScale(DEFAULT_FONT_SCALE); rerender();
        });
        $(p.dlg).on('click', '.rm-chip[data-role="default"]', async function(e) {
            if ($(e.target).hasClass('rm-chip-del')) return;
            const pair = String($(this).attr('data-pair'));
            if (pair === getDefaultBracketStr()) return;
            if (await applyBracketChange(pair, getExtraBrackets().filter(x => x !== pair))) rerender();
        });
        $(p.dlg).on('click', '.rm-chip[data-role="extra"]', async function(e) {
            if ($(e.target).hasClass('rm-chip-del')) return;
            const pair = String($(this).attr('data-pair'));
            let ex = getExtraBrackets();
            ex = ex.includes(pair) ? ex.filter(x => x !== pair) : [...ex, pair];
            if (await applyBracketChange(getDefaultBracketStr(), ex)) rerender();
        });
        $(p.dlg).on('click', '.rm-chip-del', function(e) {
            e.stopPropagation();
            const pair = String($(this).attr('data-del-pair'));
            const newCustoms = bracketCustoms().filter(c => c !== pair);
            localStorage.setItem(BRACKET_CUSTOMS_KEY, JSON.stringify(newCustoms));
            if (getDefaultBracketStr() === pair) localStorage.setItem(BRACKET_DEFAULT_KEY, DEFAULT_BRACKET);
            localStorage.setItem(BRACKET_EXTRA_KEY, JSON.stringify(getExtraBrackets().filter(x => x !== pair)));
            rerender();
        });
        $(p.dlg).on('click', '#rm-bracket-add', function() {
            const v = String($(p.dlg).find('#rm-bracket-input').val() || '').trim();
            if (v.length !== 2) return toastr.warning('请输入恰好两个字符');
            if (/[a-zA-Z0-9_\s]/.test(v)) return toastr.warning('不能包含字母、数字、下划线或空格');
            if (bracketPalette().includes(v)) return toastr.info(`标签「${v}」已存在`);
            if (v[0] === v[1]) toastr.info(`已添加同字符标签「${v}」，若脚本名中含有该符号可能误识别`);
            localStorage.setItem(BRACKET_CUSTOMS_KEY, JSON.stringify([...bracketCustoms(), v]));
            $(p.dlg).find('#rm-bracket-input').val('');
            rerender();
        });
        $(p.dlg).on('click', '#rm-bracket-reset', async function() {
            if (await applyBracketChange(DEFAULT_BRACKET, [])) rerender();
        });
        $(p.dlg).on('click', '.rm-chip[data-role="entry"]', function() {
            saveEntryPoint(String($(this).attr('data-ep')));
            rerender();
        });
        $(p.dlg).on('click', '.rm-popup-close', () => p.complete());
        await pr;
    }

    // 选作用域 → 选文件 → 导入
    async function importRegexesWithScope() {
        const scope = await chooseScope();
        if (!scope) return;
        const files = await triggerFileInput({ multiple: true });
        if (!files || !files.length) return;
        let items = [];
        for (const f of files) {
            try {
                const parsed = JSON.parse(await f.text());
                const arr = Array.isArray(parsed) ? parsed : (parsed.regexes || [parsed]);
                items = items.concat(arr);
            } catch (e) { console.warn('Regex Manager: 导入文件解析失败', f.name, e); }
        }
        if (!items.length) return toastr.warning('没有可导入的正则');

        if (scope === 'preset') {
            const newScripts = items.map(it => tavernToPreset({
                id: SillyTavern.uuidv4(),
                script_name: it.script_name || it.scriptName || '未命名',
                find_regex: it.find_regex || it.findRegex || '',
                replace_string: it.replace_string ?? it.replaceString ?? '',
                enabled: it.disabled !== undefined ? !it.disabled : (it.enabled !== false),
                source: { user_input: true, ai_output: true, slash_command: false, world_info: false },
                destination: { display: true, prompt: true }
            }));
            await appendToPresetRegexes(newScripts);
        } else {
            const newRegexes = items.map(it => ({
                id: SillyTavern.uuidv4(),
                scope,
                script_name: it.script_name || it.scriptName || '未命名',
                find_regex: it.find_regex || it.findRegex || '^$',
                replace_string: it.replace_string ?? it.replaceString ?? '',
                enabled: true,
                source: { user_input: true, ai_output: true, slash_command: false, world_info: false },
                destination: { display: true, prompt: true }
            }));
            await TavernHelper.updateTavernRegexesWith(existing => [...existing, ...newRegexes], { scope: 'all' });
        }
        toastr.success(`已导入 ${items.length} 条到${scopeLabelOf(scope)}`);
    }

    // 把若干正则写入某分组（加 [分组] 前缀，按指定作用域分配）
    async function importIntoGroup(groupName, scope, items) {
        if (scope === 'preset') {
            const newScripts = items.map(it => tavernToPreset({
                id: SillyTavern.uuidv4(),
                script_name: `${makePrefix(groupName)} ${it.script_name || it.scriptName || '未命名'}`,
                find_regex: it.find_regex || it.findRegex || '',
                replace_string: it.replace_string ?? it.replaceString ?? '',
                enabled: it.disabled !== undefined ? !it.disabled : (it.enabled !== false),
                source: { user_input: true, ai_output: true, slash_command: false, world_info: false },
                destination: { display: true, prompt: true }
            }));
            await appendToPresetRegexes(newScripts);
        } else {
            const newRegexes = items.map(it => ({
                id: SillyTavern.uuidv4(), scope,
                script_name: `${makePrefix(groupName)} ${it.script_name || it.scriptName || '未命名'}`,
                find_regex: it.find_regex || it.findRegex || '^$',
                replace_string: it.replace_string ?? it.replaceString ?? '',
                enabled: true,
                source: { user_input: true, ai_output: true, slash_command: false, world_info: false },
                destination: { display: true, prompt: true }
            }));
            await TavernHelper.updateTavernRegexesWith(existing => [...existing, ...newRegexes], { scope: 'all' });
        }
    }

    // 选择目标分组 → 选文件 → 导入（新正则自动继承该分组的作用域）
    async function showImportToGroupUI() {
        const groupsMap = await getRegexGroups();
        const groups = Array.from(groupsMap.entries()).sort((a, b) => byScope(a[1].scope, b[1].scope));
        const rows = groups.map(([name, data]) => `
            <button type="button" class="rm-import-pick rm-list-row" data-name="${name}" data-scope="${data.scope}" style="display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; cursor:pointer; text-align:left;">
                <span class="scope-tag scope-${data.scope}">${scopeLabelOf(data.scope)}</span>
                <span class="rm-name">${name}</span>
                <span class="rm-meta">${data.regexes.length}</span>
            </button>`).join('');
        const html = `<style>${CSS_STYLES}</style>
            <div class="rm-root ${rmThemeClass()}" style="position:relative; background:var(--rm-bg); border-radius:14px; padding:18px; box-shadow:var(--rm-shadow);">
                <div class="rm-popup-header"><span class="rm-section-title">导入到哪个分组？</span><div class="rm-popup-close" title="关闭">${ICON_CLOSE}</div></div>
                <div class="rm-list-box" style="margin-bottom:10px;">${rows || '<div class="rm-empty" style="margin-top:16px;">暂无分组</div>'}</div>
                <button type="button" class="rm-mini-btn" id="rm-import-newgroup" style="width:100%;">＋ 新建分组导入</button>
            </div>`;
        const p = new SillyTavern.Popup(html, SillyTavern.POPUP_TYPE.DISPLAY, '', {});
        const pr = p.show();
        stripPopupChrome(p);
        let target = null;
        $(p.dlg).on('click', '.rm-import-pick', function() { target = { name: $(this).data('name'), scope: String($(this).data('scope')) }; p.complete(); });
        $(p.dlg).on('click', '#rm-import-newgroup', function() { target = '__new__'; p.complete(); });
        $(p.dlg).on('click', '.rm-popup-close', function() { p.complete(); });
        await pr;
        if (!target) return;

        let groupName, scope;
        if (target === '__new__') {
            const name = await SillyTavern.callGenericPopup('新分组名称：', SillyTavern.POPUP_TYPE.INPUT, '新分组');
            if (!name || !name.trim()) return;
            groupName = name.trim();
            scope = await chooseScope();
            if (!scope) return;
        } else {
            groupName = target.name; scope = target.scope;
        }
        if (scope === 'character' && !hasActiveCharacter()) return toastr.warning('当前未进入任何角色，无法导入到局部');

        const files = await triggerFileInput({ multiple: true });
        if (!files || !files.length) return;
        let items = [];
        for (const f of files) {
            try {
                const parsed = JSON.parse(await f.text());
                const arr = Array.isArray(parsed) ? parsed : (parsed.regexes || [parsed]);
                items = items.concat(arr);
            } catch (e) { console.warn('Regex Manager: 导入文件解析失败', f.name, e); }
        }
        if (!items.length) return toastr.warning('没有可导入的正则');
        await importIntoGroup(groupName, scope, items);
        toastr.success(`已导入 ${items.length} 条到「${groupName}」(${scopeLabelOf(scope)})`);
    }

    // --- 绑定世界书 UI ---
    function showBindWorldbooksUI(groupName, scope) {
        const allWb = getWorldbookNames();
        const currentWb = getGroupWorldbooks(groupName);
        const bound = allWb.filter(w => currentWb.includes(w));
        const unbound = allWb.filter(w => !currentWb.includes(w));
        const row = (w, checked) => `
            <div class="rm-list-row">
                <label>
                    <input type="checkbox" class="rm-check-round wb-sel" data-wb="${w}" ${checked ? 'checked' : ''}> 
                    <span>${w}</span>
                </label>
            </div>`;
        let list = '';
        if (bound.length) list += `<div class="rm-group-label">已绑定</div>` + bound.map(w => row(w, true)).join('');
        list += `<div class="rm-group-label">未绑定</div>` + (unbound.length ? unbound.map(w => row(w, false)).join('') : `<div class="rm-list-row" style="color:var(--rm-text-dim);">（无）</div>`);
        const content = `<style>${CSS_STYLES}</style><div class="rm-root ${rmThemeClass()}"><button type="button" class="rm-focus-trap" tabindex="0" aria-hidden="true"></button><div class="rm-search-wrap"><input type="text" class="rm-search-input rm-popup-search" placeholder="搜索世界书…"><span class="rm-search-clear">✕</span></div><div class="rm-list-box">${list}</div></div>`;
        const wbPopup = new SillyTavern.Popup(content, "text", null, {
            okButton: '保存', cancelButton: '取消', wider: true,
            async onClosing(p) {
                if (p.result === SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
                    const selected = $(p.dlg).find('.wb-sel:checked').map((_, el) => $(el).data('wb')).get();
                    setGroupWorldbooks(groupName, selected);
                    toastr.success('保存成功');
                }
                return true;
            }
        });
        const wbPr = wbPopup.show();
        attachListSearch(wbPopup);
        return wbPr;
    }

    // --- 从未分组创建 UI ---
    async function showCreateGroupUI() {
        const all = await getAllRegexes();
        const ungrouped = all.filter(r => !parseGroupName(r.script_name));
        if (ungrouped.length === 0) return toastr.info('没有未分组正则');
        
        let list = ungrouped.map(r => `
            <div class="rm-list-row">
                <label>
                    <input type="checkbox" class="rm-check-round c-sel" data-id="${r.id}"> 
                    <span class="scope-tag scope-${r.scope}">${scopeLabelOf(r.scope)}</span>
                    <span>${r.script_name}</span>
                </label>
            </div>
        `).join('');
        const content = `
            <style>${CSS_STYLES}</style>
            <div class="rm-root ${rmThemeClass()}" style="background: var(--rm-bg); border-radius: 14px; padding: 18px; box-shadow: var(--rm-shadow);">
                <div class="rm-popup-header"><span class="rm-section-title">选择归入新分组的正则</span><div class="rm-popup-close" title="关闭">${ICON_CLOSE}</div></div>
                <button type="button" class="rm-focus-trap" tabindex="0" aria-hidden="true"></button>
                <div class="rm-search-wrap"><input type="text" class="rm-search-input rm-popup-search" placeholder="搜索…"><span class="rm-search-clear">✕</span></div>
                <div class="rm-list-box">${list}</div>
                <div class="rm-popup-footer">
                    <button type="button" class="rm-btn rm-btn-sub" data-act="cancel">取消</button>
                    <button type="button" class="rm-btn rm-btn-primary" data-act="create" disabled>创建</button>
                </div>
            </div>
        `;
        const createPopup = new SillyTavern.Popup(content, SillyTavern.POPUP_TYPE.DISPLAY, '', { wider: true });
        const createPr = createPopup.show();
        stripPopupChrome(createPopup);
        attachListSearch(createPopup);
        createPr.then(() => showUnifiedUI()); // 关闭后(无论取消/创建)重开主面板
        const dlg = createPopup.dlg;
        const refreshCreateBtn = () => { $(dlg).find('[data-act="create"]').prop('disabled', $(dlg).find('.c-sel:checked').length === 0); };
        $(dlg).on('change', '.c-sel', refreshCreateBtn);
        $(dlg).on('click', '.rm-popup-close, [data-act="cancel"]', () => createPopup.complete());
        $(dlg).on('click', '[data-act="create"]', async function() {
            const ids = $(dlg).find('.c-sel:checked').map((_, el) => $(el).data('id')).get();
            if (ids.length === 0) return;
            const name = await SillyTavern.callGenericPopup('分组名称：', SillyTavern.POPUP_TYPE.INPUT, '新分组');
            if (name && name.trim()) {
                const gn = name.trim();
                await TavernHelper.updateTavernRegexesWith(regexes =>
                    regexes.map(r => ids.includes(r.id) ? { ...r, script_name: `${makePrefix(gn)} ${r.script_name}` } : r),
                    { scope: 'all' }
                );
                await updatePresetRegexesWith(scripts =>
                    scripts.map(s => ids.includes(s.id) ? { ...s, scriptName: `${makePrefix(gn)} ${s.scriptName}` } : s)
                );
                createPopup.complete();
            }
        });
    }

    function renderFilterBar() {
        const filters = [
            { id: 'all', label: '全部' },
            { id: 'global', label: '全局' },
            { id: 'preset', label: '预设' },
            { id: 'character', label: '局部' }
        ];
        return `
            <div class="rm-filter-bar">
                ${filters.map(f => `
                    <div class="rm-filter-btn ${currentFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</div>
                `).join('')}
            </div>
        `;
    }

    // --- 初始化 ---
    function injectExtensionsEntry() {
        const ID = 'rm-ext-entry-btn';
        // 脚本运行在子上下文中，必须用 parent.document 访问 ST 主页面 DOM
        const pd = window.parent.document;

        const doInject = () => {
            try {
                if (pd.getElementById(ID)) return;
                const menu = pd.getElementById('extensionsMenu');
                if (!menu) return;
                const btn = pd.createElement('div');
                btn.id = ID;
                btn.className = 'list-group-item flex-container flexGap5 interactable';
                btn.setAttribute('tabindex', '0');
                btn.setAttribute('role', 'listitem');
                btn.title = '正则管理';
                btn.style.cssText = 'cursor:pointer;';
                btn.innerHTML = '<div class="fa-fw fa-solid fa-code extensionsMenuExtensionButton"></div><span>正则管理</span>';
                btn.onclick = showUnifiedUI;
                menu.appendChild(btn);
            } catch (e) { console.warn('[RegexManager] ext btn inject failed:', e); }
        };

        // jQuery ready（与参考插件相同的模式）
        try {
            if (typeof $ === 'function') { $(doInject); }
            else if (typeof jQuery === 'function') { jQuery(doInject); }
            else { setTimeout(doInject, 0); }
        } catch (e) { setTimeout(doInject, 0); }
    }

    function hideQRButton() {
        // TavernHelper 会持久化注册过的 QR 按钮，切换为魔法棒模式后需要主动隐藏
        const tryHide = () => {
            try {
                const pd = window.parent.document;
                // TavernHelper 脚本按钮：按文本内容查找，不依赖特定 class
                let found = false;
                pd.querySelectorAll('button, .qr--button, [class*="script"], [class*="Script"]').forEach(el => {
                    if ((el.textContent || '').trim() === MAIN_BUTTON_NAME && el.id !== 'rm-ext-entry-btn') {
                        el.style.setProperty('display', 'none', 'important');
                        found = true;
                    }
                });
                return found;
            } catch (e) { return false; }
        };
        // 多次尝试确保按钮渲染后能被找到
        setTimeout(tryHide, 300);
        setTimeout(tryHide, 800);
        setTimeout(tryHide, 2000);
    }

    function initialize() {
        applyFontScale();
        if (getEntryPoint() === 'extensions') {
            // 魔法棒模式：只注入扩展菜单入口，隐藏 QR 按钮
            injectExtensionsEntry();
            hideQRButton();
        } else {
            // 快捷回复模式：只注册 QR 按钮
            eventOn(getButtonEvent(MAIN_BUTTON_NAME), showUnifiedUI);
        }
        console.log(`${SCRIPT_NAME} 已初始化。`);
    }

    initialize();
})();
