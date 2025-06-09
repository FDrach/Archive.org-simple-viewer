// ==UserScript==
// @name         Archive.org Simple Viewer
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Simple viewer that works with Ctrl+F
// @author       Franco Drachenberg
// @match        https://archive.org/details/@*
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// ==/UserScript==

(function () {
  "use strict";

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script starting."
  );

  const HITS_PER_PAGE = 1000;
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000;

  function getUsername() {
    console.log(
      "[UserScript DBG] Attempting to get username from URL:",
      window.location.pathname
    );
    try {
      const username = window.location.pathname.split("/@").pop().split("/")[0];
      console.log("[UserScript DBG] Extracted username:", username);
      return username;
    } catch (e) {
      console.error("[UserScript ERR] Error extracting username:", e);
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
    const apiUrl = `https://archive.org/services/search/beta/page_production/?${params.toString()}`;
    console.log("[UserScript DBG] Constructed API URL:", apiUrl);
    return apiUrl;
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
    console.log(
      `[UserScript DBG] Displaying message: "${message}" with id: "${id}"`
    );
    if (targetElement) {
      targetElement.innerHTML = `<div id="${id}">${message}</div>`;
    } else {
      console.warn(
        "[UserScript WARN] Target element for displayMessage is null."
      );
    }
  }

  function injectGallery(galleryHtml, targetElement) {
    console.log("[UserScript DBG] Attempting to inject gallery HTML.");
    if (targetElement) {
      targetElement.innerHTML = galleryHtml;
      console.log("[UserScript DBG] Gallery HTML injected successfully.");
    } else {
      console.error(
        "[UserScript ERR] Target element for gallery injection not found."
      );
      const fallbackContainer = document.createElement("div");
      fallbackContainer.innerHTML =
        "<h2>User Uploads (Fallback - Injection Target Missing)</h2>" +
        galleryHtml;
      document.body.appendChild(fallbackContainer);
      console.warn(
        "[UserScript WARN] Gallery injected into a fallback container in document.body."
      );
    }
  }

  function fetchAndDisplayUploads(username, targetElement) {
    const apiUrl = buildApiUrl(username);
    console.log("[UserScript DBG] Fetching uploads for username:", username);
    displayMessage(
      targetElement,
      "Loading user uploads...",
      "gallery-loading-message"
    );

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
            console.log(
              "[UserScript DBG] API response text (first 500 chars):",
              response.responseText.substring(0, 500)
            );
            const jsonData = JSON.parse(response.responseText);
            console.log("[UserScript DBG] Parsed API Response Data:", jsonData);

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
              console.log("[UserScript DBG] Expected JSON structure found.");
              const items =
                jsonData.response.body.page_elements.uploads.hits.hits;
              console.log(
                `[UserScript DBG] Found ${items.length} items in uploads.`
              );
              if (items.length > 0) {
                let galleryHtml = '<div id="custom-user-uploads-gallery">';
                items.forEach((item) => {
                  if (item.fields && item.fields.identifier) {
                    galleryHtml += createGalleryItemHtml(item);
                  } else {
                    console.warn(
                      "[UserScript WARN] Item missing fields.identifier:",
                      item
                    );
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
              console.error(
                "[UserScript ERR] Unexpected JSON structure from API:",
                jsonData
              );
              displayMessage(
                targetElement,
                "Error: Could not parse uploads from API response. Unexpected structure.",
                "gallery-error-message"
              );
            }
          } catch (e) {
            console.error(
              "[UserScript ERR] Error parsing JSON:",
              e,
              "Response text:",
              response.responseText
            );
            displayMessage(
              targetElement,
              "Error: Could not parse API response.",
              "gallery-error-message"
            );
          }
        } else {
          console.error(
            "[UserScript ERR] API request failed. Status:",
            response.status,
            "StatusText:",
            response.statusText,
            "Response:",
            response.responseText
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
    console.log("[UserScript DBG] appRoot:", appRoot);
    if (appRoot && appRoot.shadowRoot) {
      console.log("[UserScript DBG] appRoot.shadowRoot found.");
      const userProfile = appRoot.shadowRoot.querySelector("user-profile");
      console.log("[UserScript DBG] userProfile:", userProfile);
      if (userProfile && userProfile.shadowRoot) {
        console.log("[UserScript DBG] userProfile.shadowRoot found.");
        const tabManager = userProfile.shadowRoot.querySelector("tab-manager");
        console.log("[UserScript DBG] tabManager:", tabManager);
        if (tabManager) {
          console.log(
            "[UserScript DBG] Target element (tab-manager) found successfully!"
          );
          return tabManager;
        }
      }
    }

    if (retriesLeft > 0) {
      console.log(
        `[UserScript DBG] Target element not found, ${
          retriesLeft - 1
        } retries left. Trying again in ${RETRY_DELAY}ms...`
      );
      setTimeout(() => {
        const foundElement = findTargetElement(retriesLeft - 1);
        if (foundElement) {
          const currentUsername = getUsername();
          if (currentUsername) {
            fetchAndDisplayUploads(currentUsername, foundElement);
          } else {
            console.error(
              "[UserScript ERR] Username became null during retry, cannot fetch uploads."
            );
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
        "[UserScript ERR] Failed to find the target Shadow DOM element (tab-manager) after multiple retries."
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
        console.log(
          "[UserScript DBG] Appended fallback container after user-profile element."
        );
      } else if (appRoot) {
        appRoot.insertAdjacentElement("afterend", fallbackDiv);
        console.log(
          "[UserScript DBG] Appended fallback container after app-root element."
        );
      } else {
        mainContent.appendChild(fallbackDiv);
        console.log(
          "[UserScript DBG] Appended fallback container to main content or body."
        );
      }

      const currentUsername = getUsername();
      if (currentUsername) {
        fetchAndDisplayUploads(currentUsername, fallbackDiv);
      } else {
        console.error(
          "[UserScript ERR] Username is null, cannot fetch uploads for fallback."
        );
        displayMessage(
          fallbackDiv,
          "Could not determine username from URL for fallback.",
          "gallery-error-message"
        );
      }
      return null;
    }
  }

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Main execution started."
  );
  const username = getUsername();

  if (username) {
    console.log("[UserScript DBG] Username obtained:", username);

    const initialTargetElement = findTargetElement();

    if (initialTargetElement) {
      console.log(
        "[UserScript DBG] Target element found on first try. Fetching uploads."
      );
      fetchAndDisplayUploads(username, initialTargetElement);
    } else {
      console.log(
        "[UserScript DBG] Target element not found on first try. Retries or fallback initiated by findTargetElement."
      );
    }
  } else {
    console.error(
      "[UserScript ERR] Could not determine username from URL. Script cannot proceed to fetch uploads."
    );

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
        } else {
          console.warn(
            "[UserScript WARN] tab-manager not found for displaying username error."
          );
        }
      }
    }
  }
  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script finished initial setup."
  );
})();
