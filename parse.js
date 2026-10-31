// parse.js
// Parses the Wikipedia "Portal:Current events" HTML into structured day/event data.
// Ported from the original browser app.js to run on the server with linkedom.
//
// The portal page contains several days. Each day has a title, a set of
// category sections (e.g. "Armed conflicts and attacks"), and events nested in
// lists. Events can be deeply nested under a chain of topics; we record the
// DEEPEST topic heading so related stories group correctly.

import { DOMParser } from 'linkedom';

/**
 * Convert an HTML string into a document we can query.
 * @param {string} htmlString
 * @returns {Document}
 */
export function htmlToDOM(htmlString) {
  return new DOMParser().parseFromString(htmlString, 'text/html');
}

/**
 * Walk a top-level list item and return the leaf <li> elements that hold the
 * actual event text (the deepest items with no further nested list).
 * @param {Element} element
 * @returns {Element[]}
 */
function findEventItems(element) {
  const eventItems = [];

  function traverse(node) {
    const childUl = node.querySelector(':scope > ul');
    if (childUl) {
      const childLis = childUl.querySelectorAll(':scope > li');
      childLis.forEach((li) => traverse(li));
    } else {
      eventItems.push(node);
    }
  }

  traverse(element);
  return eventItems;
}

/**
 * Find the deepest topic heading for an event. Topic headings are links on
 * ancestor <li> elements that WRAP a nested <ul> (i.e. they label children).
 * The event's own inline links (e.g. a country name inside the sentence) are
 * ignored, so an event like "Saudi Arabia launches airstrikes..." groups under
 * its real topic ("Houthi–Saudi conflict, Yemeni civil war") rather than the
 * country. The most specific (deepest) heading is returned.
 * @param {Element} eventLi - the leaf event item
 * @param {Element} topItem - the top-level list item it belongs to
 * @returns {string|null} the deepest topic text, or null if none
 */
function findDeepestTopic(eventLi, topItem) {
  const topics = [];
  let node = eventLi.parentElement;

  while (node && node !== topItem.parentElement) {
    if (node.tagName === 'LI' && node.querySelector(':scope > ul')) {
      const links = node.querySelectorAll(':scope > a');
      const texts = [];
      links.forEach((link) => {
        if (!link.classList.contains('external')) {
          const text = link.textContent.trim();
          if (text) texts.push(text);
        }
      });
      if (texts.length) topics.unshift(texts.join(', '));
    }
    node = node.parentElement;
  }

  return topics.length ? topics[topics.length - 1] : null;
}

/**
 * Extract a single event's data from its leaf <li>.
 * @param {Element} eventLi
 * @param {string|null} topic - the deepest topic for this event
 * @returns {{topic: string|null, description: string, sources: {name: string, url: string}[]}|null}
 */
function extractEventData(eventLi, topic) {
  const clone = eventLi.cloneNode(true);

  const sources = [];
  const externalLinks = clone.querySelectorAll('a.external');
  externalLinks.forEach((link) => {
    const sourceText = link.textContent.trim().replace(/[()]/g, '');
    const sourceUrl = link.getAttribute('href');
    sources.push({ name: sourceText, url: sourceUrl });
    link.remove();
  });

  const description = clone.textContent.trim();
  if (!description) return null;

  return { topic, description, sources };
}

/**
 * Parse all events within one category section's list.
 * @param {Element} listEl - an element whose children are the top-level <li> items
 * @returns {object[]} events
 */
function parseEvents(listEl) {
  const events = [];
  const topLevelItems = listEl.querySelectorAll(':scope > li');

  topLevelItems.forEach((topItem) => {
    const eventItems = findEventItems(topItem);
    eventItems.forEach((eventLi) => {
      const topic = findDeepestTopic(eventLi, topItem);
      const eventData = extractEventData(eventLi, topic);
      if (eventData) events.push(eventData);
    });
  });

  return events;
}

/**
 * Parse the full portal document into an array of days. Each day is an array of
 * category sections ({ title, items }) and carries a `date` string.
 * @param {Document} doc
 * @returns {Array<Array<{title: string, items: object[]}> & {date: string}>}
 */
export function parseDays(doc) {
  const days = [];
  const titles = doc.querySelectorAll('.current-events-title');
  const contents = doc.querySelectorAll('.current-events-content');
  const count = Math.min(titles.length, contents.length);

  for (let i = 0; i < count; i += 1) {
    const date = titles[i].textContent.trim();
    const sections = Array.from(contents[i].children);

    const hasContent = sections.some((section) => section.tagName === 'P');
    if (!hasContent) {
      const empty = [{ title: 'Nothing to report just yet', items: [] }];
      empty.date = date;
      days.push(empty);
      continue;
    }

    const result = [];
    let currentSection = null;

    sections.forEach((section) => {
      if (section.tagName === 'P') {
        currentSection = { title: section.textContent.trim(), items: [] };
      } else if (currentSection) {
        section.setAttribute('id', 'list');
        const events = parseEvents(section);
        currentSection.items.push(...events);
        if (currentSection.items.length > 0 && !result.includes(currentSection)) {
          result.push(currentSection);
        }
      }
    });

    result.date = date;
    days.push(result);
  }

  return days;
}

/**
 * Flatten a day's sections into a single list of events, tagging each with its
 * category title. Useful for context matching.
 * @param {Array<{title: string, items: object[]}>} day
 * @returns {Array<object>} events with a `category` field
 */
export function flattenDay(day) {
  const out = [];
  day.forEach((section) => {
    section.items.forEach((item) => {
      out.push({ ...item, category: section.title });
    });
  });
  return out;
}
