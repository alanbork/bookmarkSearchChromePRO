// version 4.0 rev 9 (always increment rev number for any change)
// most recent change: commented all functions/listeners
document.addEventListener('DOMContentLoaded', () => {
    function getElementOrFail(elementID) {
        const element = document.getElementById(elementID);
        if (!element) console.error("CRITICAL: " + elementID + " not found!");
        return element;
    }

    const searchBox = getElementOrFail('searchBox');
    searchBox.disabled = false;
    searchBox.placeholder = "Search Bookmarks...";
    searchBox.focus();
    const resultsList = getElementOrFail('results');
    
    const updateDialog = getElementOrFail('updateDialog');
    const updateTitleInput = getElementOrFail('updateTitleInput');
    const updateUrlInput = getElementOrFail('updateUrlInput'); 
    const updateBookmarkButton = getElementOrFail('updateBookmarkButton');
    const deleteBookmarkButton = getElementOrFail('deleteBookmarkButton');
    const cancelActionButton = getElementOrFail('cancelActionButton');

    let selectedIndex = -1;
    let allBookmarks = [];
    let filteredBookmarks = [];
    let currentBookmarkId = null;

    // Hides the edit dialog and resets its state.
    function hideUpdateDialog() {
        updateDialog.style.display = 'none';
        updateTitleInput.value = ''; // Added missing clear for title input
        updateUrlInput.value = ''; 
        deleteBookmarkButton.textContent = 'Delete';
        deleteBookmarkButton.dataset.deleteState = 'initial'; 
        deleteBookmarkButton.classList.remove('confirming-delete');
        currentBookmarkId = null; 
    }

    // Hides the dialog when the cancel button is clicked.
    cancelActionButton.addEventListener('click', () => {
        hideUpdateDialog();
    });

    // Updates the bookmark with the new title and URL when the update button is clicked.
    updateBookmarkButton.addEventListener('click', () => {
            const newTitle = updateTitleInput.value.trim(); 
            const newUrlFromInput = updateUrlInput.value.trim(); 

            if (!currentBookmarkId) {
                console.error("No bookmark ID selected for update.");
                hideUpdateDialog();
                return;
            }

            if (!newUrlFromInput || !(newUrlFromInput.startsWith('http:') || newUrlFromInput.startsWith('https:') || newUrlFromInput.startsWith('ftp:') || newUrlFromInput.startsWith('file:'))) {
                alert("Please enter a valid URL in the URL field (e.g., starting with http://, https://, ftp://, or file://).");
                updateUrlInput.focus(); 
                return; 
            }

            chrome.bookmarks.update(currentBookmarkId, {
                title: newTitle, 
                url: newUrlFromInput 
            }, () => {
                loadBookmarks(); 
                hideUpdateDialog(); 
            });
        });

    // Handles the two-step delete confirmation process.
    deleteBookmarkButton.addEventListener('click', () => {
            if (!currentBookmarkId) {
                console.error("No bookmark ID for delete action.");
                hideUpdateDialog(); 
                return;
            }
            const currentState = deleteBookmarkButton.dataset.deleteState || 'initial';
            if (currentState === 'initial') {
                deleteBookmarkButton.textContent = 'Confirm Delete?';
                deleteBookmarkButton.dataset.deleteState = 'confirming';
                deleteBookmarkButton.classList.add('confirming-delete'); 
            } else if (currentState === 'confirming') {
                chrome.bookmarks.remove(currentBookmarkId, () => {
                    loadBookmarks();      
                    hideUpdateDialog();   
                });
            }
        });

    // Adds a keydown listener to an input element to handle the Enter key.
    function setupEnterKeyListener(inputElement) {
        inputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                updateBookmarkButton.click();
            }
        });
    }

    setupEnterKeyListener(updateTitleInput);
    setupEnterKeyListener(updateUrlInput);

    // Closes the dialog if the user clicks outside of its content area.
    window.addEventListener('click', (event) => {
        if (updateDialog.style.display === 'flex' && event.target === updateDialog) {
            hideUpdateDialog();
        }
    });

    // Closes the dialog if the user presses the Escape key.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (updateDialog.style.display === 'block' || updateDialog.style.display === 'flex') {
                hideUpdateDialog();
            }
        }
    });

    // Fetches all bookmarks, gets their visit counts, sorts them by frequency, and updates the display.
    async function loadBookmarks() {
        const bookmarkTreeNodes = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
        let bookmarks = getAllBookmarks(bookmarkTreeNodes);

        const historyPromises = bookmarks.map(bookmark =>
            new Promise(resolve => {
                const timeout = setTimeout(() => {
                    console.warn(`History search for ${bookmark.url} timed out.`);
                    bookmark.visitCount = 0;
                    resolve(bookmark);
                }, 500); // 500ms timeout

                chrome.history.getVisits({ url: bookmark.url }, (visitItems) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        bookmark.visitCount = 0;
                        resolve(bookmark);
                        return;
                    }
                    bookmark.visitCount = visitItems ? visitItems.length : 0;
                    resolve(bookmark);
                });
            })
        );

        allBookmarks = await Promise.all(historyPromises);
        allBookmarks.sort((a, b) => b.visitCount - a.visitCount);

        updateDisplayedBookmarks();
    }

    // Updates the displayed bookmarks in real-time as the user types in the search box.
    searchBox.addEventListener('input', updateDisplayedBookmarks);

    // Recursively traverses the bookmark tree to create a flat list of all bookmarks.
    function getAllBookmarks(bookmarks) {
        let allBookmarksArr = [];
        bookmarks.forEach((bookmark) => {
            if (bookmark.children) {
                allBookmarksArr = allBookmarksArr.concat(getAllBookmarks(bookmark.children));
            } else if (bookmark.url) {
                allBookmarksArr.push({ id: bookmark.id, title: bookmark.title, url: bookmark.url });
            }
        });
        return allBookmarksArr;
    }

    // Filters and displays bookmarks based on the search term or shows all bookmarks if the search is empty.
    async function updateDisplayedBookmarks() {
        const searchTerm = searchBox.value.toLowerCase();

        if (searchTerm) {
            filteredBookmarks = allBookmarks.filter(b => 
                b.title.toLowerCase().includes(searchTerm) || 
                b.url.toLowerCase().includes(searchTerm)
            );
            displayResults(filteredBookmarks);
        } else {
            const data = await new Promise(resolve => chrome.storage.local.get('lastOpenedUrl', resolve));
            const lastOpenedUrl = data.lastOpenedUrl;
            
            let displayList = [...allBookmarks];

            if (lastOpenedUrl) {
                const lastOpenedIndex = displayList.findIndex(b => b.url === lastOpenedUrl);
                if (lastOpenedIndex > 0) {
                    const [lastOpenedBookmark] = displayList.splice(lastOpenedIndex, 1);
                    displayList.unshift(lastOpenedBookmark);
                }
            }
            filteredBookmarks = displayList;
            displayResults(displayList);
        }
    }

    // Adds a list of bookmarks to the results list in the UI, plus adds click handler
    function displayResults(bookmarks) {
        resultsList.innerHTML = '';
        selectedIndex = bookmarks.length > 0 ? 0 : -1;
        bookmarks.forEach((bookmark, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.index = index; 
            listItem.title = bookmark.url; 

            const titleSpan = document.createElement('span');
            titleSpan.textContent = bookmark.title;
            titleSpan.className = 'title-span'; 
            listItem.appendChild(titleSpan);

            const urlSpan = document.createElement('span');
            urlSpan.textContent = `\u00A0\u00A0${bookmark.url}`; 
            urlSpan.className = 'url-span'; 
            listItem.appendChild(urlSpan);
            
            listItem.addEventListener('click', () => {
                navigateToBookmark(bookmark.url);
            });

            resultsList.appendChild(listItem);
        });
        updateSelection();
    }

    // Navigates to the given URL in the current tab and closes the popup.
    function navigateToBookmark(url) {
        chrome.storage.local.set({ 'lastOpenedUrl': url }, () => {
            if (chrome.tabs && chrome.tabs.update) {
                chrome.tabs.update({ url: url });
            }
            window.close();
        });
    }

    // Updates the visual styling of the selected item in the bookmark list.
    function updateSelection() {
        const listItems = resultsList.querySelectorAll('li');
        listItems.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Handles keyboard navigation (up/down arrows, Enter) in the results list.
    searchBox.addEventListener('keydown', (event) => {
            const listItems = resultsList.querySelectorAll('li');
            if (listItems.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, listItems.length - 1);
                updateSelection();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
            } else if (event.key === 'Enter') {
                event.preventDefault(); 
                if (selectedIndex >= 0 && filteredBookmarks[selectedIndex]) {
                    navigateToBookmark(filteredBookmarks[selectedIndex].url);
                } else if (filteredBookmarks.length > 0) {
                    navigateToBookmark(filteredBookmarks[0].url);
                }
            }
        });
    
    loadBookmarks(); 

    // Opens the edit dialog for a given bookmark and pre-fills its title and URL.
    async function openEditDialog(bookmark) {
        currentBookmarkId = bookmark.id;
        updateTitleInput.value = bookmark.title;
        deleteBookmarkButton.textContent = 'Delete';
        deleteBookmarkButton.dataset.deleteState = 'initial';
        deleteBookmarkButton.classList.remove('confirming-delete');
        updateUrlInput.value = 'Loading URL...';

        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                let displayUrl = 'Error: Could not get current tab URL.';
                if (chrome.runtime.lastError) {
                    console.error("Error querying tabs:", chrome.runtime.lastError.message);
                    displayUrl = 'Error: ' + chrome.runtime.lastError.message;
                } else if (tabs && tabs.length > 0 && tabs[0].url) {
                    displayUrl = tabs[0].url;
                }

                updateUrlInput.value = displayUrl;
                updateDialog.style.display = 'flex';
                updateTitleInput.focus();
                resolve();
            });
        });
    }

    // Adds a right-click context menu to each bookmark item in the list.
    resultsList.addEventListener('contextmenu', async (event) => {
            event.preventDefault(); 
            event.stopPropagation();
            let targetListItem = event.target;
            while (targetListItem && targetListItem.tagName !== 'LI' && targetListItem !== resultsList) {
                targetListItem = targetListItem.parentElement;
            }

            if (targetListItem && targetListItem.tagName === 'LI' && targetListItem.parentElement === resultsList) {
                const indexData = targetListItem.dataset.index;
                if (indexData) {
                    const index = parseInt(indexData, 10);
                    if (!isNaN(index) && filteredBookmarks[index]) {
                        const bookmark = filteredBookmarks[index];
						await new Promise(resolve => setTimeout(resolve, 50)); // debounce right click, probably a short term browswer bug hack that won't be needed long
                        await openEditDialog(bookmark);
                    } else {
                        console.warn("Could not get bookmark data for context menu from item index:", indexData);
                    }
                } else {
                     console.warn("List item clicked for context menu has no data-index attribute.");
                }
            } 
        });
});
