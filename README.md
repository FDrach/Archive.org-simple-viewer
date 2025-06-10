# Archive.org Simple Viewer
[Install Script](https://github.com/FDrach/Archive.org-simple-viewer/raw/refs/heads/master/userPage.user.js)

A Tampermonkey/Greasemonkey userscript that replaces the default item listing with a more compact, filterable grid view, providing more information at a glance and allowing for easier navigation and discovery of items.

## Features

*   **Layout:** Displays items in a responsive grid for a more visual overview.
*   **Sidebar:**
    *   **Dynamic Search:** Instantly filter items by:
        *   Identifier
        *   Title
        *   Creator(s)
        *   Subject(s)
    *   **Search Syntax:**
        *   **AND Logic:** Multiple words are treated with AND logic (e.g., `word1 word2` finds items containing both "word1" AND "word2").
        *   **Exact Phrase:** Enclose terms in double quotes for exact phrase matching (e.g., `"exact phrase to match"`).
*   **Item Cards:** Each item in the grid displays:
    *   Thumbnail.
    *   Title.
    *   Creator(s).
    *   Date Added.
    *   Item Size
    *   Downloads count.
    *   Favorites count.
    *   Reviews count.
    *   Subjects.
*   **Quick Upload Link:** If you are viewing your own user page a small upload icon appears on each item.

## Installation
If you already have an Userscript Manager, just click [Install Script](https://github.com/FDrach/Archive.org-simple-viewer/raw/refs/heads/master/userPage.user.js), if you don't, fist install one:
1.  **Install a Userscript Manager:**
    *   [Tampermonkey](https://www.tampermonkey.net/)
    *   [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (untested)
    *   [Violentmonkey](https://violentmonkey.github.io/get-it/) (untested)
2.  **Install the Script:**
    *   Click on [Install Script](https://github.com/FDrach/Archive.org-simple-viewer/raw/refs/heads/master/userPage.user.js).
    *   Your userscript manager should automatically prompt you to install it.

## TODO

*   **Sort Options:** Currently defaults to sorting by "publicdate:desc".
*   **Facet Filtering:** Extend sidebar to include better filtering.

## License

This project is licensed under the [GPL-3.0 license](LICENSE)