// Saves options to chrome.storage.sync
function saveOptions() {
    const emoteSizeInput = document.getElementById('emoteSize');
    const status = document.getElementById('status');

    let emoteSizeValue = emoteSizeInput.value.trim();

    // Basic validation: ensure it ends with 'em' or 'px' and has a number before it
    if (!/^\d+(\.\d+)?(em|px)$/i.test(emoteSizeValue)) {
        status.textContent = 'Error: Invalid size format. Use numbers followed by "em" or "px" (e.g., 1.5em, 24px).';
        setTimeout(() => { status.textContent = ''; }, 3000);
        return; // Stop saving if invalid
    }

    // Use chrome.storage.sync for settings
    chrome.storage.sync.set({
        emoteSize: emoteSizeValue
    }, () => {
        // Update status to let user know options were saved.
        status.textContent = 'Options saved.';
        console.log('Options saved:', { emoteSize: emoteSizeValue });
        setTimeout(() => { status.textContent = ''; }, 1500);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    const defaultSize = '1.5em'; // Default value if none is stored
    // Use default value emoteSize = '1.5em'
    chrome.storage.sync.get({
        emoteSize: defaultSize // Provide default value here
    }, (items) => {
        document.getElementById('emoteSize').value = items.emoteSize;
        console.log('Options restored:', items);
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);