(function () {
  const DATA_CACHE = new Map();

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeStatus(value) {
    const status = (value || 'unverified').toLowerCase();
    if (['verified', 'partial', 'unverified'].includes(status)) return status;
    return 'unverified';
  }

  function resolveDataUrl(path) {
    const cleanPath = String(path || '').replace(/^\.?\//, '');
    const currentLocation = new URL(window.location.href);
    const pathName = currentLocation.pathname.replace(/\/+$/, '');
    const basePath = pathName.endsWith('/ai-compass') ? '/ai-compass/' : '/';
    return new URL(cleanPath, `${currentLocation.origin}${basePath}`).toString();
  }

  function fetchJson(path) {
    if (DATA_CACHE.has(path)) {
      return Promise.resolve(DATA_CACHE.get(path));
    }

    return fetch(resolveDataUrl(path), {
      cache: 'force-cache',
      headers: { Accept: 'application/json' }
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${path}: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        DATA_CACHE.set(path, data);
        return data;
      });
  }

  function buildCategoryPills(categories) {
    const container = document.getElementById('home-category-pills');
    if (!container) return;

    const chips = (categories || []).slice(0, 7).map((category) => `
      <button type="button" class="chip-pill" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `).join('');

    container.innerHTML = chips || '<span class="chip-pill muted-chip">No categories available</span>';

    container.querySelectorAll('.chip-pill[data-category]').forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        window.location.href = `tools.html?category=${encodeURIComponent(category)}`;
      });
    });
  }

  function renderMetricCards(summary) {
    const container = document.getElementById('dashboard-metrics');
    if (!container) return;

    const cards = [
      {
        label: 'Tools tracked',
        value: summary.totalTools,
        detail: 'static catalog',
        tone: 'purple'
      },
      {
        label: 'Categories',
        value: summary.totalCategories,
        detail: 'tracked tools',
        tone: 'cyan'
      },
      {
        label: 'Verification',
        value: `${summary.verifiedCount}`,
        detail: 'verified records',
        tone: 'pink'
      },
      {
        label: 'Partial',
        value: `${summary.partialCount}`,
        detail: 'needs review',
        tone: 'teal'
      }
    ];

    container.innerHTML = cards.map((card) => `
      <article class="metric-card ${card.tone}">
        <span class="metric-label">${escapeHtml(card.label)}</span>
        <strong class="metric-value">${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.detail)}</small>
      </article>
    `).join('');
  }

  function renderTopTools(tools) {
    const container = document.getElementById('top-tools');
    if (!container) return;

    const entries = tools.slice(0, 5);

    container.innerHTML = entries.map((tool) => {
      const status = normalizeStatus(tool.verification_status);
      return `
        <article class="tool-row">
          <div class="tool-row-main">
            <div class="tool-row-mark">${escapeHtml((tool.name || 'AI').slice(0, 2).toUpperCase())}</div>
            <div>
              <h3>${escapeHtml(tool.name || 'Unnamed tool')}</h3>
              <p>${escapeHtml(tool.description || 'Description not yet verified.')}</p>
            </div>
          </div>
          <div class="tool-row-meta">
            <span class="status-pill ${status}">${escapeHtml(status)}</span>
            <a href="tool.html?id=${encodeURIComponent(tool.id || '')}" aria-label="View ${escapeHtml(tool.name || 'tool')} details">→</a>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderNewsPanel(newsData) {
    const container = document.getElementById('dashboard-news');
    if (!container) return;

    const items = safeArray(newsData.news).slice(0, 4);

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No verified news available</h3>
          <p>${escapeHtml(newsData.empty_message || 'No verified updates are currently available for this dataset.')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item) => `
      <article class="news-item">
        <div class="news-item-top">
          <span class="news-tag">${escapeHtml(item.tag || 'Source')}</span>
          <time>${escapeHtml(item.date || 'Date unavailable')}</time>
        </div>
        <h3>${escapeHtml(item.title || 'Untitled update')}</h3>
        <p>${escapeHtml(item.summary || 'No summary provided.')}</p>
        <a href="${escapeHtml(item.source_url || '#')}" target="_blank" rel="noopener noreferrer">Original source</a>
      </article>
    `).join('');
  }

  function initDashboard() {
    const topSearchInput = document.getElementById('top-search-input');
    const heroSearchInput = document.getElementById('hero-search-input');
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');

    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    const handleSearch = (query) => {
      const normalized = (query || '').trim();
      if (!normalized) return;
      window.location.href = `tools.html?q=${encodeURIComponent(normalized)}`;
    };

    if (topSearchInput) {
      topSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleSearch(topSearchInput.value);
        }
      });
    }

    if (heroSearchInput) {
      heroSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleSearch(heroSearchInput.value);
        }
      });
    }

    fetchJson('data/tools.json')
      .then((toolData) => {
        const tools = safeArray(toolData.tools);
        const categories = [...new Set(tools.map((tool) => tool.category).filter(Boolean))];
        const summary = {
          totalTools: tools.length,
          totalCategories: categories.length,
          verifiedCount: tools.filter((tool) => normalizeStatus(tool.verification_status) === 'verified').length,
          partialCount: tools.filter((tool) => normalizeStatus(tool.verification_status) === 'partial').length,
        };

        buildCategoryPills(categories);
        renderMetricCards(summary);
        renderTopTools(tools);
      })
      .catch((error) => {
        console.error(error);
        document.getElementById('dashboard-metrics').innerHTML = `
          <article class="metric-card purple"><span class="metric-label">Tools tracked</span><strong class="metric-value">Unavailable</strong><small>Data not available</small></article>
        `;
      });

    fetchJson('data/news.json')
      .then((newsData) => renderNewsPanel(newsData))
      .catch((error) => {
        console.error(error);
        const container = document.getElementById('dashboard-news');
        if (container) {
          container.innerHTML = '<div class="empty-state"><h3>News unavailable</h3><p>Unable to load verified AI news data.</p></div>';
        }
      });
  }

  function initToolsPage() {
    const list = document.getElementById('tool-list');
    const searchInput = document.getElementById('tool-search');
    const filterWrap = document.getElementById('category-filters');

    if (!list) return;

    const url = new URL(window.location.href);
    const initialQuery = url.searchParams.get('q') || '';
    const initialCategory = url.searchParams.get('category') || 'All';

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = safeArray(data.tools);
          const categories = ['All', ...new Set(tools.map((tool) => tool.category).filter(Boolean))];
          let activeFilter = categories.includes(initialCategory) ? initialCategory : 'All';
          let query = initialQuery;

          if (searchInput) {
            searchInput.value = query;
          }

          function renderTools() {
            const filtered = tools.filter((tool) => {
              const matchesCategory = activeFilter === 'All' || tool.category === activeFilter;
              const haystack = `${tool.name || ''} ${tool.description || ''} ${tool.category || ''} ${tool.use_cases?.join(' ') || ''}`.toLowerCase();
              const matchesQuery = haystack.includes(query.trim().toLowerCase());
              return matchesCategory && matchesQuery;
            });

            list.innerHTML = filtered.length
              ? filtered.map((tool) => `
                <article class="tool-card">
                  <div class="tool-card-header">
                    <span class="tool-category">${escapeHtml(tool.category || 'General')}</span>
                    <span class="status-badge ${normalizeStatus(tool.verification_status)}">${escapeHtml(normalizeStatus(tool.verification_status))}</span>
                  </div>
                  <h3>${escapeHtml(tool.name || 'Unnamed tool')}</h3>
                  <p>${escapeHtml(tool.description || 'Description not yet verified.')}</p>
                  <div class="meta-row">
                    <span class="meta-pill">Developer: ${escapeHtml(tool.developer || 'Not verified')}</span>
                    <span class="meta-pill">Verified: ${escapeHtml(tool.last_verified || 'Not recorded')}</span>
                  </div>
                  <div class="actions">
                    <a class="button secondary" href="tool.html?id=${encodeURIComponent(tool.id || '')}">View details</a>
                    <a class="inline-link" href="${escapeHtml(tool.website || '#')}" target="_blank" rel="noopener noreferrer">Official site →</a>
                  </div>
                </article>
              `).join('')
              : '<p class="list-note">No tools match your current filters.</p>';
          }

          if (filterWrap) {
            filterWrap.innerHTML = categories.map((category) => `
              <button type="button" class="chip ${category === activeFilter ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
            `).join('');

            filterWrap.querySelectorAll('.chip').forEach((button) => {
              button.addEventListener('click', () => {
                activeFilter = button.dataset.category;
                renderTools();
                filterWrap.querySelectorAll('.chip').forEach((chip) => {
                  chip.classList.toggle('active', chip.dataset.category === activeFilter);
                });
              });
            });
          }

          if (searchInput) {
            searchInput.addEventListener('input', (event) => {
              query = event.target.value;
              renderTools();
            });
          }

          renderTools();
        })
        .catch((error) => {
          console.error(error);
          list.innerHTML = '<p class="list-note">Unable to load the tools catalog right now.</p>';
        });
    };

    load();
  }

  function initToolDetailPage() {
    const container = document.getElementById('tool-detail');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('id');

    fetchJson('data/tools.json')
      .then((data) => {
        const tools = safeArray(data.tools);
        const tool = tools.find((entry) => entry.id === toolId);

        if (!tool) {
          container.innerHTML = `
            <div class="detail-panel">
              <h1>Tool not found</h1>
              <p class="list-note">The requested tool is not available in the current dataset.</p>
              <a class="button primary" href="tools.html">Back to tools</a>
            </div>
          `;
          return;
        }

        container.innerHTML = `
          <article class="detail-panel">
            <div class="detail-header">
              <div>
                <div class="detail-topline">
                  <span class="tool-category">${escapeHtml(tool.category || 'General')}</span>
                  <span class="status-badge ${normalizeStatus(tool.verification_status)}">${escapeHtml(normalizeStatus(tool.verification_status))}</span>
                  <span class="meta-pill">Last verified: ${escapeHtml(tool.last_verified || 'Not recorded')}</span>
                </div>
                <h1>${escapeHtml(tool.name || 'Unnamed tool')}</h1>
                <p class="page-intro">${escapeHtml(tool.description || 'Description not yet verified.')}</p>
              </div>
              <a class="button primary" href="${escapeHtml(tool.website || '#')}" target="_blank" rel="noopener noreferrer">Official site</a>
            </div>
            <div class="detail-grid">
              <div class="detail-card">
                <h3>Developer</h3>
                <p>${escapeHtml(tool.developer || 'Not verified')}</p>
              </div>
              <div class="detail-card">
                <h3>Pricing</h3>
                <p>${escapeHtml(tool.pricing_summary || 'Price needs verification')}</p>
              </div>
              <div class="detail-card">
                <h3>Verification</h3>
                <p>Verification state: ${escapeHtml(normalizeStatus(tool.verification_status))}. Information should be checked against official sources before making strong claims.</p>
              </div>
            </div>
            <div class="detail-grid">
              <div class="detail-card">
                <h3>Primary use cases</h3>
                <ul>${safeArray(tool.use_cases).length ? safeArray(tool.use_cases).map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Not recorded</li>'}</ul>
              </div>
              <div class="detail-card">
                <h3>Features</h3>
                <ul>${safeArray(tool.features).length ? safeArray(tool.features).map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Not recorded</li>'}</ul>
              </div>
              <div class="detail-card">
                <h3>Known limitations</h3>
                <ul>${safeArray(tool.limitations).length ? safeArray(tool.limitations).map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Not recorded</li>'}</ul>
              </div>
            </div>
          </article>
        `;
      })
      .catch((error) => {
        console.error(error);
        container.innerHTML = '<p class="list-note">Unable to load this tool detail right now.</p>';
      });
  }

  function initNewsPage() {
    const container = document.getElementById('news-list');
    if (!container) return;

    fetchJson('data/news.json')
      .then((data) => {
        const items = safeArray(data.news);
        if (!items.length) {
          container.innerHTML = `
            <div class="info-card">
              <h3>No verified news available</h3>
              <p>${escapeHtml(data.empty_message || 'No verified updates are currently available for this dataset.')}</p>
            </div>
          `;
          return;
        }

        container.innerHTML = items.map((item) => `
          <article class="news-card">
            <div class="news-card-header">
              <span class="news-tag">${escapeHtml(item.tag || 'Source')}</span>
              <time datetime="${escapeHtml(item.date || '')}">${escapeHtml(item.date || 'Date unavailable')}</time>
            </div>
            <h3>${escapeHtml(item.title || 'Untitled update')}</h3>
            <p>${escapeHtml(item.summary || 'No summary provided.')}</p>
            <a href="${escapeHtml(item.source_url || '#')}" target="_blank" rel="noopener noreferrer">Original source</a>
          </article>
        `).join('');
      })
      .catch((error) => {
        console.error(error);
        container.innerHTML = '<p class="list-note">Unable to load AI news at the moment.</p>';
      });
  }

  function initHome() {
    initDashboard();
  }

  window.aiCompassApp = {
    initHome,
    initToolsPage,
    initToolDetailPage,
    initNewsPage,
  };
})();
