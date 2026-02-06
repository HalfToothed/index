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

function extractSections(doc) {
    const result = [];

    const sections = doc.querySelectorAll(".current-events-content")[0].children;

    let currentSection = null;

    Array.from(sections).forEach(section => {
        console.log(section);
    
        if(section.tagName == 'P' ){

            currentSection = {
                title: section.textContent.trim(),
                items: []
            };
        }
        else{

            const list = section.innerText;

            currentSection.items.push(list)

            if (currentSection && currentSection.items.length > 0) {
                result.push(currentSection);
            }
        }
    });
    return result;
}

async function loadCurrentEvents() {
  const html = await fetchCurrentEvents();
  const doc = htmlToDOM(html);
  const section = extractSections(doc);
}

loadCurrentEvents();