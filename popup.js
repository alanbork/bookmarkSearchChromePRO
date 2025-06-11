// version 2.0 rev 8
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.getElementById('searchBox');
    const resultsList = document.getElementById('results');
    
    const updateDialog = document.getElementById('updateDialog');
    const updateTitleInput = document.getElementById('updateTitleInput');
    const updateUrlInput = document.getElementById('updateUrlInput'); 
    const updateBookmarkButton = document.getElementById('updateBookmarkButton');
    const deleteBookmarkButton = document.getElementById('deleteBookmarkButton');
    const cancelActionButton = document.getElementById('cancelActionButton');

    let selectedIndex = -1;
    let allBookmarks = [];
    let filteredBookmarks = [];
    let currentBookmarkId = null; 

    // Critical checks for all fetched elements
    if (!searchBox) console.error("CRITICAL: searchBox not found!");
    if (!resultsList) console.error("CRITICAL: resultsList not found!");
    if (!updateDialog) console.error("CRITICAL: updateDialog element not found.");
    if (!updateTitleInput) console.error("CRITICAL: updateTitleInput element not found.");
    if (!updateUrlInput) console.error("CRITICAL: updateUrlInput element not found!");
    if (!updateBookmarkButton) console.error("CRITICAL: updateBookmarkButton element not found.");
    if (!deleteBookmarkButton) console.error("CRITICAL: deleteBookmarkButton element not found.");
    if (!cancelActionButton) console.error("CRITICAL: cancelActionButton element not found.");

    function hideUpdateDialog() {
        if (updateDialog) { 
             updateDialog.style.display = 'none';
        }
        if (updateTitleInput) { // Added missing clear for title input
            updateTitleInput.value = '';
        }
        if (updateUrlInput) { 
            updateUrlInput.value = ''; 
        }
        if (deleteBookmarkButton) { 
            deleteBookmarkButton.textContent = 'Delete';
            deleteBookmarkButton.dataset.deleteState = 'initial'; 
            deleteBookmarkButton.classList.remove('confirming-delete');
        }
        currentBookmarkId = null; 
    }

    if (cancelActionButton) {
        cancelActionButton.addEventListener('click', () => {
            hideUpdateDialog();
        });
    } 

    if (updateBookmarkButton) {
        updateBookmarkButton.addEventListener('click', () => {
            if (!updateTitleInput || !updateUrlInput) { // Guard against null inputs
                console.error("Update inputs not found for update action.");
                hideUpdateDialog();
                return;
            }
            const newTitle = updateTitleInput.value.trim(); 
            const newUrlFromInput = updateUrlInput.value.trim(); 

            if (!currentBookmarkId) {
                console.error("No bookmark ID selected for update.");
                hideUpdateDialog();
                return;
            }

            if (!newUrlFromInput || !(newUrlFromInput.startsWith('http:') || newUrlFromInput.startsWith('https:') || newUrlFromInput.startsWith('ftp:') || newUrlFromInput.startsWith('file:'))) {
                alert("Please enter a valid URL in the URL field (e.g., starting with http://, https://, ftp://, or file://).");
                if (updateUrlInput) updateUrlInput.focus(); 
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
    } 

    if (deleteBookmarkButton) {
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
    } 

    if (updateTitleInput) {
        updateTitleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                if (updateBookmarkButton) { 
                    updateBookmarkButton.click(); 
                }
            }
        });
    }
    
    if (updateUrlInput) {
        updateUrlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (updateBookmarkButton) {
                    updateBookmarkButton.click();
                }
            }
        });
    }

    window.addEventListener('click', (event) => {
        if (updateDialog && updateDialog.style.display === 'flex' && event.target === updateDialog) {
            hideUpdateDialog();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (updateDialog && (updateDialog.style.display === 'block' || updateDialog.style.display === 'flex')) {
                hideUpdateDialog();
            }
        }
    });

    function loadBookmarks(callback) {
        chrome.bookmarks.getTree((bookmarks) => {
            allBookmarks = getAllBookmarks(bookmarks);
            const searchTerm = searchBox ? searchBox.value.toLowerCase() : ""; // Guard searchBox
            if (searchTerm) {
                filteredBookmarks = allBookmarks.filter((bookmark) => {
                    return (
                        bookmark.title.toLowerCase().includes(searchTerm) ||
                        bookmark.url.toLowerCase().includes(searchTerm)
                    );
                });
            } else {
                filteredBookmarks = allBookmarks;
            }
            displayResults(filteredBookmarks);
            if (searchBox) searchBox.focus(); 

            if (callback && typeof callback === 'function') {
                callback();
            }
        });
    }

    if (searchBox) { 
        searchBox.addEventListener('input', () => {
            const searchTerm = searchBox.value.toLowerCase();
            filteredBookmarks = allBookmarks.filter((bookmark) => {
                return (
                    bookmark.title.toLowerCase().includes(searchTerm) ||
                    bookmark.url.toLowerCase().includes(searchTerm)
                );
            });
            displayResults(filteredBookmarks);
        });
    }

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

   function displayResults(bookmarks) {
        if (!resultsList) return; 
        resultsList.innerHTML = '';
        selectedIndex = -1; 
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

    function navigateToBookmark(url) {
        if (chrome.tabs && chrome.tabs.update) {
            chrome.tabs.update({ url: url });
        }
        window.close();
    }

    function updateSelection() {
        if (!resultsList) return; 
        const listItems = resultsList.querySelectorAll('li');
        listItems.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    if (searchBox) { 
        searchBox.addEventListener('keydown', (event) => {
            if (!resultsList) return; 
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
                event.preventDefault(); // Prevent default form submission behavior
                if (selectedIndex >= 0 && filteredBookmarks[selectedIndex]) {
                    // An item is actively selected via arrow keys
                    navigateToBookmark(filteredBookmarks[selectedIndex].url);
                } else if (filteredBookmarks.length > 0) {
                    // No active selection, but there are results
                    navigateToBookmark(filteredBookmarks[0].url); // Navigate to the first one
                }
                // If selectedIndex < 0 AND filteredBookmarks.length is 0, nothing happens
            }
        });
    }
    
    loadBookmarks(); 

    if (resultsList) { 
        resultsList.addEventListener('contextmenu', (event) => {
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
                        event.preventDefault(); 
                        
                        currentBookmarkId = bookmark.id; 

                        if (updateTitleInput) {
                            updateTitleInput.value = bookmark.title; 
                        }
                        
                        if (deleteBookmarkButton) {
                            deleteBookmarkButton.textContent = 'Delete';
                            deleteBookmarkButton.dataset.deleteState = 'initial';
                            deleteBookmarkButton.classList.remove('confirming-delete');
                        }

                        if (updateUrlInput) { 
                            updateUrlInput.value = 'Loading URL...'; 
                        }

                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            let displayUrl = 'Error: Could not get current tab URL.';
                            if (chrome.runtime.lastError) {
                                console.error("Error querying tabs:", chrome.runtime.lastError.message);
                                displayUrl = 'Error: ' + chrome.runtime.lastError.message;
                            } else if (tabs && tabs.length > 0 && tabs[0].url) {
                                displayUrl = tabs[0].url; // Pre-fill with any URL
                            }
                            
                            if (updateUrlInput) { 
                                updateUrlInput.value = displayUrl; 
                            }

                            if (updateDialog) {
                                updateDialog.style.display = 'flex'; 
                            }
                            if (updateTitleInput) {
                                updateTitleInput.focus(); 
                            }
                        });
                        
                    } else {
                        console.warn("Could not get bookmark data for context menu from item index:", indexData);
                    }
                } else {
                     console.warn("List item clicked for context menu has no data-index attribute.");
                }
            } 
        });
    }
});
