// == START Constants ==
console.log("TheLounge 7TV Emotes: Content script loaded (GraphQL Only, Multi-Category, Lazy Load + Picker + Config).");

// Removed SEVENTV_API_GLOBAL_URL
const SEVENTV_API_GQL_URL = "https://7tv.io/v4/gql"; // Using v4
const EMOTE_CLASS_NAME = 'seventv-emote'; // For styling rendered emotes
const PROCESSED_MARKER_CLASS = 'seventv-processed'; // To avoid reprocessing messages
const LAZY_LOAD_CLASS = 'seventv-emote-lazy'; // Class for observer to find
const PLACEHOLDER_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent GIF

const PICKER_ID = 'seventv-custom-emote-picker'; // ID for our picker UI
const PICKER_ITEM_CLASS = 'seventv-picker-item';
const PICKER_SELECTED_CLASS = 'selected';
const MAX_PICKER_RESULTS = 20; // Max emotes to show in picker

// --- Configuration Default ---
const DEFAULT_EMOTE_SIZE = '1.5em'; // Define default size

// --- GraphQL Fetch Settings ---
const SORT_CATEGORIES = [ // Categories to fetch via GraphQL
    "TOP_ALL_TIME",
    "TRENDING_WEEKLY",
    "TRENDING_MONTHLY",
    "TRENDING_DAILY",
    "UPLOAD_DATE"
];
const MAX_GQL_PAGES_PER_CATEGORY = 2; // Fetch first N pages for EACH category (adjust as needed)
const GQL_EMOTES_PER_PAGE = 150; // How many emotes per page request (max might be 150 or 200?)

// --- Selectors ---
const CHAT_MESSAGES_CONTAINER_SELECTOR = '.chat-content > .chat > .messages';
const MESSAGE_CONTAINER_SELECTOR = 'div[id^="msg-"]';
const MESSAGE_TEXT_SELECTOR = 'span.content';
// --- End Selectors ---

// --- Base GraphQL Payload (sortBy and page will be modified) ---
const BASE_GQL_QUERY_PAYLOAD = {
    operationName: "EmoteSearch",
    // Ensure this query is correct for v4 and includes pageCount/totalCount if possible
    query: `query EmoteSearch($query: String, $tags: [String!]!, $sortBy: SortBy!, $filters: Filters, $page: Int, $perPage: Int!, $isDefaultSetSet: Boolean!, $defaultSetId: Id!) {
  emotes {
    search(
      query: $query
      tags: {tags: $tags, match: ANY}
      sort: {sortBy: $sortBy, order: DESCENDING}
      filters: $filters
      page: $page
      perPage: $perPage
    ) {
      items {
        id
        defaultName
        owner {
          mainConnection {
            platformDisplayName
            __typename
          }
          style {
            activePaint {
              id
              name
              data {
                layers {
                  id
                  ty {
                    __typename
                    ... on PaintLayerTypeSingleColor {
                      color {
                        hex
                        __typename
                      }
                      __typename
                    }
                    ... on PaintLayerTypeLinearGradient {
                      angle
                      repeating
                      stops {
                        at
                        color {
                          hex
                          __typename
                        }
                        __typename
                      }
                      __typename
                    }
                    ... on PaintLayerTypeRadialGradient {
                      repeating
                      stops {
                        at
                        color {
                          hex
                          __typename
                        }
                        __typename
                      }
                      shape
                      __typename
                    }
                    ... on PaintLayerTypeImage {
                      images {
                        url
                        mime
                        size
                        scale
                        width
                        height
                        frameCount
                        __typename
                      }
                      __typename
                    }
                  }
                  opacity
                  __typename
                }
                shadows {
                  color {
                    hex
                    __typename
                  }
                  offsetX
                  offsetY
                  blur
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
          highestRoleColor {
            hex
            __typename
          }
          __typename
        }
        deleted
        flags {
          defaultZeroWidth
          private
          publicListed
          __typename
        }
        imagesPending
        images {
          url
          mime
          size
          scale
          width
          frameCount
          __typename
        }
        ranking(ranking: TRENDING_WEEKLY)
        inEmoteSets(emoteSetIds: [$defaultSetId]) @include(if: $isDefaultSetSet) {
          emoteSetId
          emote {
            id
            alias
            __typename
          }
          __typename
        }
        __typename
      }
      totalCount
      pageCount
      __typename
    }
    __typename
  }
}`, // Simplified query example - USE YOUR FULL WORKING QUERY
    variables: {
        defaultSetId: "",
        filters: {},
        isDefaultSetSet: false,
        page: 1, // Placeholder, will be overridden
        perPage: GQL_EMOTES_PER_PAGE,
        query: null,
        sortBy: "", // Placeholder, will be overridden
        tags: []
    },
};
// --- End Base GraphQL Payload ---
// == END Constants ==


// == START Global Variables ==
let emoteMap = new Map();
let emotesLoading = false;
let emotesLoaded = false;
let customPickerElement = null;
let chatInputElement = null;
let currentPickerSearchTerm = '';
let currentEmoteSize = DEFAULT_EMOTE_SIZE;
// == END Global Variables ==


// == START Configuration Loading ==
async function loadConfiguration() {
    try {
        const items = await chrome.storage.sync.get({ emoteSize: DEFAULT_EMOTE_SIZE });
        if (items.emoteSize && /^\d+(\.\d+)?(em|px)$/i.test(items.emoteSize)) {
             currentEmoteSize = items.emoteSize;
             console.log("Configuration loaded - Emote Size:", currentEmoteSize);
        } else {
            console.warn("Invalid emote size found in storage, using default:", DEFAULT_EMOTE_SIZE);
            currentEmoteSize = DEFAULT_EMOTE_SIZE;
        }
    } catch (error) {
        console.error("Error loading configuration:", error);
        currentEmoteSize = DEFAULT_EMOTE_SIZE;
    }
}
// == END Configuration Loading ==


// == START Emote Fetching Functions ==

// --- Helper to process GraphQL items and add unique emotes to map ---
function processGraphQLItems(items) {
    let pageAddedCount = 0;
    if (!items || !Array.isArray(items)) {
        console.warn("No items found in GraphQL page response or invalid format.");
        return pageAddedCount;
    }
    items.forEach(item => {
        const name = item.defaultName;
        let imageUrl = null;
        if (name && item.images?.length > 0) {
             const webp1x = item.images.find(img => img.mime === 'image/webp' && img.url.includes('/1x.webp'));
             const webp2x = item.images.find(img => img.mime === 'image/webp' && img.url.includes('/2x.webp'));
             const anyWebp = item.images.find(img => img.mime === 'image/webp');
             const firstImage = item.images[0];
             if (webp1x) imageUrl = webp1x.url;
             else if (webp2x) imageUrl = webp2x.url;
             else if (anyWebp) imageUrl = anyWebp.url;
             else if (firstImage) imageUrl = firstImage.url;
        }
        // Add ONLY if name/URL exist AND it's not already in the map
        if (name && imageUrl && !emoteMap.has(name)) {
            emoteMap.set(name, imageUrl);
            pageAddedCount++;
        }
    });
    return pageAddedCount;
}


// --- Fetches pages for a SINGLE GraphQL category (sortBy) ---
async function fetchGraphQLCategoryPages(sortBy, maxPages) {
    console.log(`Fetching category "${sortBy}" - Max ${maxPages} pages...`);
    let categoryAddedCount = 0;
    let totalPages = 1;

    try {
        // --- Fetch Page 1 for this category ---
        const page1Payload = JSON.parse(JSON.stringify(BASE_GQL_QUERY_PAYLOAD)); // Deep copy
        page1Payload.variables.sortBy = sortBy;
        page1Payload.variables.page = 1;

        const response1 = await fetch(SEVENTV_API_GQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(page1Payload),
        });
        if (!response1.ok) throw new Error(`Category ${sortBy} Page 1 HTTP error! status: ${response1.status}`);
        const data1 = await response1.json();

        if (data1?.errors) {
             console.error(`GraphQL errors on ${sortBy} Page 1:`, JSON.stringify(data1.errors, null, 2));
             return 0; // Return 0 added if page 1 fails critically
        }

        const searchResult = data1?.data?.emotes?.search;
        categoryAddedCount += processGraphQLItems(searchResult?.items);

        // Determine total pages for this category
        totalPages = searchResult?.pageCount > 0 ? searchResult.pageCount : 1;
        console.log(`Category "${sortBy}" Page 1: Added ${categoryAddedCount} emotes. Total Pages: ${totalPages}`);

        // --- Fetch Subsequent Pages for this category ---
        const pagesToFetch = Math.min(totalPages, maxPages);
        if (pagesToFetch > 1) {
            const pagePromises = [];
            for (let page = 2; page <= pagesToFetch; page++) {
                const pagePayload = JSON.parse(JSON.stringify(BASE_GQL_QUERY_PAYLOAD));
                pagePayload.variables.sortBy = sortBy;
                pagePayload.variables.page = page;
                pagePromises.push(
                    fetch(SEVENTV_API_GQL_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pagePayload),
                    }).then(res => res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)) // Basic fetch and parse
                      .catch(err => ({ page, error: err })) // Catch fetch/parse errors per page
                );
            }

            const pageResults = await Promise.allSettled(pagePromises);

            pageResults.forEach((result, index) => {
                const pageNum = index + 2;
                if (result.status === 'fulfilled') {
                    const pageData = result.value;
                    // Check for errors within the successful fetch/parse
                    if (pageData?.error) { // Check for our custom error object
                        console.error(`Failed to fetch/parse ${sortBy} Page ${pageNum}:`, pageData.error);
                    } else if (pageData?.errors) {
                        console.error(`GraphQL errors on ${sortBy} Page ${pageNum}:`, JSON.stringify(pageData.errors, null, 2));
                    } else {
                        const added = processGraphQLItems(pageData?.data?.emotes?.search?.items);
                        // console.log(`Category "${sortBy}" Page ${pageNum}: Added ${added} emotes.`);
                        categoryAddedCount += added;
                    }
                } else { // status === 'rejected' (should be caught by .catch above, but good practice)
                    console.error(`Unexpected rejection fetching ${sortBy} Page ${pageNum}:`, result.reason);
                }
            });
        }
        console.log(`Finished fetching category "${sortBy}". Total added in category: ${categoryAddedCount}`);
        return categoryAddedCount; // Return total added for this category

    } catch (error) {
        console.error(`Failed during fetch process for category "${sortBy}":`, error);
        return categoryAddedCount; // Return whatever was added before the failure
    }
}


// --- Main function to fetch all desired GraphQL categories ---
async function fetchAllGraphQLEmotes() {
    console.log("Fetching all specified GraphQL emote categories...");
    emoteMap.clear(); // Clear map before starting all fetches
    emotesLoading = true;
    emotesLoaded = false;

    const categoryFetchPromises = SORT_CATEGORIES.map(category =>
        fetchGraphQLCategoryPages(category, MAX_GQL_PAGES_PER_CATEGORY)
    );

    // Wait for all category fetches to settle (complete or fail)
    const results = await Promise.allSettled(categoryFetchPromises);

    // Log results for each category
    results.forEach((result, index) => {
        const category = SORT_CATEGORIES[index];
        if (result.status === 'fulfilled') {
            console.log(`Category fetch "${category}" completed. Added: ${result.value} unique emotes.`);
        } else {
            console.error(`Category fetch "${category}" failed:`, result.reason);
        }
    });

    emotesLoading = false;
    if (emoteMap.size > 0) {
        emotesLoaded = true;
        console.log(`Finished fetching all categories. Total unique emotes loaded: ${emoteMap.size}`);
        return true; // Indicate overall success (at least some emotes loaded)
    } else {
        console.error("Failed to load ANY emotes from any category.");
        emotesLoaded = false;
        return false; // Indicate overall failure
    }
}
// == END Emote Fetching Functions ==


// == START DOM Manipulation & Lazy Loading ==

function createEmoteImgElement(name, url) {
    const img = document.createElement('img');
    img.src = PLACEHOLDER_IMG;
    img.dataset.src = url;
    img.alt = name;
    img.title = name;
    img.classList.add(EMOTE_CLASS_NAME);
    img.classList.add(LAZY_LOAD_CLASS);
    img.style.height = currentEmoteSize; // Use configured size
    img.style.verticalAlign = 'middle';
    img.style.margin = '0 1px';
    return img;
}

function processNode(node) {
    if (!emotesLoaded || emoteMap.size === 0) return [];
    let addedImages = [];
    if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.nodeValue;
        const words = textContent.split(/(\s+)/);
        if (words.some(word => emoteMap.has(word))) {
            const fragment = document.createDocumentFragment();
            let replaced = false;
            words.forEach(word => {
                const emoteUrl = emoteMap.get(word);
                if (emoteUrl) {
                    const img = createEmoteImgElement(word, emoteUrl);
                    fragment.appendChild(img);
                    addedImages.push(img);
                    replaced = true;
                } else {
                    fragment.appendChild(document.createTextNode(word));
                }
            });
            if (replaced && node.parentNode) {
                   node.replaceWith(fragment);
            }
        }
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains(EMOTE_CLASS_NAME) && node.tagName !== 'IMG' && node.tagName !== 'A') {
        const children = Array.from(node.childNodes);
        children.forEach(child => {
            addedImages = addedImages.concat(processNode(child));
        });
    }
    return addedImages;
}

function setupLazyLoader(containerElement) {
    if (window.thelounge7tvLazyObserver) window.thelounge7tvLazyObserver.disconnect();
    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const realSrc = img.dataset.src;
                if (realSrc) {
                    img.src = realSrc;
                    img.classList.remove(LAZY_LOAD_CLASS);
                    observer.unobserve(img);
                }
            }
        });
    }, { root: containerElement, rootMargin: '250px 0px', threshold: 0.01 });
    const imagesToLoad = containerElement.querySelectorAll(`img.${LAZY_LOAD_CLASS}`);
    console.log(`Setting up IntersectionObserver for ${imagesToLoad.length} initial lazy images.`);
    imagesToLoad.forEach(img => lazyLoadObserver.observe(img));
    window.thelounge7tvLazyObserver = lazyLoadObserver;
}
// == END DOM Manipulation & Lazy Loading ==


// == START Custom Emote Picker Logic ==
function createCustomPickerUI() { /* ... Keep implementation ... */
    let picker = document.getElementById(PICKER_ID);
    if (picker) return picker;
    picker = document.createElement('div');
    picker.id = PICKER_ID;
    picker.className = 'seventv-emote-picker';
    picker.innerHTML = '<ul></ul>';
    document.body.appendChild(picker);
    picker.querySelector('ul').addEventListener('click', (event) => {
        const listItem = event.target.closest('li.' + PICKER_ITEM_CLASS);
        if (listItem && chatInputElement) {
            const emoteName = listItem.dataset.emoteName;
            if (emoteName) insertEmoteInInput(emoteName);
        }
    });
    return picker;
}
function updateCustomPicker(searchTerm) { /* ... Keep implementation ... */
    if (!customPickerElement || !emotesLoaded || emoteMap.size === 0) { hideCustomPicker(); return; }
    const listElement = customPickerElement.querySelector('ul');
    listElement.innerHTML = '';
    if (!searchTerm) { hideCustomPicker(); return; }
    const lowerSearchTerm = searchTerm.toLowerCase();
    let results = [];
    for (const [name, url] of emoteMap.entries()) {
        if (name.toLowerCase().startsWith(lowerSearchTerm)) {
            results.push({ name, url });
            if (results.length >= MAX_PICKER_RESULTS) break;
        }
    }
    if (results.length > 0) {
        results.sort((a, b) => a.name.localeCompare(b.name));
        results.forEach((emote, index) => {
            const li = document.createElement('li');
            li.className = PICKER_ITEM_CLASS;
            li.dataset.emoteName = emote.name;
            const img = document.createElement('img');
            img.src = emote.url; img.alt = emote.name; img.classList.add(EMOTE_CLASS_NAME);
            img.style.height = '20px'; img.style.width = '20px'; img.style.marginRight = '6px';
            img.style.verticalAlign = 'middle'; img.style.objectFit = 'contain';
            const span = document.createElement('span'); span.textContent = emote.name; span.style.verticalAlign = 'middle';
            li.appendChild(img); li.appendChild(span); listElement.appendChild(li);
            if (index === 0) li.classList.add(PICKER_SELECTED_CLASS);
        });
        positionCustomPicker(); customPickerElement.style.display = 'block';
    } else { hideCustomPicker(); }
}
function hideCustomPicker() { /* ... Keep implementation ... */
    if (customPickerElement) customPickerElement.style.display = 'none';
    currentPickerSearchTerm = '';
}
function positionCustomPicker() { /* ... Keep implementation ... */
    if (!customPickerElement || !chatInputElement) return;
    const inputRect = chatInputElement.getBoundingClientRect(); const bodyRect = document.body.getBoundingClientRect();
    customPickerElement.style.bottom = `${window.innerHeight - inputRect.top - window.scrollY}px`;
    customPickerElement.style.left = `${inputRect.left - bodyRect.left}px`;
    customPickerElement.style.width = `${Math.max(inputRect.width, 150)}px`;
}
function insertEmoteInInput(emoteName) { /* ... Keep implementation ... */
    if (!chatInputElement) return;
    const currentValue = chatInputElement.value; const cursorPos = chatInputElement.selectionStart;
    const textBeforeCursor = currentValue.substring(0, cursorPos); const colonIndex = textBeforeCursor.lastIndexOf(':');
    if (colonIndex !== -1) {
        const potentialTerm = textBeforeCursor.substring(colonIndex + 1);
        if (currentPickerSearchTerm !== '' && potentialTerm.toLowerCase().startsWith(currentPickerSearchTerm.substring(0, 1).toLowerCase())) {
             const textBeforeColon = currentValue.substring(0, colonIndex);
             const textAfterTerm = currentValue.substring(cursorPos);
             const newValue = textBeforeColon + emoteName + ' ' + textAfterTerm;
             chatInputElement.value = newValue;
             const newCursorPos = colonIndex + emoteName.length + 1;
             chatInputElement.focus(); chatInputElement.setSelectionRange(newCursorPos, newCursorPos);
             chatInputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    hideCustomPicker();
}
function handleChatInput(event) { /* ... Keep implementation ... */
    const input = event.target; const value = input.value; const cursorPos = input.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos); const match = textBeforeCursor.match(/:(\w*)$/);
    if (match) { currentPickerSearchTerm = match[1]; updateCustomPicker(currentPickerSearchTerm); }
    else { hideCustomPicker(); }
}
function handlePickerKeyDown(event) { /* ... Keep implementation ... */
    if (!customPickerElement || customPickerElement.style.display === 'none') return;
    const listItems = customPickerElement.querySelectorAll('li.' + PICKER_ITEM_CLASS); if (listItems.length === 0) return;
    let currentIndex = -1; listItems.forEach((item, index) => { if (item.classList.contains(PICKER_SELECTED_CLASS)) currentIndex = index; });
    let handled = false;
    switch (event.key) {
        case 'ArrowDown': /* ... Keep navigation ... */
            let nextIndex = currentIndex + 1; if (nextIndex >= listItems.length) nextIndex = 0;
            if (currentIndex !== -1) listItems[currentIndex].classList.remove(PICKER_SELECTED_CLASS);
            listItems[nextIndex].classList.add(PICKER_SELECTED_CLASS); listItems[nextIndex].scrollIntoView({ block: 'nearest' });
            handled = true; break;
        case 'ArrowUp': /* ... Keep navigation ... */
            let prevIndex = currentIndex - 1; if (prevIndex < 0) prevIndex = listItems.length - 1;
            if (currentIndex !== -1) listItems[currentIndex].classList.remove(PICKER_SELECTED_CLASS);
            listItems[prevIndex].classList.add(PICKER_SELECTED_CLASS); listItems[prevIndex].scrollIntoView({ block: 'nearest' });
            handled = true; break;
        case 'Enter': case 'Tab': /* ... Keep selection ... */
            if (currentIndex !== -1) { const selectedEmote = listItems[currentIndex].dataset.emoteName; insertEmoteInInput(selectedEmote); }
            else { hideCustomPicker(); } handled = true; break;
        case 'Escape': hideCustomPicker(); handled = true; break;
    }
    if (handled) { event.preventDefault(); event.stopPropagation(); }
}
function hidePickerOnClickOutside(event) { /* ... Keep implementation ... */
    if (customPickerElement && customPickerElement.style.display === 'block') {
        if (!customPickerElement.contains(event.target) && event.target !== chatInputElement) hideCustomPicker();
    }
}
// == END Custom Emote Picker Logic ==


// == START Mutation Observer ==
function handleMutations(mutationsList) { /* ... Keep implementation ... */
    if (!emotesLoaded || emoteMap.size === 0 || !window.thelounge7tvLazyObserver) return;
    let imagesToAdd = [];
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(newNode => {
                if (newNode.nodeType === Node.ELEMENT_NODE) {
                    if (newNode.matches && newNode.matches(MESSAGE_CONTAINER_SELECTOR) && !newNode.classList.contains(PROCESSED_MARKER_CLASS)) {
                        const messageTextElement = newNode.querySelector(MESSAGE_TEXT_SELECTOR);
                        if (messageTextElement) { imagesToAdd = imagesToAdd.concat(processNode(messageTextElement)); newNode.classList.add(PROCESSED_MARKER_CLASS); }
                    } else if (newNode.querySelectorAll) {
                        const newMessages = newNode.querySelectorAll(`${MESSAGE_CONTAINER_SELECTOR}:not(.${PROCESSED_MARKER_CLASS})`);
                        newMessages.forEach(msgNode => {
                             const messageTextElement = msgNode.querySelector(MESSAGE_TEXT_SELECTOR);
                             if (messageTextElement) { imagesToAdd = imagesToAdd.concat(processNode(messageTextElement)); msgNode.classList.add(PROCESSED_MARKER_CLASS); }
                        });
                    }
                }
            });
        }
    }
    if (imagesToAdd.length > 0 && window.thelounge7tvLazyObserver) {
        imagesToAdd.forEach(img => window.thelounge7tvLazyObserver.observe(img));
    }
}
// == END Mutation Observer ==


// == START Initialization ==
async function initialize() {
    if (window.thelounge7tvInitializing) return;
    window.thelounge7tvInitializing = true;
    console.log("Starting initialization sequence...");

    // --- Load Configuration FIRST ---
    await loadConfiguration();

    // --- Fetch Emotes (only if not already loaded) ---
    if (emotesLoaded && emoteMap.size > 0) {
        console.log("Emotes already loaded. Skipping fetch, ensuring UI is set up.");
    } else {
        // Call the new function to fetch all categories
        const fetchSuccess = await fetchAllGraphQLEmotes(); // This now handles loading/loaded flags internally
        if (!fetchSuccess) {
            // Handle case where absolutely no emotes could be fetched
             window.thelounge7tvInitializing = false;
             return; // Stop if fetch failed critically
        }
    }

    // --- Find Required DOM Elements ---
    const chatMessagesContainer = document.querySelector(CHAT_MESSAGES_CONTAINER_SELECTOR);
    chatInputElement = document.querySelector('#input');

    if (!chatMessagesContainer || !chatInputElement) {
        console.error(`Could not find required elements (Container: ${!!chatMessagesContainer}, Input: ${!!chatInputElement}). Retrying...`);
        emotesLoaded = false; // Allow retry to fetch emotes again if elements aren't found
        window.thelounge7tvInitializing = false;
        setTimeout(initialize, 5000);
        return;
    }
    console.log("Container and Input found. Setting up UI, listeners, and observers.");

    // --- Setup UI and Listeners ---
    customPickerElement = createCustomPickerUI();
    chatInputElement.removeEventListener('keydown', handlePickerKeyDown, true);
    chatInputElement.addEventListener('keydown', handlePickerKeyDown, true);
    chatInputElement.removeEventListener('input', handleChatInput);
    chatInputElement.addEventListener('input', handleChatInput);
    document.removeEventListener('click', hidePickerOnClickOutside);
    document.addEventListener('click', hidePickerOnClickOutside);

    // --- Process Existing Messages & Setup Observers ---
    let initialImagesToObserve = [];
    try {
        const existingMessages = chatMessagesContainer.querySelectorAll(`${MESSAGE_CONTAINER_SELECTOR}:not(.${PROCESSED_MARKER_CLASS})`);
        console.log(`Processing ${existingMessages.length} existing messages.`);
        existingMessages.forEach(msgNode => {
             const messageTextElement = msgNode.querySelector(MESSAGE_TEXT_SELECTOR);
             if (messageTextElement) {
                 initialImagesToObserve = initialImagesToObserve.concat(processNode(messageTextElement));
                 msgNode.classList.add(PROCESSED_MARKER_CLASS);
             }
        });
    } catch (error) { console.error("Error processing existing messages:", error); }

    setupLazyLoader(chatMessagesContainer);

    if (window.thelounge7tvObserver) window.thelounge7tvObserver.disconnect();
    const observer = new MutationObserver(handleMutations);
    const config = { childList: true, subtree: false };
    observer.observe(chatMessagesContainer, config);
    window.thelounge7tvObserver = observer;
    console.log("Mutation Observer started.");

    // --- Attempt to Hide Default Picker ---
    const defaultPickerSelector = "ul.textcomplete-menu[data-strategy='emoji']";
    try {
        const existingStyle = document.getElementById('seventv-hide-default-picker-style');
        if (!existingStyle) {
            const style = document.createElement('style');
            style.id = 'seventv-hide-default-picker-style';
            style.textContent = `${defaultPickerSelector} { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
            document.head.appendChild(style);
            console.log(`Attempting to hide default picker using selector: ${defaultPickerSelector}`);
        }
    } catch (e) { console.error("Failed to inject style to hide default picker", e); }

    // --- Initialization Complete ---
    window.thelounge7tvInitializing = false;
    console.log("TheLounge 7TV Emotes Initialization complete.");
}

// Delay initial run slightly
if ('requestIdleCallback' in window) {
    requestIdleCallback(initialize, { timeout: 5000 });
} else {
    setTimeout(initialize, 500);
}
// == END Initialization ==