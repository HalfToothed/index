// app.js (frontend)
// Fetches the pre-parsed day from the server and renders it. Events that are
// part of an ongoing story show a "Context" toggle; expanding it fetches a
// Gemma-built timeline (dated points) and renders them joined by arrows.
//
// All rendering uses textContent (never innerHTML) so event text from Wikipedia
// can never inject markup.

/**
 * Build one event card. `event` has { topic, description, sources, history }.
 * @param {object} event
 * @returns {HTMLElement}
 */
function buildEvent(event) {
  const eventDiv = document.createElement('div');
  eventDiv.className = 'event';

  if (event.topic) {
    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = event.topic;
    eventDiv.appendChild(title);
  }

  const text = document.createElement('div');
  text.className = 'event-text';
  text.textContent = event.description;
  eventDiv.appendChild(text);

  (event.sources || []).forEach((source) => {
    const anchor = document.createElement('a');
    anchor.className = 'source-badge';
    anchor.textContent = source.name;
    anchor.href = source.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    eventDiv.appendChild(anchor);
  });

  if (event.history && event.history.length > 0) {
    eventDiv.appendChild(buildContext(event));
  }

  return eventDiv;
}

/**
 * Build the collapsed "Context" toggle plus its (initially empty) panel.
 * @param {object} event
 * @returns {HTMLElement}
 */
function buildContext(event) {
  const wrap = document.createElement('div');
  wrap.className = 'context';

  const toggle = document.createElement('button');
  toggle.className = 'context-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Context';
  toggle.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'context-panel';
  panel.hidden = true;

  const status = document.createElement('div');
  status.className = 'context-status';

  let loaded = false;

  toggle.addEventListener('click', async () => {
    const open = !panel.hidden;
    panel.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.classList.toggle('open', !open);

    if (open || loaded) return;
    loaded = true;

    status.textContent = 'Building context…';
    panel.appendChild(status);

    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: event.topic,
          seedDescription: event.description,
          history: event.history,
        }),
      });
      const data = await res.json();
      const ctx = data.timeline;
      status.remove();

      if (!ctx || (!ctx.what && !ctx.why && !ctx.background)) {
        status.textContent = 'No context available.';
        panel.appendChild(status);
        return;
      }

      panel.appendChild(buildContextContent(ctx));
    } catch (err) {
      status.textContent = 'Could not load context.';
      loaded = false;
    }
  });

  wrap.appendChild(toggle);
  wrap.appendChild(panel);
  return wrap;
}

/**
 * Render timeline points joined by arrows:
 *   Oct 24  Saudi strikes Hamdan → Oct 28  market strike in Al Hazm → ...
 * @param {Array<{date: string, text: string}>} points
 * @returns {HTMLElement}
 */
/**
 * Render WHAT / WHY / BACKGROUND as three short paragraphs.
 * @param {{what: string, why: string, background: string}} ctx
 * @returns {HTMLElement}
 */
function buildContextContent(ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'context-content';

  const addLine = (text, className, label) => {
    if (!text) return;
    const p = document.createElement('p');
    p.className = className;
    if (label) {
      const em = document.createElement('em');
      em.className = 'context-date';
      em.textContent = `${label}: `;
      p.appendChild(em);
    }
    const span = document.createElement('span');
    span.className = 'context-text';
    span.textContent = text;
    p.appendChild(span);
    wrap.appendChild(p);
  };

  addLine(ctx.what, 'context-what', 'What');
  addLine(ctx.why, 'context-why', 'Why it matters');
  addLine(ctx.background, 'context-background', 'Background');

  return wrap;
}
/**
 * Shorten "October 28, 2026 (Tuesday)" to "Oct 28". Falls back to the raw
 * string if it doesn't match.
 * @param {string} dateLabel
 * @returns {string}
 */
function shortDate(dateLabel) {
  const m = dateLabel.match(/([A-Z][a-z]+)\s+(\d{1,2})/);
  if (!m) return dateLabel;
  return `${m[1].slice(0, 3)} ${m[2]}`;
}

/**
 * Render the whole day into #app.
 * @param {object} payload - { date, sections }
 */
function render(payload) {
  const app = document.getElementById('app');

  if (payload.date) {
    const header = document.createElement('div');
    header.className = 'header';
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = payload.date;
    header.appendChild(date);
    app.appendChild(header);
  }

  payload.sections.forEach((section) => {
    const categoryDiv = document.createElement('div');
    const cls = section.title.replace(/\s+/g, '');
    categoryDiv.className = `category-section ${cls}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'category-header';
    headerDiv.textContent = section.title;
    categoryDiv.appendChild(headerDiv);

    section.items.forEach((item) => {
      categoryDiv.appendChild(buildEvent(item));
    });

    app.appendChild(categoryDiv);
  });
}

async function load() {
  try {
    const res = await fetch('/api/today');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const payload = await res.json();
    render(payload);
  } catch (err) {
    const app = document.getElementById('app');
    const msg = document.createElement('div');
    msg.className = 'error';
    msg.textContent = 'Could not load current events. Please try again later.';
    app.appendChild(msg);
  } finally {
    const loader = document.getElementById('loader-div');
    if (loader) loader.style.display = 'none';
  }
}

load();
