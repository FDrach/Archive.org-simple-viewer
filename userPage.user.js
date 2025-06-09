// ==UserScript==
// @name         Archive.org Simple Viewer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Simple viewer that works with Ctrl+F
// @author       Franco Drachenberg
// @match        https://archive.org/details/@*
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// ==/UserScript==

(function () {
  "use strict";

  const HITS_PER_PAGE = 1000;
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000;

  function getUsername() {
    try {
      return window.location.pathname.split("/@").pop().split("/")[0];
    } catch (e) {
      console.error("Error extracting username:", e);
      return null;
    }
  }

  function buildApiUrl(username) {
    const params = new URLSearchParams({
      user_query: "",
      page_type: "account_details",
      page_target: `@${username}`,
      page_elements: '["uploads"]',
      hits_per_page: HITS_PER_PAGE.toString(),
      page: "1",
      sort: "publicdate:desc",
      aggregations: "false",
    });
    return `https://archive.org/services/search/beta/page_production/?${params.toString()}`;
  }

  function createGalleryItemHtml(item) {
    const identifier = item.fields.identifier;
    const title = item.fields.title || identifier;
    const thumbnailUrl = `https://archive.org/services/img/${identifier}`;
    const itemUrl = `https://archive.org/details/${identifier}`;

    return `
            <a href="${itemUrl}" target="_blank" class="custom-gallery-item" title="${title}">
                <img src="${thumbnailUrl}" alt="${title}" loading="lazy">
                <div class="custom-gallery-item-title">${title}</div>
            </a>
        `;
  }

  function displayMessage(targetElement, message, id) {
    if (targetElement) {
      targetElement.innerHTML = `<div id="${id}">${message}</div>`;
    }
  }

  function injectGallery(galleryHtml, targetElement) {
    if (targetElement) {
      targetElement.innerHTML = galleryHtml;
    } else {
      console.error("Target element for gallery injection not found.");

      const fallbackContainer = document.createElement("div");
      fallbackContainer.innerHTML =
        "<h2>User Uploads (Fallback)</h2>" + galleryHtml;
      document.body.appendChild(fallbackContainer);
    }
  }

  function fetchAndDisplayUploads(username, targetElement) {
    const apiUrl = buildApiUrl(username);
    console.log("Fetching from API:", apiUrl);
    displayMessage(
      targetElement,
      "Loading user uploads...",
      "gallery-loading-message"
    );

    GM_xmlhttpRequest({
      method: "GET",
      url: apiUrl,
      onload: function (response) {
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
              const items =
                jsonData.response.body.page_elements.uploads.hits.hits;
              if (items.length > 0) {
                let galleryHtml = '<div id="custom-user-uploads-gallery">';
                items.forEach((item) => {
                  if (item.fields && item.fields.identifier) {
                    galleryHtml += createGalleryItemHtml(item);
                  }
                });
                galleryHtml += "</div>";
                injectGallery(galleryHtml, targetElement);
              } else {
                displayMessage(
                  targetElement,
                  "No uploads found for this user.",
                  "gallery-error-message"
                );
              }
            } else {
              console.error("Unexpected JSON structure:", jsonData);
              displayMessage(
                targetElement,
                "Error: Could not parse uploads from API response. Unexpected structure.",
                "gallery-error-message"
              );
            }
          } catch (e) {
            console.error("Error parsing JSON:", e);
            displayMessage(
              targetElement,
              "Error: Could not parse API response.",
              "gallery-error-message"
            );
          }
        } else {
          console.error(
            "API request failed:",
            response.status,
            response.statusText
          );
          displayMessage(
            targetElement,
            `Error: API request failed (${response.status})`,
            "gallery-error-message"
          );
        }
      },
      onerror: function (error) {
        console.error("API request error:", error);
        displayMessage(
          targetElement,
          "Error: Network error while fetching uploads.",
          "gallery-error-message"
        );
      },
    });
  }

  function findTargetElement(retriesLeft = MAX_RETRIES) {
    const appRoot = document.querySelector("app-root");
    if (appRoot && appRoot.shadowRoot) {
      const userProfile = appRoot.shadowRoot.querySelector("user-profile");
      if (userProfile && userProfile.shadowRoot) {
        const tabManager = userProfile.shadowRoot.querySelector("tab-manager");
        if (tabManager) {
          return tabManager;
        }
      }
    }

    if (retriesLeft > 0) {
      console.log(
        `Target element not found, ${
          retriesLeft - 1
        } retries left. Trying again in ${RETRY_DELAY}ms...`
      );
      setTimeout(() => findTargetElement(retriesLeft - 1), RETRY_DELAY);
    } else {
      console.error(
        "Failed to find the target Shadow DOM element after multiple retries."
      );

      const fallbackDiv = document.createElement("div");
      fallbackDiv.id = "fallback-gallery-container";
      fallbackDiv.innerHTML = `<div id="gallery-error-message">Could not find the designated spot to place the gallery. Displaying here instead.</div>`;

      const mainContent = document.querySelector("main") || document.body;
      const userProfileElement = document
        .querySelector("app-root")
        ?.shadowRoot?.querySelector("user-profile");
      if (userProfileElement) {
        userProfileElement.insertAdjacentElement("afterend", fallbackDiv);
      } else if (appRoot) {
        appRoot.insertAdjacentElement("afterend", fallbackDiv);
      } else {
        mainContent.appendChild(fallbackDiv);
      }

      const username = getUsername();
      if (username) {
        fetchAndDisplayUploads(username, fallbackDiv);
      } else {
        displayMessage(
          fallbackDiv,
          "Could not determine username from URL.",
          "gallery-error-message"
        );
      }
      return null;
    }
  }

  console.log("Archive.org User Uploads Gallery script running.");
  const username = getUsername();

  if (username) {
    const targetElement = findTargetElement();

    if (targetElement) {
      fetchAndDisplayUploads(username, targetElement);
    } else if (MAX_RETRIES === 0 && !targetElement) {
      const fallbackDiv =
        document.getElementById("fallback-gallery-container") ||
        document.createElement("div");
      if (!document.getElementById("fallback-gallery-container")) {
        fallbackDiv.id = "fallback-gallery-container";
        fallbackDiv.innerHTML = `<div id="gallery-error-message">Could not find the designated spot to place the gallery. Displaying here instead.</div>`;
        (document.querySelector("main") || document.body).appendChild(
          fallbackDiv
        );
      }
      fetchAndDisplayUploads(username, fallbackDiv);
    }
  } else {
    console.error("Could not determine username from URL.");

    const appRoot = document.querySelector("app-root");
    if (appRoot && appRoot.shadowRoot) {
      const userProfile = appRoot.shadowRoot.querySelector("user-profile");
      if (userProfile && userProfile.shadowRoot) {
        const tabManager = userProfile.shadowRoot.querySelector("tab-manager");
        if (tabManager) {
          displayMessage(
            tabManager,
            "Error: Could not determine username from URL to fetch uploads.",
            "gallery-error-message"
          );
        }
      }
    }
  }
})();
