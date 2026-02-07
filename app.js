function parseEvents(doc) {
  const events = [];

  // Get all top-level list items
  const topLevelItems = doc.querySelectorAll("#list > li");

  topLevelItems.forEach((topItem) => {
    // Get the topic/title (first anchor in the top-level li)
    const topicLink = topItem.querySelector(":scope > a");
    const topic = topicLink ? topicLink.textContent.trim() : null;

    // Find all nested event descriptions (deepest level li elements)
    const eventItems = findEventItems(topItem);

    eventItems.forEach((eventLi) => {
      const eventData = extractEventData(eventLi, topic);
      if (eventData) {
        events.push(eventData);
      }
    });
  });

  return events;
}

function findEventItems(element) {
  const eventItems = [];

  // Recursively find the deepest <li> elements that contain actual event text
  function traverse(node) {
    const childUl = node.querySelector(":scope > ul");

    if (childUl) {
      // Has nested ul, go deeper
      const childLis = childUl.querySelectorAll(":scope > li");
      childLis.forEach((li) => traverse(li));
    } else {
      // This is a leaf node (no more nesting), it's an actual event
      eventItems.push(node);
    }
  }

  traverse(element);
  return eventItems;
}

function extractEventData(eventLi, parentTopic, parentWikiUrl) {
  // Clone the node to avoid modifying the original
  const clone = eventLi.cloneNode(true);

  // Extract source links
  const sources = [];
  const externalLinks = clone.querySelectorAll("a.external");

  externalLinks.forEach((link) => {
    const sourceText = link.textContent.trim().replace(/[()]/g, "");
    const sourceUrl = link.getAttribute("href");
    sources.push({
      name: sourceText,
      url: sourceUrl,
    });
    // Remove the link from clone to clean up the description text
    link.remove();
  });

  // Get the event description (text content after removing source links)
  let description = clone.textContent.trim();

  // Get subtopic if exists (first link in the event item itself)
  const subtopicLink = eventLi.querySelector(":scope > a");
  let subtopic = null;

  if (subtopicLink && !subtopicLink.classList.contains("external")) {
    subtopic = subtopicLink.textContent.trim();
  }

  return {
    topic: parentTopic,
    subtopic: subtopic,
    description: description,
    sources: sources,
  };
}

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

  Array.from(sections).forEach((section) => {
    if (section.tagName == "P") {
      currentSection = {
        title: section.textContent.trim(),
        items: [],
      };
    } else {
      section.setAttribute("id", "list");
      const events = parseEvents(section);
      currentSection.items.push(...events);

      if (currentSection && currentSection.items.length > 0) {
        result.push(currentSection);
      }
    }
  });
  return result;
}

function getDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return now.toLocaleDateString("en-US", options);
}
function setupDOM(events) {
  const date = document.getElementById("date");
  date.textContent = getDate();

  const app = document.getElementById("app");

  events.forEach((event) => {
    const categoryDiv = document.createElement("div");
    categoryDiv.setAttribute("class", "category-section");

    let headerDiv = document.createElement("div");
    headerDiv.setAttribute("class", "category-header");
    headerDiv.textContent = event.title;

    categoryDiv.appendChild(headerDiv);

    const items = event.items;
    items.forEach((item) => {
      const eventDiv = document.createElement("div");
      eventDiv.setAttribute("class", "event");

      const eventTitleDiv = document.createElement("div");
      eventTitleDiv.setAttribute("class", "event-title");
      eventTitleDiv.textContent = item.topic;
      eventDiv.appendChild(eventTitleDiv);

      const eventTextDiv = document.createElement("div");
      eventTextDiv.setAttribute("class", "event-text");
      eventTextDiv.textContent = item.description;
      eventDiv.appendChild(eventTextDiv);

      const anchor = document.createElement("a");
      anchor.textContent = item.sources[0].name;
      anchor.href = item.sources[0].url;
      anchor.setAttribute("class", "source-badge");
      eventDiv.appendChild(anchor);

      categoryDiv.appendChild(eventDiv);
    });

    app.appendChild(categoryDiv);
  });
}

async function loadCurrentEvents() {
  const html = await fetchCurrentEvents();
  const doc = htmlToDOM(html);
  const eventObject = extractSections(doc);
  setupDOM(eventObject);
}

loadCurrentEvents();
