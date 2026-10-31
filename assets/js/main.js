(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = () => reducedMotion() ? 'instant' : 'smooth';
  const themeToggle = $('.theme-toggle');
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const label = theme === 'dark' ? '밝은 모드로 전환' : '어두운 모드로 전환';
    themeToggle?.setAttribute('aria-label', label);
    themeToggle?.setAttribute('title', label);
  }
  setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  themeToggle?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    try { localStorage.setItem('atomb-theme', theme); } catch (_) {}
  });
  window.addEventListener('storage', event => {
    if (event.key === 'atomb-theme') setTheme(event.newValue === 'light' ? 'light' : 'dark');
  });
  // Hover previews the light; click/tap or Enter/Space keeps it on or off.
  const deskLamp = $('.desk-lamp-switch');
  deskLamp?.addEventListener('click', () => {
    const on = deskLamp.getAttribute('aria-pressed') !== 'true';
    deskLamp.setAttribute('aria-pressed', String(on));
  });
  deskLamp?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      deskLamp.setAttribute('aria-pressed', 'false');
      deskLamp.blur();
    }
  });
  // Search uses a generated local index; rendering only ever uses text nodes.
  const dialog = $('#search-dialog');
  const input = $('#search-input');
  const results = $('#search-results');
  const status = $('#search-status');
  let indexPromise;
  let searchReturnFocus;
  let requestNumber = 0;
  let debounceTimer;
  const normalize = text => String(text).normalize('NFKC').toLocaleLowerCase('ko-KR');
  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(document.body.dataset.searchUrl, { credentials: 'same-origin' })
        .then(response => { if (!response.ok) throw new Error('Search index unavailable'); return response.json(); })
        .then(posts => posts.map(post => ({ ...post, searchable: normalize([post.title, post.content, ...post.categories, ...post.tags].join(' ')) })))
        .catch(error => { indexPromise = undefined; throw error; });
    }
    return indexPromise;
  }
  function highlighted(text, query) {
    const fragment = document.createDocumentFragment();
    const position = normalize(text).indexOf(normalize(query));
    if (!query || position < 0) { fragment.append(document.createTextNode(text)); return fragment; }
    fragment.append(document.createTextNode(text.slice(0, position)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(position, position + query.length);
    fragment.append(mark, document.createTextNode(text.slice(position + query.length)));
    return fragment;
  }
  async function search() {
    const current = ++requestNumber;
    const query = input.value.trim();
    const tokens = normalize(query).split(/\s+/u).filter(Boolean);
    status.textContent = '기록을 불러오는 중입니다…';
    try {
      const posts = await loadIndex();
      if (current !== requestNumber || !dialog.open) return;
      let matches = posts.filter(post => tokens.every(token => post.searchable.includes(token)));
      if (tokens.length) {
        matches = matches.map(post => ({ post, score: tokens.reduce((total, token) => total + (normalize(post.title).includes(token) ? 4 : 0) + (normalize([...post.tags, ...post.categories].join(' ')).includes(token) ? 2 : 0), 0) }))
          .sort((a, b) => b.score - a.score).map(item => item.post);
      }
      results.replaceChildren();
      status.textContent = query ? `“${query}” · ${matches.length}개의 기록` : `최근 기록 ${Math.min(matches.length, 6)}개 · 제목, 내용, 주제로 검색하세요.`;
      if (query && !matches.length) {
        const empty = document.createElement('p');
        empty.className = 'search-error';
        empty.textContent = '일치하는 기록이 없어요. 다른 단어로 찾아보세요.';
        results.append(empty);
      }
      matches.slice(0, query ? 20 : 6).forEach(post => {
        const link = document.createElement('a');
        link.className = 'search-result';
        link.href = post.url;
        const title = document.createElement('strong');
        title.append(highlighted(post.title, query));
        const meta = document.createElement('small');
        meta.textContent = `${post.date} · ${post.categories.join(' / ') || '노트'}`;
        const preview = document.createElement('p');
        const content = post.content.replace(/\s+/gu, ' ');
        const matchAt = query ? normalize(content).indexOf(normalize(tokens[0])) : 0;
        const start = Math.max(0, matchAt - 30);
        preview.append(highlighted((start ? '…' : '') + content.slice(start, start + 110) + (content.length > start + 110 ? '…' : ''), tokens[0] || ''));
        link.append(title, meta, preview);
        results.append(link);
      });
    } catch (_) {
      if (current !== requestNumber || !dialog.open) return;
      status.textContent = '검색 데이터를 불러오지 못했습니다.';
      results.replaceChildren();
      const message = document.createElement('div');
      message.className = 'search-error';
      message.textContent = '연결을 확인한 뒤 다시 시도해 주세요.';
      const retry = document.createElement('button');
      retry.className = 'search-retry';
      retry.type = 'button';
      retry.textContent = '다시 불러오기 →';
      retry.addEventListener('click', search);
      message.append(retry);
      results.append(message);
    }
  }
  function openSearch() {
    if (dialog.open) { input.focus(); input.select(); return; }
    searchReturnFocus = document.activeElement;
    dialog.showModal();
    input.focus();
    search();
  }
  $$('[data-search-open]').forEach(button => button.addEventListener('click', openSearch));
  $('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { ++requestNumber; searchReturnFocus?.focus(); });
  input.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(search, 100); });
  document.addEventListener('keydown', event => {
    const editing = event.target.closest('input, textarea, select, [contenteditable="true"]');
    if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
      event.preventDefault(); openSearch();
    }
  });

  // Topic and tag filters also support shareable URLs and browser back/forward.
  const filters = $$('[data-home-tag]');
  function filterPosts(tag, updateUrl = true) {
    if (!filters.length) return;
    filters.forEach(button => {
      const active = button.dataset.homeTag === tag;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    let visible = 0;
    $$('.post-item').forEach(post => { post.hidden = tag !== '' && !JSON.parse(post.dataset.tags).includes(tag); if (!post.hidden) visible++; });
    $('.filter-empty').hidden = visible > 0;
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.delete('category');
      if (tag === '') url.searchParams.delete('tag'); else url.searchParams.set('tag', tag);
      history.pushState(null, '', url);
    }
  }
  filters.forEach(button => button.addEventListener('click', () => filterPosts(button.dataset.homeTag)));
  filterPosts(new URLSearchParams(location.search).get('tag') || '', false);
  const tagButtons = $$('[data-tag]');
  function filterArchive(tag, updateUrl = true) {
    if (!tagButtons.length) return;
    tagButtons.forEach(button => {
      const active = button.dataset.tag === tag;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    let visible = 0;
    $$('.archive-row').forEach(post => { post.hidden = tag !== 'all' && !JSON.parse(post.dataset.tags).includes(tag); if (!post.hidden) visible++; });
    $$('.archive-year').forEach(group => {
      const count = $$('.archive-row:not([hidden])', group).length;
      group.hidden = count === 0;
      $('h2 > span', group).textContent = `${count}개의 기록`;
    });
    $('.archive-empty').hidden = visible > 0;
    $('[data-archive-reset]').hidden = tag === 'all';
    if (updateUrl) {
      const url = new URL(location.href);
      if (tag === 'all') url.searchParams.delete('tag'); else url.searchParams.set('tag', tag);
      history.pushState(null, '', url);
    }
  }
  tagButtons.forEach(button => button.addEventListener('click', () => filterArchive(button.dataset.tag)));
  $('[data-archive-reset]')?.addEventListener('click', () => filterArchive('all'));
  filterArchive(new URLSearchParams(location.search).get('tag') || 'all', false);
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    filterPosts(params.get('tag') || '', false);
    filterArchive(params.get('tag') || 'all', false);
  });

  // Heading anchors and TOC are derived from the Markdown-generated headings.
  const prose = $('#post-content');
  const toc = $('#toc-links');
  if (prose) {
    const headings = $$('h1, h2, h3', prose);
    headings.forEach((heading, index) => {
      const label = heading.textContent;
      if (!heading.id) heading.id = `section-${index + 1}`;
      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${encodeURIComponent(heading.id)}`;
      anchor.setAttribute('aria-label', `${label} 항목 링크`);
      anchor.textContent = '#';
      heading.append(anchor);
      if (toc) {
        const link = document.createElement('a');
        link.href = anchor.href;
        link.dataset.heading = heading.id;
        link.className = `depth-${heading.tagName.slice(1)}`;
        link.textContent = label;
        toc.append(link);
      }
    });
    if (!headings.length) $('.toc')?.setAttribute('hidden', '');
    let ticking = false;
    function updateReading() {
      const height = document.documentElement.scrollHeight - innerHeight;
      const progress = height > 0 ? Math.min(100, Math.max(0, scrollY / height * 100)) : 100;
      $('#reading-progress').style.width = `${progress}%`;
      const current = [...headings].reverse().find(heading => heading.getBoundingClientRect().top <= 140) || headings[0];
      $$('a', toc || document.createElement('nav')).forEach(link => {
        const active = link.dataset.heading === current?.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateReading); } }, { passive: true });
    window.addEventListener('resize', updateReading);
    updateReading();
  }
  $$('.prose table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '표 — 가로로 스크롤할 수 있습니다');
    table.before(wrapper); wrapper.append(table);
  });
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.append(field);
    const previous = document.activeElement;
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    field.remove(); previous?.focus();
    return copied;
  }
  $$('.highlighter-rouge:has(pre)').forEach(block => {
    const button = document.createElement('button');
    button.className = 'code-copy';
    button.type = 'button';
    button.textContent = '복사';
    button.setAttribute('aria-label', '코드 복사');
    button.addEventListener('click', async () => {
      const copied = await copyText($('code', block).textContent);
      button.textContent = copied ? '복사됨 ✓' : '복사 실패';
      button.classList.add('copied');
      setTimeout(() => { button.textContent = '복사'; button.classList.remove('copied'); }, 1800);
    });
    block.append(button);
  });
  $('[data-copy-link]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const copied = await copyText(location.href.split('#')[0]);
    $('span', button).textContent = copied ? '주소를 복사했어요 ✓' : '주소창에서 복사해 주세요';
    setTimeout(() => { $('span', button).textContent = '글 주소 복사'; }, 2300);
  });
  const backTop = $('[data-back-top]');
  const updateBackTop = () => backTop.classList.toggle('visible', scrollY > 500);
  window.addEventListener('scroll', updateBackTop, { passive: true });
  updateBackTop();
  backTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: scrollBehavior() }); $('#main-content').focus({ preventScroll: true }); });
})();
