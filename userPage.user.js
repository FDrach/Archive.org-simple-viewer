// ==UserScript==
// @name         Archive.org Simple Viewer
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  Simple viewer that works with Ctrl+F
// @author       Franco Drachenberg
// @match        https://archive.org/details/@*
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// ==/UserScript==

(function () {
  "use strict";

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script starting (v0.8)."
  );

  const HITS_PER_PAGE = 1000;
  const MAX_RETRIES = 7;
  const RETRY_DELAY = 1000;

  let allFetchedItems = [];
  let currentTargetElement = null;

  const iconDownloads =
    '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M98 51a235 235 0 0 0-10-14 83 83 0 0 0-16-13l-10-5a37 37 0 0 0-24 0l-10 5A83 83 0 0 0 3 49l-1 2a235 235 0 0 0 10 13 83 83 0 0 0 16 13l10 5a38 38 0 0 0 24 0l10-5 9-6 7-7c3-2 4-5 5-7l4-5zm-25 0c0 6-2 12-6 16s-11 7-17 7c-7 0-12-2-17-7s-7-10-7-16 3-12 7-17 10-7 17-7c6 0 12 2 17 7s6 10 6 17zM50 40c3 0 5 1 7 3a10 10 0 0 1 0 15c-2 2-4 3-7 3s-5-1-7-3-3-5-3-7c0-3 1-6 3-8s4-3 7-3z"/></svg>';
  const iconFavorites =
    '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M81 100 50 77l-31 23 11-37L0 37h38L50 0l12 37h38L70 63z"/></svg>';
  const iconReviews =
    '<svg class="meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="m100 8-2-6-6-2H8L2 2 0 8v51l2 6 6 2h10l1 33 32-33h41l6-2c2-1 2-4 2-6z"/></svg>';

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
            display: flex;
            flex-direction: column;
            text-decoration: none;
            color: #333;
            border: 1px solid #ccc;
            border-radius: 4px;
            overflow: hidden;
            background-color: #fff;
            transition: box-shadow 0.2s ease-in-out;
        }
        .custom-gallery-item:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-color: #aaa;
        }
        .custom-gallery-item-thumbnail-link { display: block; }
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
            justify-content: space-around;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #eee;
            color: #555;
        }
        .custom-gallery-item-meta.stats-line > div { display: flex; align-items: center; }
        .meta-icon {
            width: 1em; height: 1em;
            margin-right: 4px;
            vertical-align: middle;
            fill: currentColor;
        }
        .custom-gallery-item-meta strong { color: #555; margin-right: 4px; }
        .custom-gallery-item-subjects {
            margin-top: 4px;
            font-style: italic;
            color: #666;
            max-height: 3.6em;
            overflow-y: auto;
            word-break: break-word;
            line-height: 1.2em;
        }
        #gallery-loading-message, #gallery-error-message {
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
  function buildApiUrl(username) {
    const p = new URLSearchParams({
      user_query: "",
      page_type: "account_details",
      page_target: `@${username}`,
      page_elements: '["uploads"]',
      hits_per_page: HITS_PER_PAGE.toString(),
      page: "1",
      sort: "publicdate:desc",
      aggregations: "false",
    });
    return `https://archive.org/services/search/beta/page_production/?${p.toString()}`;
  }
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024,
      dm = decimals < 0 ? 0 : decimals,
      s = ["Bytes", "KB", "MB", "GB", "TB"],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${s[i]}`;
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

    const numFavorites = fields.num_favorites || 0;
    const numReviews = fields.num_reviews || 0;
    const itemSize = fields.item_size ? formatBytes(fields.item_size) : "N/A";
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

    return `
            <div class="custom-gallery-item">
                <a href="${itemUrl}" target="_blank" class="custom-gallery-item-thumbnail-link" title="View ${title} details (thumbnail)">
                    <img src="${thumbnailUrl}" alt="${title}" loading="lazy">
                </a>
                <div class="custom-gallery-item-info">
                    <a href="${itemUrl}" target="_blank" class="custom-gallery-item-title" title="${title}">${title}</a>
                    <div class="custom-gallery-item-meta"><strong>Creator:</strong> ${creator}</div>
                    <div class="custom-gallery-item-meta"><strong>Added:</strong> ${addedDate}</div>
                    <div class="custom-gallery-item-meta"><strong>Size:</strong> ${itemSize}</div>
                    <div class="custom-gallery-item-meta stats-line">
                        <div>${iconDownloads} ${downloads.toLocaleString()}</div>
                        <div>${iconFavorites} ${numFavorites}</div>
                        <div>${iconReviews} ${numReviews}</div>
                    </div>
                    <div class="custom-gallery-item-subjects">${subjects}</div>
                </div>
            </div>
        `;
  }

  function buildGalleryItemsHtml(itemsToDisplay) {
    if (!itemsToDisplay || itemsToDisplay.length === 0) {
      return "<p>No items match your search or no items found.</p>";
    }
    return itemsToDisplay.map((item) => createGalleryItemHtml(item)).join("");
  }

  function buildSidebarHtml(totalItemsCount, displayedItemsCount) {
    return `
            <div id="custom-gallery-sidebar">
                <div id="results-count-area">
                    Displaying ${displayedItemsCount} of ${totalItemsCount} items
                </div>
                <div id="search-input-area">
                    <input type="text" id="gallery-search-input" placeholder="Search items...">
                </div>
            </div>
        `;
  }

  function displayMessage(targetElement, message, id) {
    console.log(
      `[UserScript DBG] Displaying message: "${message}" with id: "${id}"`
    );
    if (targetElement) {
      const wrapper = targetElement.querySelector("#custom-gallery-wrapper");
      const mainContent = targetElement.querySelector(
        "#custom-gallery-main-content"
      );
      const injectionPoint = mainContent || wrapper || targetElement;
      injectionPoint.innerHTML = `<style>${galleryCSS}</style><div id="${id}">${message}</div>`;
    } else {
      console.warn(
        "[UserScript WARN] Target element for displayMessage is null."
      );
    }
  }

  function handleSearch(event) {
    if (!currentTargetElement || allFetchedItems.length === 0) return;

    const searchTerm = event.target.value.toLowerCase().trim();
    let filteredItems = allFetchedItems;

    if (searchTerm) {
      filteredItems = allFetchedItems.filter((item) => {
        const fields = item.fields;
        const title = (fields.title || "").toLowerCase();
        const identifier = (fields.identifier || "").toLowerCase();
        const creatorMatch =
          fields.creator &&
          fields.creator.some((c) =>
            (c || "").toLowerCase().includes(searchTerm)
          );
        const subjectMatch =
          fields.subject &&
          fields.subject.some((s) =>
            (s || "").toLowerCase().includes(searchTerm)
          );
        return (
          title.includes(searchTerm) ||
          identifier.includes(searchTerm) ||
          creatorMatch ||
          subjectMatch
        );
      });
    }

    const galleryDiv = currentTargetElement.querySelector(
      "#custom-user-uploads-gallery"
    );
    if (galleryDiv) {
      galleryDiv.innerHTML = buildGalleryItemsHtml(filteredItems);
    }

    const resultsCountEl = currentTargetElement.querySelector(
      "#results-count-area"
    );
    if (resultsCountEl) {
      resultsCountEl.textContent = `Displaying ${filteredItems.length} of ${allFetchedItems.length} items`;
    }
    console.log(
      `[UserScript DBG] Searched for "${searchTerm}", found ${filteredItems.length} items.`
    );
  }

  function injectLayoutAndGallery(
    initialGalleryItemsHtml,
    initialSidebarHtml,
    targetElement
  ) {
    console.log(
      "[UserScript DBG] Attempting to inject full layout (sidebar + gallery) with embedded styles."
    );
    currentTargetElement = targetElement;

    const galleryContainerHtml = `<div id="custom-user-uploads-gallery">${initialGalleryItemsHtml}</div>`;
    const fullHtmlToInject = `
            <div id="custom-gallery-wrapper">
                ${initialSidebarHtml}
                <div id="custom-gallery-main-content">
                    <style>${galleryCSS}</style>
                    ${galleryContainerHtml}
                </div>
            </div>
        `;

    if (
      initialGalleryItemsHtml &&
      initialGalleryItemsHtml.includes("custom-gallery-item")
    ) {
      try {
        prompt(
          "Copy the generated layout HTML (styles embedded) below (Ctrl+C, Cmd+C):",
          fullHtmlToInject
        );
        console.log("[UserScript DBG] HTML prompt shown.");
      } catch (e) {
        console.warn("[UserScript WARN] Could not display prompt.", e);
      }
    }

    if (targetElement) {
      targetElement.innerHTML = fullHtmlToInject;
      console.log(
        "[UserScript DBG] Full layout with embedded styles injected successfully into:",
        targetElement
      );

      const searchInput = targetElement.querySelector("#gallery-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", handleSearch);
        console.log("[UserScript DBG] Search input event listener attached.");
      } else {
        console.warn(
          "[UserScript WARN] Search input not found after injection to attach listener."
        );
      }
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

  function fetchAndDisplayUploads(username, targetElement) {
    const apiUrl = buildApiUrl(username);
    console.log("[UserScript DBG] Fetching uploads for username:", username);

    targetElement.innerHTML = `<style>${galleryCSS}</style><div id="gallery-loading-message">Loading user uploads...</div>`;

    GM_xmlhttpRequest({
      method: "GET",
      url: apiUrl,
      onload: function (response) {
        console.log(
          "[UserScript DBG] API request onload triggered. Status:",
          response.status
        );
        if (response.status >= 200 && response.status < 300) {
          try {
            const jsonData = JSON.parse(response.responseText);
            if (
              jsonData &&
              jsonData.response &&
              jsonData.response.body &&
              jsonData.response.body.page_elements &&
              jsonData.response.body.page_elements.uploads &&
              jsonData.response.body.page_elements.uploads.hits &&
              Array.isArray(
                jsonData.response.body.page_elements.uploads.hits.hits
              )
            ) {
              allFetchedItems =
                jsonData.response.body.page_elements.uploads.hits.hits;
              console.log(
                `[UserScript DBG] Found ${allFetchedItems.length} total items.`
              );

              const initialSidebarHtml = buildSidebarHtml(
                allFetchedItems.length,
                allFetchedItems.length
              );
              const initialGalleryItemsHtml =
                buildGalleryItemsHtml(allFetchedItems);

              injectLayoutAndGallery(
                initialGalleryItemsHtml,
                initialSidebarHtml,
                targetElement
              );
            } else {
              console.error(
                "[UserScript ERR] Unexpected JSON structure from API (uploads path):",
                jsonData
              );
              displayMessage(
                targetElement,
                "Error: Could not parse uploads from API. Unexpected structure.",
                "gallery-error-message"
              );
            }
          } catch (e) {
            console.error("[UserScript ERR] Error parsing JSON:", e);
            displayMessage(
              targetElement,
              "Error: Could not parse API response.",
              "gallery-error-message"
            );
          }
        } else {
          console.error(
            "[UserScript ERR] API request failed. Status:",
            response.status
          );
          displayMessage(
            targetElement,
            `Error: API request failed (${response.status})`,
            "gallery-error-message"
          );
        }
      },
      onerror: function (error) {
        console.error(
          "[UserScript ERR] API request GM_xmlhttpRequest error:",
          error
        );
        displayMessage(
          targetElement,
          "Error: Network error while fetching uploads.",
          "gallery-error-message"
        );
      },
    });
  }

  function findTargetElement(retriesLeft = MAX_RETRIES) {
    console.log(
      `[UserScript DBG] Attempting to find target element. Retries left: ${retriesLeft}`
    );
    const appRoot = document.querySelector("app-root");
    if (appRoot && appRoot.shadowRoot) {
      const userProfile = appRoot.shadowRoot.querySelector("user-profile");
      if (userProfile && userProfile.shadowRoot) {
        const tabManager = userProfile.shadowRoot.querySelector("tab-manager");
        if (tabManager && tabManager.shadowRoot) {
          const activeTabContent = tabManager.shadowRoot.querySelector(
            ".active-tab-content"
          );
          if (activeTabContent) {
            console.log(
              "[UserScript DBG] Target element (.active-tab-content) found successfully!"
            );
            return activeTabContent;
          }
        }
      }
    }
    if (retriesLeft > 0) {
      console.log(
        `[UserScript DBG] Target element not found, ${
          retriesLeft - 1
        } retries left. Trying again...`
      );
      setTimeout(() => {
        const foundElement = findTargetElement(retriesLeft - 1);
        if (foundElement) {
          const currentUsername = getUsername();
          if (currentUsername) {
            fetchAndDisplayUploads(currentUsername, foundElement);
          } else {
            displayMessage(
              foundElement,
              "Error: Username not found during retry.",
              "gallery-error-message"
            );
          }
        }
      }, RETRY_DELAY);
      return null;
    } else {
      console.error(
        "[UserScript ERR] Failed to find .active-tab-content after retries."
      );

      const fallbackDiv = document.createElement("div");
      document.body.insertAdjacentElement("afterbegin", fallbackDiv);
      displayMessage(
        fallbackDiv,
        "Critical Error: Script could not find its designated injection point on the page after multiple attempts. Gallery cannot be displayed.",
        "gallery-error-message"
      );
      return null;
    }
  }

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Main execution started."
  );
  const username = getUsername();
  if (username) {
    const initialTargetElement = findTargetElement();
    if (initialTargetElement) {
      fetchAndDisplayUploads(username, initialTargetElement);
    } else {
      console.log(
        "[UserScript DBG] Target element not found on first try. Retries or fallback initiated by findTargetElement."
      );
    }
  } else {
    console.error("[UserScript ERR] Could not determine username from URL.");

    let errorDisplayTarget = document.body;
    try {
      const appRoot = document
        .querySelector("app-root")
        ?.shadowRoot?.querySelector("user-profile")
        ?.shadowRoot?.querySelector("tab-manager")
        ?.shadowRoot?.querySelector(".active-tab-content");
      if (appRoot) errorDisplayTarget = appRoot;
    } catch (e) {}
    const tempDiv = document.createElement("div");
    errorDisplayTarget.prepend(tempDiv);
    displayMessage(
      tempDiv,
      "Error: Could not determine username from URL to fetch uploads.",
      "gallery-error-message"
    );
  }
  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script finished initial setup."
  );
})();
