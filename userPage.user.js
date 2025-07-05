// ==UserScript==
// @name         Archive.org Simple Viewer
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Simple viewer that works with Ctrl+F
// @author       Franco Drachenberg
// @match        https://archive.org/details/@*
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// @downloadURL  https://github.com/FDrach/Archive.org-simple-viewer/raw/refs/heads/master/userPage.user.js
// ==/UserScript==

(function () {
  "use strict";

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script starting (v1.5)."
  );

  const HITS_PER_PAGE = 250;
  const MAX_RETRIES = 7;
  const RETRY_DELAY = 1000;

  let allFetchedItems = [];
  let currentTargetElement = null;
  let globalIsPageTargetOwner = false;

  const icons = {
    downloads:
      '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M98 51C71 6 30 5 2 51c28 44 66 45 96 0zm-25 0c0 31-47 30-47 0 0-32 47-31 47 0zM50 40c14 0 14 21 0 21s-14-21 0-21z"/></svg>',
    favorites:
      '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M81 100 50 77l-31 23 11-37L0 37h38L50 0l12 37h38L70 63z"/></svg>',
    reviews:
      '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="m100 8-2-6-6-2H8L2 2 0 8v51l2 6 6 2h10l1 33 32-33h41l6-2c2-1 2-4 2-6z"/></svg>',
    size: '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path id="c" d="M15 12H8c-4 0-3-4 0-5l4-1 1-4c1-3 5-2 5 0v7c0 3 0 3-3 3z"/><path id="l" d="M65 71H33c-3 0-3-6 0-6h32c3 0 3 6 0 6z"/><use href="#c" transform="matrix(-1 0 0 1 98 0)"/><use href="#c" transform="rotate(180 49 49)"/><use href="#c" transform="matrix(1 0 0 -1 0 98)"/><use href="#l" transform="translate(0 -12)"/><use href="#l" transform="translate(0 -24)"/><use href="#l" transform="matrix(.6 0 0 1 13 -38)"/><path fill="currentColor" d="M79 84a1 1 0 0 1-1 1H20a1 1 0 0 1-1-1V14a1 1 0 0 1 1-1h58a1 1 0 0 1 1 1v70Zm-5-65a1 1 0 0 0-1-1H25a1 1 0 0 0-1 1v60a1 1 0 0 0 1 1h48a1 1 0 0 0 1-1V19Z"/></svg>',

    edit: '<svg class="action-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="m49 25 28 35H60v31H39V60H22ZM91 8v10H8V8Z"/></svg>',
    editMeta: '<svg class="action-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="currentColor" d="M788 750v172c0 16-9 28-24 33l-17 1-606 1q-13 0-17-2c-12-4-20-13-23-25l-1-12V102c0-15 10-28 24-33l16-1h422c11 0 23 6 32 14l115 115v1l-20 21a1 1 44 0 1-1 0l-98-98-5-4c-12-8-25 1-27 14l-1 10v133l1 9c0 13 10 23 23 23h23a1 1-68 0 1 1 1L482 437a2 2-68 0 1-2 0H230c-25 0-42 19-42 43v221l1 18c4 15 16 27 31 30l12 1h556Zm87-535q-2 0-3-2l-84-76v-1l39-41c14-14 35-17 51-4q19 15 35 31l7 10c5 11 5 22 0 32l-11 14-34 37Z"/><path d="m525 471-27-25 262-276 28 25-262 275-1 1Z"/><path fill="#fff" d="m422 268-73-42a1 1 30 0 1 0-2l16-28a2 2 31 0 1 2-1l98 59c7 4 6 11 6 19q0 5-5 8l-100 61a1 1 58 0 1-1-1l-17-28a1 1 59 0 1 0-1l74-43a1 1 45 0 0 0-1Zm-202 0v1l74 43a1 1-60 0 1 1 0l-17 29a1 1-62 0 1-1 0l-4-3-92-55c-5-3-8-6-8-12-1-8-1-14 7-19l96-57a1 1 4 0 1 1 1l18 29-75 43Z"/><path d="m582 522-27-24a1 1 85 0 1 0-1l262-275 27 25-261 275a1 1-17 0 1-1 0Zm206-85h-99l99-105v105ZM364 609l-3 9-20 43a2 2-77 0 1-2 1h-39l42-76a1 1 46 0 0 0-1l-39-74h40a2 2-12 0 1 1 1l22 46h1l20-46a1 1-78 0 1 1-1h39l-38 74a2 2-46 0 0 0 2l41 75h-42l-24-53Zm379 53h-94a1 1 0 0 1-1 0V511a1 1-55 0 1 1 0h36a1 1 0 0 1 1 0v119h57a1 1 0 0 1 0 1v31ZM602 528h1v134a1 1-45 0 1-1 0h-34l1-56q0-18 4-43a1 1 84 0 0 0-1h-1a2 2 89 0 0-1 2q-14 42-32 85a1 1-78 0 1-1 0h-18l-27-69a1 1-21 0 1 1-2l24-9h1l11 32a1 1-43 0 0 1 0l1-3 16-42a1 1-45 0 1 0-1l39-15 7-4 8-8Zm-100 32-28 11a1 1 5 0 1-1 0l-12-12a1 1-86 0 1-1-1l9-28a1 1 45 0 1 1 0l32 29a1 1 90 0 1 0 1Zm-45 101v-65a2 2-12 0 1 1-2l31-13 2 30v51h-33a1 1-45 0 1-1-1Z"/></svg>',
  };
  const galleryCSS = `
    #custom-gallery-wrapper {
      display: flex;
      gap: 15px;
      margin-top: 10px;
    }
    #custom-gallery-sidebar {
      width: 200px;
      padding: 15px;
      background-color: #f0f0f0;
      border-radius: 5px;
      border: 1px solid #ddd;
      flex-shrink: 0;
      height: fit-content;
      position: sticky;
      top: 10px;
    }
    #results-count-area {
      font-size: 0.9em;
      color: #333;
      margin-bottom: 10px;
      font-weight: bold;
    }
    #search-input-area input[type="text"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
      font-size: 0.9em;
    }
    #custom-gallery-main-content {
      flex-grow: 1;
    }
    #custom-user-uploads-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
    }
    .custom-gallery-item {
      position: relative;
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: #333;
      border: 1px solid #ccc;
      border-radius: 4px;
      overflow: visible;
      background-color: #fff;
      transition: box-shadow 0.2s ease-in-out;
    }
    .custom-gallery-item-actions {
      position: absolute;
      top: 5px;
      right: 5px;
      z-index: 10;
      display: flex; gap: 5px;
    }
    .action-link {
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: 1px solid #ccc;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .action-link:hover {
      opacity: 1;
      background-color: white;
    }
    .action-link .action-icon-svg {
      width: 14px;
      height: 14px;
    }
    .custom-gallery-item:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      border-color: #aaa;
    }
    .custom-gallery-item-thumbnail-link {
      display: block;
    }
    .custom-gallery-item img {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-bottom: 1px solid #eee;
    }
    .custom-gallery-item-info {
      padding: 8px;
      font-size: 0.8em;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
    .custom-gallery-item-title {
      font-size: 1.1em;
      font-weight: bold;
      margin-bottom: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #1a0dab;
    }
    .custom-gallery-item-title:hover {
      text-decoration: underline;
    }
    .custom-gallery-item-meta {
      margin-bottom: 3px;
      display: flex;
      align-items: center;
    }
    .custom-gallery-item-meta.stats-line {
      justify-content: space-between;
      flex-wrap: wrap;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #eee;
      color: #555;
    }
    .custom-gallery-item-meta.stats-line > div {
      display: flex;
      align-items: center;
      margin-right: 5px;
      margin-bottom: 2px;
    }
    .custom-gallery-item-meta.stats-line > div:last-child {
      margin-right: 0;
    }
    .meta-icon {
      width: 1em;
      height: 1em;
      margin-right: 3px;
      vertical-align: middle;
      fill: currentColor;
    }
    .custom-gallery-item-meta strong {
      color: #555;
      margin-right: 4px;
    }
    .custom-gallery-item-subjects {
      margin-top: 4px;
      font-style: italic;
      color: #666;
      max-height: 3.6em;
      overflow-y: auto;
      word-break: break-word;
      line-height: 1.2em;
    }
    #gallery-loading-message,
    #gallery-error-message {
      font-size: 1.2em;
      padding: 20px;
      text-align: center;
      color: #555;
      width: 100%;
    }
    `;

  function getUsername() {
    return window.location.pathname.split("/@").pop().split("/")[0];
  }

  function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return "0B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i === 0 && bytes < 100) return `${bytes}${sizes[i]}`;
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
  }
  function formatDate(dateString) {
    if (!dateString) return "N/A";
    try {
      const d = new Date(dateString);
      return `${d.getFullYear()}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
    } catch (e) {
      return dateString;
    }
  }

  function createGalleryItemHtml(item) {
    const fields = item.fields;
    const identifier = fields.identifier;
    const title = fields.title || identifier;
    const thumbnailUrl = `https://archive.org/services/img/${identifier}`;
    const itemUrl = `https://archive.org/details/${identifier}`;
    const editUrl = `https://archive.org/upload/?identifier=${identifier}`;
    const editMetaUrl = `https://archive.org/editxml/${identifier}`;

    const numFavorites = fields.num_favorites || 0;
    const numReviews = fields.num_reviews || 0;
    const itemSizeFormatted = fields.item_size
      ? formatBytes(fields.item_size)
      : "N/A";
    const downloads = fields.downloads || 0;
    const addedDate = formatDate(fields.addeddate || fields.publicdate);
    const creator =
      fields.creator && fields.creator.length > 0
        ? fields.creator.join(", ")
        : "Unset";
    const subjects =
      fields.subject && fields.subject.length > 0
        ? fields.subject.join(", ")
        : "<i>None</i>";

    const ownerActionsHtml = globalIsPageTargetOwner
      ? `<div class="custom-gallery-item-actions">
           <a href="${editMetaUrl}" target="_blank" class="action-link" title="Edit metadata for '${identifier}'">${icons.editMeta}</a>
           <a href="${editUrl}" target="_blank" class="action-link" title="Upload to/Edit files in '${identifier}'">${icons.edit}</a>
         </div>`
      : "";

    return `
              <div class="custom-gallery-item">
                  ${ownerActionsHtml}
                  <a href="${itemUrl}" target="_blank" class="custom-gallery-item-thumbnail-link" title="View ${title} details (thumbnail)">
                      <img src="${thumbnailUrl}" alt="${title}" loading="lazy">
                  </a>
                  <div class="custom-gallery-item-info">
                      <a href="${itemUrl}" target="_blank" class="custom-gallery-item-title" title="${title}">${title}</a>
                      <div class="custom-gallery-item-meta"><strong>Creator:</strong> ${creator}</div>
                      <div class="custom-gallery-item-meta"><strong>Added:</strong> ${addedDate}</div>
                      <div class="custom-gallery-item-meta stats-line">
                          <div>${icons.size} ${itemSizeFormatted}</div>
                          <div>${
                            icons.downloads
                          } ${downloads.toLocaleString()}</div>
                          <div>${icons.favorites} ${numFavorites}</div>
                          <div>${icons.reviews} ${numReviews}</div>
                      </div>
                      <div class="custom-gallery-item-subjects">${subjects}</div>
                  </div>
              </div>
          `;
  }

  function buildGalleryItemsHtml(itemsToDisplay) {
    return itemsToDisplay.length === 0
      ? '<p style="text-align:center; padding: 20px;">No items match your search criteria.</p>'
      : itemsToDisplay.map((item) => createGalleryItemHtml(item)).join("");
  }
  function buildSidebarHtml(totalItemsCount, displayedItemsCount) {
    return `<div id="custom-gallery-sidebar"><div id="results-count-area">Displaying ${displayedItemsCount} of ${totalItemsCount} items</div><div id="search-input-area"><input type="text" id="gallery-search-input" placeholder='Search (e.g. word1 word2 or "exact phrase")'></div></div>`;
  }

  function updateLoadingMessage(targetEl, message) {
    if (!targetEl) return;
    let loadingDiv = targetEl.querySelector("#gallery-loading-message");
    if (loadingDiv) {
      loadingDiv.textContent = message;
    } else {
      targetEl.innerHTML = `<style>${galleryCSS}</style><div id="gallery-loading-message">${message}</div>`;
    }
  }

  function displayMessage(targetElement, message, id) {
    if (targetElement) {
      const wrapper = targetElement.querySelector("#custom-gallery-wrapper");
      const mainContent = targetElement.querySelector(
        "#custom-gallery-main-content"
      );
      const injectionPoint = mainContent || targetElement;
      injectionPoint.innerHTML = `<style>${galleryCSS}</style><div id="${id}">${message}</div>`;
    } else {
      console.warn(
        "[UserScript WARN] Target element for displayMessage is null."
      );
    }
  }

  function handleSearch(event) {
    if (!currentTargetElement || allFetchedItems.length === 0) return;

    const rawSearchInput = event.target.value.toLowerCase().trim();
    let filteredItems = allFetchedItems;

    if (rawSearchInput) {
      const isPhraseSearch =
        rawSearchInput.startsWith('"') &&
        rawSearchInput.endsWith('"') &&
        rawSearchInput.length > 2;

      if (isPhraseSearch) {
        const phrase = rawSearchInput.substring(1, rawSearchInput.length - 1);
        if (phrase) {
          filteredItems = allFetchedItems.filter((item) => {
            const fields = item.fields;
            const title = (fields.title || "").toLowerCase();
            const identifier = (fields.identifier || "").toLowerCase();
            const creatorString = fields.creator
              ? fields.creator.join(" ").toLowerCase()
              : "";
            const subjectString = fields.subject
              ? fields.subject.join(" ").toLowerCase()
              : "";

            return (
              title.includes(phrase) ||
              identifier.includes(phrase) ||
              creatorString.includes(phrase) ||
              subjectString.includes(phrase)
            );
          });
        }
      } else {
        const searchWords = rawSearchInput
          .split(/\s+/)
          .filter((word) => word.length > 0);
        if (searchWords.length > 0) {
          filteredItems = allFetchedItems.filter((item) => {
            const fields = item.fields;
            const title = (fields.title || "").toLowerCase();
            const identifier = (fields.identifier || "").toLowerCase();
            const creatorArray = fields.creator
              ? fields.creator.map((c) => (c || "").toLowerCase())
              : [];
            const subjectArray = fields.subject
              ? fields.subject.map((s) => (s || "").toLowerCase())
              : [];
            return searchWords.every(
              (word) =>
                title.includes(word) ||
                identifier.includes(word) ||
                creatorArray.some((c) => c.includes(word)) ||
                subjectArray.some((s) => s.includes(word))
            );
          });
        }
      }
    }

    const galleryDiv = currentTargetElement.querySelector(
      "#custom-user-uploads-gallery"
    );
    if (galleryDiv) galleryDiv.innerHTML = buildGalleryItemsHtml(filteredItems);
    const resultsCountEl = currentTargetElement.querySelector(
      "#results-count-area"
    );
    if (resultsCountEl)
      resultsCountEl.textContent = `Displaying ${filteredItems.length} of ${allFetchedItems.length} items`;
  }

  function injectLayoutAndGallery(
    initialGalleryItemsHtml,
    initialSidebarHtml,
    targetElement
  ) {
    currentTargetElement = targetElement;
    const galleryContainerHtml = `<div id="custom-user-uploads-gallery">${initialGalleryItemsHtml}</div>`;
    const fullHtmlToInject = `<div id="custom-gallery-wrapper">${initialSidebarHtml}<div id="custom-gallery-main-content"><style>${galleryCSS}</style>${galleryContainerHtml}</div></div>`;
    if (targetElement) {
      targetElement.innerHTML = fullHtmlToInject;
      const searchInput = targetElement.querySelector("#gallery-search-input");
      if (searchInput) searchInput.addEventListener("input", handleSearch);
      else
        console.warn(
          "[UserScript WARN] Search input not found after injection."
        );
    } else {
      console.error(
        "[UserScript ERR] Target element for layout injection not found."
      );
      const fallbackContainer = document.createElement("div");
      fallbackContainer.innerHTML =
        `<h2>User Uploads (Fallback)</h2>` + fullHtmlToInject;
      document.body.appendChild(fallbackContainer);
    }
  }

  function fetchPageData(username, pageNumber, isContextFetch = false) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        user_query: "",
        page_type: "account_details",
        page_target: `@${username}`,
        page_elements: '["uploads"]',
        hits_per_page: isContextFetch ? "1" : HITS_PER_PAGE.toString(),
        page: pageNumber.toString(),
        sort: "publicdate:desc",
        aggregations: "false",
      });
      const apiUrl = `https://archive.org/services/search/beta/page_production/?${params.toString()}`;
      console.log(
        `[UserScript DBG] Fetching ${
          isContextFetch ? "context" : `page ${pageNumber}`
        } from: ${apiUrl}`
      );

      GM_xmlhttpRequest({
        method: "GET",
        url: apiUrl,
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              const jsonData = JSON.parse(response.responseText);
              if (isContextFetch) {
                const isOwner =
                  jsonData?.session_context?.pps?.is_page_target_owner === true;
                resolve({ isOwner });
                return;
              }
              const hitsNode =
                jsonData?.response?.body?.page_elements?.uploads?.hits;
              if (hitsNode) {
                const items = hitsNode.hits || [];
                const totalHits = pageNumber === 1 ? hitsNode.total : null;
                resolve({ items, totalHits });
              } else {
                reject(new Error(`Unexpected JSON for page ${pageNumber}`));
              }
            } catch (e) {
              reject(
                new Error(
                  `Error parsing JSON for ${
                    isContextFetch ? "context" : `page ${pageNumber}`
                  }: ${e.message}`
                )
              );
            }
          } else {
            reject(
              new Error(
                `API request failed for ${
                  isContextFetch ? "context" : `page ${pageNumber}`
                }. Status: ${response.status}`
              )
            );
          }
        },
        onerror: function (error) {
          reject(
            new Error(
              `Network error for ${
                isContextFetch ? "context" : `page ${pageNumber}`
              }: ${error.message || "Unknown GM_xmlhttpRequest error"}`
            )
          );
        },
      });
    });
  }

  function finalizeDisplay(targetElement) {
    if (allFetchedItems.length === 0) {
      let loadingMessageElement = targetElement.querySelector(
        "#gallery-loading-message"
      );
      if (loadingMessageElement || targetElement.innerHTML.trim() === "") {
        displayMessage(
          targetElement,
          "No uploads found for this user after checking all pages.",
          "gallery-error-message"
        );
        return;
      }
    }
    const initialSidebarHtml = buildSidebarHtml(
      allFetchedItems.length,
      allFetchedItems.length
    );
    const initialGalleryItemsHtml = buildGalleryItemsHtml(allFetchedItems);
    injectLayoutAndGallery(
      initialGalleryItemsHtml,
      initialSidebarHtml,
      targetElement
    );
  }

  function fetchAndDisplayUploads(username, targetElement) {
    allFetchedItems = [];
    updateLoadingMessage(targetElement, "Loading user context...");

    fetchPageData(username, 1, true)
      .then((contextData) => {
        globalIsPageTargetOwner = contextData.isOwner;
        console.log(
          `[UserScript DBG] Page target owner status: ${globalIsPageTargetOwner}`
        );
        updateLoadingMessage(targetElement, "Loading user uploads (Page 1)...");
        return fetchPageData(username, 1);
      })
      .then((initialPageData) => {
        if (
          !initialPageData ||
          typeof initialPageData.totalHits === "undefined"
        ) {
          displayMessage(
            targetElement,
            "Error: Could not retrieve initial page data or total count.",
            "gallery-error-message"
          );
          return;
        }

        allFetchedItems = initialPageData.items || [];
        const totalHits = initialPageData.totalHits;
        const totalPages = Math.ceil(totalHits / HITS_PER_PAGE);
        if (totalHits === 0) {
          finalizeDisplay(targetElement);
          return;
        }
        if (totalPages > 1) {
          updateLoadingMessage(
            targetElement,
            `Loading user uploads (1 of ${totalPages} pages complete)...`
          );
          const pagePromises = [];
          for (let i = 2; i <= totalPages; i++) {
            pagePromises.push(
              fetchPageData(username, i).then((pageData) => {
                updateLoadingMessage(
                  targetElement,
                  `Loading user uploads (${
                    i - 1
                  } of ${totalPages} pages complete)...`
                );
                return pageData;
              })
            );
          }
          return Promise.all(pagePromises).then((pagesDataArray) => {
            pagesDataArray.forEach((pageResult) => {
              if (pageResult && pageResult.items)
                allFetchedItems = allFetchedItems.concat(pageResult.items);
            });
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        console.log(
          `[UserScript DBG] All data fetched. Total items: ${allFetchedItems.length}.`
        );
        finalizeDisplay(targetElement);
      })
      .catch((error) => {
        console.error(
          "[UserScript ERR] Error during data fetching process:",
          error
        );
        displayMessage(
          targetElement,
          `Error during data fetching: ${
            error.message || error
          }. Displaying partial results if any.`,
          "gallery-error-message"
        );
        if (allFetchedItems.length > 0) {
          setTimeout(() => finalizeDisplay(targetElement), 2000);
        }
      });
  }

  function findTargetElement(retriesLeft = MAX_RETRIES) {
    const activeTabContent = document
      .querySelector("app-root")
      ?.shadowRoot?.querySelector("user-profile")
      ?.shadowRoot?.querySelector("tab-manager")
      ?.shadowRoot?.querySelector(".active-tab-content");
    if (activeTabContent) {
      return activeTabContent;
    }
    if (retriesLeft > 0) {
      setTimeout(() => {
        const foundElement = findTargetElement(retriesLeft - 1);
        if (foundElement) {
          const currentUsername = getUsername();
          if (currentUsername)
            fetchAndDisplayUploads(currentUsername, foundElement);
          else
            displayMessage(
              foundElement,
              "Error: Username became null during retry.",
              "gallery-error-message"
            );
        }
      }, RETRY_DELAY);
      return null;
    } else {
      const fallbackDiv = document.createElement("div");
      document.body.insertAdjacentElement("afterbegin", fallbackDiv);
      displayMessage(
        fallbackDiv,
        "Critical Error: Script could not find its injection point.",
        "gallery-error-message"
      );
      return null;
    }
  }

  const username = getUsername();
  if (username) {
    const initialTargetElement = findTargetElement();
    if (initialTargetElement) {
      fetchAndDisplayUploads(username, initialTargetElement);
    } else {
      console.log(
        "[UserScript DBG] Target not found on first try. Retries or fallback initiated."
      );
    }
  } else {
    console.error("[UserScript ERR] No username found.");
    let errorDisplayTarget = document.body;
    try {
      const target = document
        .querySelector("app-root")
        ?.shadowRoot?.querySelector("user-profile")
        ?.shadowRoot?.querySelector("tab-manager")
        ?.shadowRoot?.querySelector(".active-tab-content");
      if (target) errorDisplayTarget = target;
    } catch (e) {}
    const tempDiv = document.createElement("div");
    errorDisplayTarget === document.body
      ? document.body.insertAdjacentElement("afterbegin", tempDiv)
      : errorDisplayTarget.prepend(tempDiv);
    displayMessage(
      tempDiv,
      "Error: Could not get username from URL.",
      "gallery-error-message"
    );
  }
  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script finished initial setup."
  );
})();
