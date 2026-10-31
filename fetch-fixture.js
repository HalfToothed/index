// fetch-fixture.js
// One-off helper to save the live Wikipedia portal JSON to fixture.json for
// local testing (useful when the local network blocks the Wikipedia TLS cert).
// Run once on a machine with network access: `node fetch-fixture.js`.
// Not used in production.

import { writeFile } from 'fs/promises';

const URL =
  'https://en.wikipedia.org/w/api.php' +
  '?action=parse&page=Portal:Current_events&prop=text&format=json&formatversion=2';

const res = await fetch(URL, {
  headers: { 'User-Agent': 'Index/2.0 (fixture fetch)' },
});
const data = await res.json();
await writeFile('fixture.json', JSON.stringify(data));
console.log('Saved fixture.json');
