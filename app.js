function parseEvents(doc) {
  const events = [];

  // Get all top-level list items
  const topLevelItems = doc.querySelectorAll("#list > li");

  topLevelItems.forEach((topItem) => {
    let topic = null;
    if (topItem.innerHTML[0] == "<") {
      const topicLink = topItem.querySelector(":scope a, :scope i > a");

      if (topicLink) {
        topic = topicLink.textContent.trim();
      }
    }

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

function extractEventData(eventLi, parentTopic) {
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
  const CACHE_KEY = "wiki_current_events";
  const TIME_KEY = "wiki_last_updated";
  const ONE_HOUR = 3600000;

  const date = new Date();
  const lastUpdated = localStorage.getItem(TIME_KEY);
  const cachedValue = localStorage.getItem(CACHE_KEY);

  const currentTime = date.getTime();

  if (cachedValue && lastUpdated && currentTime - lastUpdated < ONE_HOUR) {
    return cachedValue;
  }

  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=parse" +
    "&page=Portal:Current_events" +
    "&prop=text" +
    "&format=json" +
    "&origin=*";

  try {
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);

    const data = await res.json();
    const value = data.parse.text["*"];

    localStorage.setItem(CACHE_KEY, value);
    localStorage.setItem(TIME_KEY, date.getTime());

    return value;
  } catch (error) {
    console.error("Fetch failed:", error);
    return catchedValue || null;
  }
}

function htmlToDOM(htmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, "text/html");
}

function setupNews(news){
 const newsList = news.querySelectorAll(":scope > ul > li");
  const ul = document.getElementById('newsList')

  newsList.forEach(element => {
    const li = document.createElement("li")
    li.textContent = element.textContent
    ul.appendChild(li);
  });
}

function extractSections(doc) {
  const allEvents = [];

  const allNews = doc.querySelector(".p-current-events-headlines");
  setupNews(allNews)
 

  for (let i = 0; i < 2; i += 1) {
    const result = [];
    const date = doc.querySelectorAll(".current-events-title")[i].textContent;
    const sections = doc.querySelectorAll(".current-events-content")[i]
      .children;
    const sectionsArray = Array.from(sections);

    const notEmpty = sectionsArray.some((section) => section.tagName == "P");

    if (!notEmpty) {
      const emptyResult = [{ title: "Nothing to report just yet", items: [] }];
      emptyResult.date = date;
      allEvents.push(emptyResult);
      continue;
    }

    let currentSection = null;

    sectionsArray.forEach((section) => {
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
    result.date = date;
    allEvents.push(result);
  }

  return allEvents;
}

function setupDOM(allEvents) {
  allEvents.forEach((events) => {
    const container = document.getElementsByClassName("container")[0];
    const header = document.createElement("div");
    header.setAttribute("class", "header");

    const dateDiv = document.createElement("div");
    dateDiv.setAttribute("class", "date");
    dateDiv.setAttribute("id", "date");
    dateDiv.textContent = events.date;
    header.appendChild(dateDiv);

    const app = document.createElement("div");
    app.setAttribute("id", "app");

    events.forEach((event) => {
      const categoryDiv = document.createElement("div");
      categoryDiv.setAttribute("class", "category-section");

      let headerDiv = document.createElement("div");
      headerDiv.setAttribute("class", "category-header");
      headerDiv.textContent = event.title;

      categoryDiv.appendChild(headerDiv);

      let eventDiv = null;
      let lastTopic = "";

      const items = event.items;
      items.forEach((item) => {
        if (lastTopic != item.topic) {
          eventDiv = document.createElement("div");
          eventDiv.setAttribute("class", "event");

          const eventTitleDiv = document.createElement("div");
          eventTitleDiv.setAttribute("class", "event-title");
          eventTitleDiv.textContent = item.topic;
          eventDiv.appendChild(eventTitleDiv);
        }

        lastTopic = item.topic;

        const eventTextDiv = document.createElement("div");
        eventTextDiv.setAttribute("class", "event-text");
        eventTextDiv.textContent = item.description;
        eventDiv.appendChild(eventTextDiv);

        if (item.sources.length) {
          item.sources.forEach((source) => {
            const anchor = document.createElement("a");
            anchor.textContent = source.name;
            anchor.href = source.url;
            anchor.target = "_blank";
            anchor.setAttribute("class", "source-badge");
            eventDiv.appendChild(anchor);
          });
        }

        categoryDiv.appendChild(eventDiv);
      });

      app.appendChild(categoryDiv);
    });

    container.appendChild(header);
    container.appendChild(app);
  });
}

async function loadCurrentEvents() {
  const html = await fetchCurrentEvents();
  const doc = htmlToDOM(html);
  const eventObject = extractSections(doc);
  setupDOM(eventObject);
}

loadCurrentEvents();
