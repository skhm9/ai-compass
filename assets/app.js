(function () {
  const DATA_CACHE = new Map();

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeStatus(value) {
    const status = (value || 'unverified').toLowerCase();
    if (['verified', 'partial', 'unverified'].includes(status)) return status;
    return 'unverified';
  }

  function fetchJson(path) {
    if (DATA_CACHE.has(path)) {
      return Promise.resolve(DATA_CACHE.get(path));
    }

    return fetch(`${window.location.origin}${window.location.pathname.includes('/ai-compass') ? '/ai-compass/' : '/'}${path.replace(/^\.\//, '')}`, { cache: 'force-cache' })
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

  function getRelativeAssetPath(path) {
    if (path.startsWith('./')) return path.replace(/^\.\//, '');
    return path;
  }

  function renderStatusBadge(status) {
    const normalized = normalizeStatus(status);
    return `<span class="status-badge ${normalized}">${normalized}</span>`;
  }

  function renderToolCard(tool) {
    const toolPrice = tool.pricing_summary || 'Price needs verification';
    const status = normalizeStatus(tool.verification_status);
    const sourceLinks = safeArray(tool.source_urls)
      .map((url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">Source</a>`)
      .join('');

    return `
      <article class="tool-card" aria-label="${tool.name}">
        <div class="tool-card-header">
          <span class="tool-category">${tool.category || 'General'}</span>
          ${renderStatusBadge(status)}
        </div>
        <h3>${tool.name}</h3>
        <p>${tool.description || 'Description not yet verified.'}</p>
        <div class="meta-row">
          <span class="meta-pill">Developer: ${tool.developer || 'Not verified'}</span>
          <span class="meta-pill">Verified: ${tool.last_verified || 'Not recorded'}</span>
        </div>
        <div class="meta-row compact-row">
          <span class="meta-pill">Price: ${toolPrice}</span>
        </div>
        <div class="actions">
          <a class="button secondary" href="tool.html?id=${tool.id}">View details</a>
          <a class="inline-link" href="${tool.website || '#'}" target="_blank" rel="noopener noreferrer">Official site →</a>
        </div>
        <div class="source-stack">${sourceLinks}</div>
      </article>
    `;
  }

  function renderNewsCard(item) {
    return `
      <article class="news-card">
        <div class="news-card-header">
          <span class="news-tag">${item.tag || 'Source'}</span>
          <time datetime="${item.date || ''}">${item.date || 'Date unavailable'}</time>
        </div>
        <h3>${item.title || 'Untitled update'}</h3>
        <p>${item.summary || 'No summary provided.'}</p>
        <div class="sources">
          <a href="${item.source_url}" target="_blank" rel="noopener noreferrer">Original source</a>
        </div>
      </article>
    `;
  }

  function renderRetryBlock(message, onRetry, label = 'Retry') {
    return `
      <div class="error-panel" role="alert">
        <p>${message}</p>
        <button type="button" class="button primary retry-button" data-retry="${label}">${label}</button>
      </div>
    `;
  }

  function attachRetryHandlers(container, retryFn) {
    const button = container.querySelector('.retry-button');
    if (button) {
      button.addEventListener('click', retryFn);
    }
  }

  function populateFeaturedTools() {
    const featuredContainer = document.getElementById('featured-tools');
    if (!featuredContainer) return;

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = safeArray(data.tools).slice(0, 4);
          featuredContainer.innerHTML = tools.map(renderToolCard).join('');

          const count = document.querySelector('[data-home-stat="count"]');
          const categories = document.querySelector('[data-home-stat="categories"]');
          if (count) count.textContent = String(safeArray(data.tools).length);
          if (categories) {
            const uniqueCategories = new Set(safeArray(data.tools).map((tool) => tool.category).filter(Boolean));
            categories.textContent = String(uniqueCategories.size);
          }
        })
        .catch((error) => {
          console.error(error);
          featuredContainer.innerHTML = renderRetryBlock('Unable to load the featured tools right now.', load, 'Retry tools');
          attachRetryHandlers(featuredContainer, load);
        });
    };

    load();
  }

  function populateFeaturedNews() {
    const container = document.getElementById('featured-news');
    if (!container) return;

    const load = () => {
      fetchJson('data/news.json')
        .then((data) => {
          const items = safeArray(data.news).slice(0, 3);
          if (!items.length) {
            container.innerHTML = `
              <div class="info-card">
                <h3>No verified news available</h3>
                <p>${data.empty_message || 'No verified updates are currently available for this dataset.'}</p>
              </div>
            `;
            return;
          }
          container.innerHTML = items.map(renderNewsCard).join('');
        })
        .catch((error) => {
          console.error(error);
          container.innerHTML = renderRetryBlock('Unable to load the latest AI news right now.', load, 'Retry news');
          attachRetryHandlers(container, load);
        });
    };

    load();
  }

  function initToolsPage() {
    const list = document.getElementById('tool-list');
    const searchInput = document.getElementById('tool-search');
    const filterWrap = document.getElementById('category-filters');

    if (!list) return;

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = safeArray(data.tools);
          const categories = ['All', ...new Set(tools.map((tool) => tool.category).filter(Boolean))];
          let activeFilter = 'All';
          let query = '';

          function renderTools() {
            const filtered = tools.filter((tool) => {
              const matchesCategory = activeFilter === 'All' || tool.category === activeFilter;
              const haystack = `${tool.name || ''} ${tool.description || ''} ${tool.category || ''} ${tool.use_cases?.join(' ') || ''}`.toLowerCase();
              const matchesQuery = haystack.includes(query.trim().toLowerCase());
              return matchesCategory && matchesQuery;
            });

            list.innerHTML = filtered.length
              ? filtered.map(renderToolCard).join('')
              : '<p class="list-note">No tools match your current filters.</p>';
          }

          filterWrap.innerHTML = categories.map((category) => `
            <button type="button" class="chip ${category === activeFilter ? 'active' : ''}" data-category="${category}">${category}</button>
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
          list.innerHTML = renderRetryBlock('Unable to load the tools catalog right now. Please retry.', load, 'Retry catalog');
          attachRetryHandlers(list, load);
        });
    };

    load();
  }

  function initToolDetailPage() {
    const container = document.getElementById('tool-detail');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('id');

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = safeArray(data.tools);
          const tool = tools.find((entry) => entry.id === toolId);

          if (!tool) {
            container.innerHTML = `
              <div class="detail-panel">
                <h1>Tool not found</h1>
                <p class="list-note">The requested AI tool is not available in the current dataset.</p>
                <a class="button primary" href="tools.html">Back to tools</a>
              </div>
            `;
            return;
          }

          const features = safeArray(tool.features);
          const limitations = safeArray(tool.limitations);
          const useCases = safeArray(tool.use_cases);
          const sources = safeArray(tool.source_urls);

          container.innerHTML = `
            <article class="detail-panel">
              <div class="detail-header">
                <div>
                  <div class="detail-topline">
                    <span class="tool-category">${tool.category || 'General'}</span>
                    ${renderStatusBadge(tool.verification_status)}
                    <span class="meta-pill">Last verified: ${tool.last_verified || 'Not recorded'}</span>
                  </div>
                  <h1>${tool.name}</h1>
                  <p class="page-intro">${tool.description || 'Description not yet verified.'}</p>
                </div>
                <a class="button primary" href="${tool.website || '#'}" target="_blank" rel="noopener noreferrer">Official site</a>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Developer</h3>
                  <p>${tool.developer || 'Not verified'}</p>
                </div>
                <div class="detail-card">
                  <h3>Pricing</h3>
                  <p>${tool.pricing_summary || 'Price needs verification'}</p>
                  <div class="sources">
                    <a href="${tool.pricing_url || tool.website || '#'}" target="_blank" rel="noopener noreferrer">Pricing</a>
                  </div>
                </div>
                <div class="detail-card">
                  <h3>Verification</h3>
                  <p>Verification state: ${normalizeStatus(tool.verification_status)}. Information should be checked against the official source before making claims about pricing, feature access, or availability.</p>
                </div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Primary use cases</h3>
                  <ul>${useCases.length ? useCases.map((item) => `<li>${item}</li>`).join('') : '<li>Not recorded</li>'}</ul>
                </div>
                <div class="detail-card">
                  <h3>Features</h3>
                  <ul>${features.length ? features.map((item) => `<li>${item}</li>`).join('') : '<li>Not recorded</li>'}</ul>
                </div>
                <div class="detail-card">
                  <h3>Known limitations</h3>
                  <ul>${limitations.length ? limitations.map((item) => `<li>${item}</li>`).join('') : '<li>Not recorded</li>'}</ul>
                </div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Official sources</h3>
                  <div class="sources">
                    ${sources.length ? sources.map((url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">Source</a>`).join('') : '<span class="list-note">No sources listed.</span>'}
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .catch((error) => {
          console.error(error);
          container.innerHTML = renderRetryBlock('Unable to load this tool detail right now.', load, 'Retry details');
          attachRetryHandlers(container, load);
        });
    };

    load();
  }

  function initComparisonPage() {
    const selectOne = document.getElementById('compare-tool-1');
    const selectTwo = document.getElementById('compare-tool-2');
    const selectThree = document.getElementById('compare-tool-3');
    const output = document.getElementById('compare-output');

    if (!output || !selectOne || !selectTwo || !selectThree) return;

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = safeArray(data.tools);
          const options = ['<option value="">Select a tool</option>'].concat(tools.map((tool) => `<option value="${tool.id}">${tool.name}</option>`)).join('');

          selectOne.innerHTML = options;
          selectTwo.innerHTML = options;
          selectThree.innerHTML = options;

          const defaultOptions = ['chatgpt', 'claude', 'gemini'];
          [selectOne, selectTwo, selectThree].forEach((select, index) => {
            if (defaultOptions[index]) select.value = defaultOptions[index];
          });

          function getSelectedTools() {
            return [selectOne.value, selectTwo.value, selectThree.value]
              .filter(Boolean)
              .map((id) => tools.find((tool) => tool.id === id))
              .filter(Boolean);
          }

          function renderComparison() {
            const selected = getSelectedTools();
            if (!selected.length) {
              output.innerHTML = '<p class="list-note">Select one or more tools to compare.</p>';
              return;
            }

            const rows = [
              ['Developer', (tool) => tool.developer || 'Not verified'],
              ['Category', (tool) => tool.category || 'Not verified'],
              ['Pricing', (tool) => tool.pricing_summary || 'Price needs verification'],
              ['Verification state', (tool) => normalizeStatus(tool.verification_status)],
              ['Last verified', (tool) => tool.last_verified || 'Not recorded'],
              ['Features', (tool) => safeArray(tool.features).join('; ') || 'Not recorded'],
              ['Limitations', (tool) => safeArray(tool.limitations).join('; ') || 'Not recorded'],
              ['Use cases', (tool) => safeArray(tool.use_cases).join('; ') || 'Not recorded']
            ];

            output.innerHTML = `
              <table class="compare-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    ${selected.map((tool) => `<th>${tool.name}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(([label, getter]) => `
                    <tr>
                      <td>${label}</td>
                      ${selected.map((tool) => `<td>${getter(tool)}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }

          [selectOne, selectTwo, selectThree].forEach((select) => {
            select.addEventListener('change', renderComparison);
          });

          renderComparison();
        })
        .catch((error) => {
          console.error(error);
          output.innerHTML = renderRetryBlock('Unable to load the comparison data right now.', load, 'Retry comparison');
          attachRetryHandlers(output, load);
        });
    };

    load();
  }

  function initNewsPage() {
    const container = document.getElementById('news-list');
    if (!container) return;

    const load = () => {
      fetchJson('data/news.json')
        .then((data) => {
          const items = safeArray(data.news);
          if (!items.length) {
            container.innerHTML = `
              <div class="info-card">
                <h3>No verified news available</h3>
                <p>${data.empty_message || 'No verified updates are currently available for this dataset.'}</p>
              </div>
            `;
            return;
          }
          container.innerHTML = items.map(renderNewsCard).join('');
        })
        .catch((error) => {
          console.error(error);
          container.innerHTML = renderRetryBlock('Unable to load the news feed right now.', load, 'Retry news');
          attachRetryHandlers(container, load);
        });
    };

    load();
  }

  function initHome() {
    populateFeaturedTools();
    populateFeaturedNews();
  }

  window.aiCompassApp = {
    initHome,
    initToolsPage,
    initToolDetailPage,
    initComparisonPage,
    initNewsPage,
  };
})();

