// ==UserScript==
// @name         Archive.org Simple Viewer
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Simple viewer that works with Ctrl+F
// @author       Franco Drachenberg
// @match        https://archive.org/details/@*
// @grant        GM_xmlhttpRequest
// @connect      archive.org
// ==/UserScript==

(function () {
  "use strict";

  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script starting (v0.5)."
  );

  const HITS_PER_PAGE = 1000;
  const MAX_RETRIES = 7;
  const RETRY_DELAY = 1000;

  const galleryCSS = `
        #custom-user-uploads-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            padding: 20px;
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-top: 10px;
        }
        .custom-gallery-item {
            display: flex;
            flex-direction: column;
            align-items: center;
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
        .custom-gallery-item img {
            width: 100%;
            height: 120px;
            object-fit: cover;
            border-bottom: 1px solid #eee;
        }
        .custom-gallery-item-title {
            font-size: 0.85em;
            padding: 8px;
            text-align: center;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
        }
        #gallery-loading-message, #gallery-error-message {
            font-size: 1.2em;
            padding: 20px;
            text-align: center;
            color: #555;
        }
    `;

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
      targetElement.innerHTML = `<style>${galleryCSS}</style><div id="${id}">${message}</div>`;
    } else {
      console.warn(
        "[UserScript WARN] Target element for displayMessage is null."
      );
    }
  }

  function injectGallery(galleryContentHtml, targetElement) {
    console.log(
      "[UserScript DBG] Attempting to inject gallery HTML with embedded styles."
    );

    const fullHtmlToInject = `<style>${galleryCSS}</style>${galleryContentHtml}`;

    if (
      galleryContentHtml &&
      galleryContentHtml.trim() !==
        '<div id="custom-user-uploads-gallery"></div>' &&
      galleryContentHtml.includes("custom-gallery-item")
    ) {
      try {
        prompt(
          "Copy the generated gallery HTML (styles are embedded, then gallery div) below (Ctrl+C, Cmd+C):",
          fullHtmlToInject
        );
        console.log(
          "[UserScript DBG] HTML prompt shown (includes embedded style)."
        );
      } catch (e) {
        console.warn("[UserScript WARN] Could not display prompt.", e);
      }
    } else {
      console.log(
        "[UserScript DBG] No substantial gallery HTML to show in prompt (gallery might be empty)."
      );
    }

    if (targetElement) {
      targetElement.innerHTML = fullHtmlToInject;
      console.log(
        "[UserScript DBG] Gallery HTML with embedded styles injected successfully into:",
        targetElement
      );
    } else {
      console.error(
        "[UserScript ERR] Target element for gallery injection not found."
      );
      const fallbackContainer = document.createElement("div");
      fallbackContainer.innerHTML = `<h2>User Uploads (Fallback - Injection Target Missing)</h2><style>${galleryCSS}</style>${galleryContentHtml}`;
      document.body.appendChild(fallbackContainer);
      console.warn(
        "[UserScript WARN] Gallery with embedded styles injected into a fallback container in document.body."
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
            console.log(
              "[UserScript DBG] Parsed API Response Data (structure check):",
              jsonData &&
                jsonData.response &&
                jsonData.response.body &&
                jsonData.response.body.page_elements
                ? "Basic structure OK"
                : "Basic structure NOT OK"
            );

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
              console.log(
                "[UserScript DBG] Expected JSON structure for uploads found."
              );
              const items =
                jsonData.response.body.page_elements.uploads.hits.hits;
              console.log(
                `[UserScript DBG] Found ${items.length} items in uploads.`
              );
              let galleryContentHtml = '<div id="custom-user-uploads-gallery">';
              if (items.length > 0) {
                items.forEach((item) => {
                  if (item.fields && item.fields.identifier) {
                    galleryContentHtml += createGalleryItemHtml(item);
                  } else {
                    console.warn(
                      "[UserScript WARN] Item missing fields.identifier:",
                      item
                    );
                  }
                });
              }
              galleryContentHtml += "</div>";
              injectGallery(galleryContentHtml, targetElement);
            } else {
              console.error(
                "[UserScript ERR] Unexpected JSON structure from API (uploads path):",
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
      `[UserScript DBG] Attempting to find target element (new path). Retries left: ${retriesLeft}`
    );
    const appRoot = document.querySelector("app-root");
    console.log("[UserScript DBG] appRoot:", appRoot ? "Found" : "Not found");
    if (appRoot && appRoot.shadowRoot) {
      console.log("[UserScript DBG] appRoot.shadowRoot: Exists");
      const userProfile = appRoot.shadowRoot.querySelector("user-profile");
      console.log(
        "[UserScript DBG] userProfile:",
        userProfile ? "Found" : "Not found"
      );
      if (userProfile && userProfile.shadowRoot) {
        console.log("[UserScript DBG] userProfile.shadowRoot: Exists");
        const tabManager = userProfile.shadowRoot.querySelector("tab-manager");
        console.log(
          "[UserScript DBG] tabManager:",
          tabManager ? "Found" : "Not found"
        );
        if (tabManager && tabManager.shadowRoot) {
          console.log("[UserScript DBG] tabManager.shadowRoot: Exists");
          const activeTabContent = tabManager.shadowRoot.querySelector(
            ".active-tab-content"
          );
          console.log(
            "[UserScript DBG] .active-tab-content:",
            activeTabContent ? "Found" : "Not found"
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
        `[UserScript DBG] Target element not found with new path, ${
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
        "[UserScript ERR] Failed to find the target Shadow DOM element (.active-tab-content) after multiple retries."
      );
      const fallbackDiv = document.createElement("div");
      fallbackDiv.id = "fallback-gallery-container";

      const currentUsername = getUsername();
      if (currentUsername) {
        const fallbackHtml = `<div id="gallery-error-message">Could not find the designated spot to place the gallery (.active-tab-content). Displaying here instead.</div>`;
        fallbackDiv.innerHTML = `<style>${galleryCSS}</style>${fallbackHtml}`;

        const mainContentArea = document.querySelector("main") || document.body;
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
          mainContentArea.appendChild(fallbackDiv);
          console.log(
            "[UserScript DBG] Appended fallback container to main content or body."
          );
        }
        fetchAndDisplayUploads(currentUsername, fallbackDiv);
      } else {
        fallbackDiv.innerHTML = `<style>${galleryCSS}</style><div id="gallery-error-message">Could not determine username from URL for fallback.</div>`;
        console.error(
          "[UserScript ERR] Username is null, cannot fetch uploads for fallback."
        );
        const mainContentArea = document.querySelector("main") || document.body;
        mainContentArea.appendChild(fallbackDiv);
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
    let errorDisplayTarget = null;
    try {
      const appRoot = document.querySelector("app-root");
      if (appRoot && appRoot.shadowRoot) {
        const userProfile = appRoot.shadowRoot.querySelector("user-profile");
        if (userProfile && userProfile.shadowRoot) {
          const tabManager =
            userProfile.shadowRoot.querySelector("tab-manager");
          if (tabManager && tabManager.shadowRoot) {
            errorDisplayTarget = tabManager.shadowRoot.querySelector(
              ".active-tab-content"
            );
          }
          if (!errorDisplayTarget) errorDisplayTarget = tabManager;
        }
      }
    } catch (e) {
      console.warn("Error finding target for username error display:", e);
    }

    if (errorDisplayTarget) {
      displayMessage(
        errorDisplayTarget,
        "Error: Could not determine username from URL to fetch uploads.",
        "gallery-error-message"
      );
    } else {
      const bodyFallbackError = document.createElement("div");
      bodyFallbackError.innerHTML = `<style>${galleryCSS}</style><div id="gallery-error-message" style="border:2px solid red; padding: 10px; margin: 10px;">Error: Could not determine username from URL to fetch uploads. Also, the script could not find its usual place to display messages.</div>`;
      document.body.insertAdjacentElement("afterbegin", bodyFallbackError);
      console.warn(
        "[UserScript WARN] No suitable element found to display initial username error. Used body fallback."
      );
    }
  }
  console.log(
    "[UserScript] Archive.org User Uploads Gallery - Script finished initial setup."
  );
})();
