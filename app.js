async function fetchCurrentEvents() {
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=parse" +
    "&page=Portal:Current_events" +
    "&prop=text" +
    "&format=json" +
    "&origin=*";

  const res = await fetch(url);
  const data = await res.json();

  return data.parse.text["*"]; // HTML string
}

function htmlToDOM(htmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, "text/html");
}

async function loadCurrentEvents() {
  const html = await fetchCurrentEvents();
  const doc = htmlToDOM(html);
  return doc;
}

async function getData(){
    const data = await loadCurrentEvents()
}

getData();