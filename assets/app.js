(function () {
  const apiBase = './';
  const DATA_CACHE = new Map();

  function safeText(value, fallback = 'Not verified') {
    if (value === undefined || value === null || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    return value;
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
    const retryButton = container.querySelector('.retry-button');
    if (!retryButton) return;
    retryButton.addEventListener('click', retryFn);
  }

  function fetchJson(path) {
    if (DATA_CACHE.has(path)) {
      return Promise.resolve(DATA_CACHE.get(path));
    }

    return fetch(`${apiBase}${path}`, { cache: 'force-cache' })
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

  function renderToolCard(tool) {
    return `
      <article class="tool-card" aria-label="${tool.name}">
        <div class="tool-card-header">
          <span class="tool-category">${safeText(tool.category, 'General')}</span>
          <span class="meta-pill">Verified ${safeText(tool.last_verified, 'N/A')}</span>
        </div>
        <h3>${tool.name}</h3>
        <p>${safeText(tool.summary)}</p>
        <div class="meta-row">
          <span class="meta-pill">Best for: ${safeText(tool.best_for, 'General use')}</span>
          <span class="meta-pill">Price: ${safeText(tool.pricing_summary, 'Not verified')}</span>
        </div>
        <div class="actions">
          <a class="button secondary" href="tool.html?id=${tool.id}">View details</a>
          <a class="inline-link" href="${tool.website}" target="_blank" rel="noopener noreferrer">Official site →</a>
        </div>
      </article>
    `;
  }

  function renderNewsCard(item) {
    return `
      <article class="news-card">
        <div class="news-card-header">
          <span class="news-tag">${safeText(item.tag, 'Update')}</span>
          <time datetime="${item.date}">${safeText(item.date)}</time>
        </div>
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <div class="sources">
          <a href="${item.source_url}" target="_blank" rel="noopener noreferrer">Source</a>
        </div>
      </article>
    `;
  }

  function populateFeaturedTools() {
    const featuredContainer = document.getElementById('featured-tools');
    if (!featuredContainer) return;

    const load = () => {
      fetchJson('data/tools.json')
        .then((data) => {
          const tools = Array.isArray(data.tools) ? data.tools : [];
          const featured = tools.slice(0, 4);
          featuredContainer.innerHTML = featured.map(renderToolCard).join('');

          const count = document.querySelector('[data-home-stat="count"]');
          const categories = document.querySelector('[data-home-stat="categories"]');
          if (count) count.textContent = String(tools.length);
          if (categories) {
            const uniqueCategories = new Set(tools.map((tool) => tool.category).filter(Boolean));
            categories.textContent = String(uniqueCategories.size);
          }
        })
        .catch((error) => {
          console.error(error);
          featuredContainer.innerHTML = renderRetryBlock('Unable to load the featured tools right now.', load, 'Retry tools');
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
          const items = Array.isArray(data.news) ? data.news.slice(0, 3) : [];
          container.innerHTML = items.map(renderNewsCard).join('');
        })
        .catch((error) => {
          console.error(error);
          container.innerHTML = renderRetryBlock('Unable to load the latest AI news right now.', load, 'Retry news');
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
          const tools = Array.isArray(data.tools) ? data.tools : [];
          const categories = ['All', ...new Set(tools.map((tool) => tool.category).filter(Boolean))];
          let activeFilter = 'All';
          let query = '';

          function renderTools() {
            const filtered = tools.filter((tool) => {
              const matchesCategory = activeFilter === 'All' || tool.category === activeFilter;
              const haystack = `${tool.name} ${tool.summary} ${tool.best_for} ${tool.category}`.toLowerCase();
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

          searchInput.addEventListener('input', (event) => {
            query = event.target.value;
            renderTools();
          });

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
          const tools = Array.isArray(data.tools) ? data.tools : [];
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

          const strengths = Array.isArray(tool.strengths) ? tool.strengths : [];
          const limitations = Array.isArray(tool.limitations) ? tool.limitations : [];
          const features = Array.isArray(tool.features) ? tool.features : [];
          const sources = Array.isArray(tool.sources) ? tool.sources : [];

          container.innerHTML = `
            <article class="detail-panel">
              <div class="detail-header">
                <div>
                  <div class="detail-topline">
                    <span class="tool-category">${safeText(tool.category, 'General')}</span>
                    <span class="meta-pill">Last verified: ${safeText(tool.last_verified, 'Not verified')}</span>
                  </div>
                  <h1>${tool.name}</h1>
                  <p class="page-intro">${safeText(tool.summary)}</p>
                </div>
                <a class="button primary" href="${tool.website}" target="_blank" rel="noopener noreferrer">Official site</a>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Best for</h3>
                  <p>${safeText(tool.best_for, 'General-purpose use')}</p>
                </div>
                <div class="detail-card">
                  <h3>Pricing context</h3>
                  <p>${safeText(tool.pricing_summary, 'Pricing not verified')}</p>
                </div>
                <div class="detail-card">
                  <h3>Availability</h3>
                  <p>${safeText(tool.availability, 'Not verified')}</p>
                </div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Features</h3>
                  <ul>${features.length ? features.map((item) => `<li>${item}</li>`).join('') : '<li>Not verified</li>'}</ul>
                </div>
                <div class="detail-card">
                  <h3>Strengths</h3>
                  <ul>${strengths.length ? strengths.map((item) => `<li>${item}</li>`).join('') : '<li>Not verified</li>'}</ul>
                </div>
                <div class="detail-card">
                  <h3>Limitations</h3>
                  <ul>${limitations.length ? limitations.map((item) => `<li>${item}</li>`).join('') : '<li>Not verified</li>'}</ul>
                </div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Signal sources</h3>
                  <div class="sources">
                    ${sources.length ? sources.map((source) => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a>`).join('') : '<span class="list-note">No sources listed.</span>'}
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
          const tools = Array.isArray(data.tools) ? data.tools : [];
          const options = ['<option value="">Select a tool</option>'].concat(tools.map((tool) => `<option value="${tool.id}">${tool.name}</option>`)).join('');

          selectOne.innerHTML = options;
          selectTwo.innerHTML = options;
          selectThree.innerHTML = options;

          const defaultOptions = ['chatgpt', 'claude', 'perplexity'];
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
              ['Category', (tool) => tool.category || 'Not verified'],
              ['Best for', (tool) => tool.best_for || 'Not verified'],
              ['Pricing', (tool) => tool.pricing_summary || 'Not verified'],
              ['Availability', (tool) => tool.availability || 'Not verified'],
              ['Strengths', (tool) => (tool.strengths && tool.strengths.length ? tool.strengths.join('; ') : 'Not verified')],
              ['Limitations', (tool) => (tool.limitations && tool.limitations.length ? tool.limitations.join('; ') : 'Not verified')],
              ['Last verified', (tool) => tool.last_verified || 'Not verified']
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
                      ${selected.map((tool) => `<td>${safeText(getter(tool), 'Not verified')}</td>`).join('')}
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
          const items = Array.isArray(data.news) ? data.news : [];
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
