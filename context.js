// context.js
// Given today's events and the earlier days present on the portal page, find
// which of today's events are part of an ongoing story and gather the matching
// earlier entries. An event qualifies for a context block only if its topic
// appeared on at least two earlier days.

import { flattenDay } from './parse.js';

const MIN_EARLIER_DAYS = 2;

/**
 * Normalise a topic for matching: lowercase, collapse whitespace.
 * @param {string|null} topic
 * @returns {string}
 */
function normaliseTopic(topic) {
  return (topic || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build a map of topic -> [{ date, description }] from the earlier days.
 * @param {Array} earlierDays - day arrays (index 1..n from parseDays)
 * @returns {Map<string, Array<{date: string, description: string}>>}
 */
function indexEarlierDays(earlierDays) {
  const byTopic = new Map();

  earlierDays.forEach((day) => {
    const date = day.date;
    flattenDay(day).forEach((event) => {
      const key = normaliseTopic(event.topic);
      if (!key) return;
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key).push({ date, description: event.description });
    });
  });

  return byTopic;
}

/**
 * Attach context to today's events. Returns the same day structure, but each
 * event that qualifies gets a `history` array of earlier { date, description }.
 * @param {Array<{title: string, items: object[]}>} today
 * @param {Array} earlierDays
 * @returns {{ sections: Array, hasAnyContext: boolean }}
 */
export function attachContext(today, earlierDays) {
  const byTopic = indexEarlierDays(earlierDays);
  let hasAnyContext = false;

  const sections = today.map((section) => ({
    title: section.title,
    items: section.items.map((item) => {
      const key = normaliseTopic(item.topic);
      const history = key ? byTopic.get(key) || [] : [];

      // Count distinct earlier dates for this topic.
      const distinctDates = new Set(history.map((h) => h.date));

      if (distinctDates.size >= MIN_EARLIER_DAYS) {
        hasAnyContext = true;
        return { ...item, history };
      }
      return { ...item, history: [] };
    }),
  }));

  return { sections, hasAnyContext };
}

/**
 * Produce a stable key for caching a context summary: the topic plus the set of
 * earlier dates it was built from. If Wikipedia adds a new day to the thread,
 * the key changes and the summary regenerates.
 * @param {string} topic
 * @param {Array<{date: string}>} history
 * @returns {string}
 */
export function contextCacheKey(topic, history) {
  const dates = [...new Set(history.map((h) => h.date))].sort().join('|');
  return `${normaliseTopic(topic)}::${dates}`;
}
