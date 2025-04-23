# vibelounge7tvextension

Unleash the Vibe: A fully vibe-coded Brave/Chrome extension to supercharge your The Lounge experience with 7TV emotes!

This extension has two main goals:
1.  **Display 7TV Emotes:** See those glorious 7TV emotes directly within your The Lounge chat.
2.  **Revamp Autocomplete:** Replace the default emote autocomplete with a clean, 7TV-only list. I got rid of those old people emotes for you.

Tested thoroughly on Brave Browser.

## Installation

Here's how to get the `vibelounge7tvextension` up and running:

1.  **Get the Code:**
    Download or clone this repository to your local machine.

2.  **Configure Allowed URLs:**
    This is a crucial step! You *must* tell the extension which The Lounge URL(s) it should run on.
    *   Open the `manifest.json` file in the downloaded/cloned repository.
    *   Find the `"matches"` section.
    *   Replace the placeholder URL(s) with the actual URL(s) of your The Lounge server(s). **Make sure to add `/*` to the end of each URL!**

    It should look something like this example (replace the example URL with yours!):

    ![Example manifest.json matches section](https://github.com/user-attachments/assets/ca54048a-4476-4ad7-be52-727e5a0d5433)

## Loading in Brave/Chrome

This extension was primarily tested on Brave Browser, but the steps are generally the same for Chrome:

1.  Open your browser's extensions page. You can usually do this by typing `brave://extensions` or `chrome://extensions` in the address bar.
2.  Enable **Developer mode**. This toggle is usually found in the top right corner of the extensions page.
3.  Click the **Load unpacked** button. This is typically in the top left corner.
4.  Navigate to and select the folder where you downloaded/cloned the `vibelounge7tvextension` repository.

The extension should now appear in your list of installed extensions!

## Compatibility & Testing

This extension has been tested and confirmed working with:

*   **7TV API Endpoint:** gql v4
*   **The Lounge:** v4.4.3
*   **Brave Browser:** v1.77.100

While it *should* work with compatible versions of Chrome and potentially other The Lounge versions, compatibility is only guaranteed for the tested versions listed above.

## Screenshots

See what the `vibelounge7tvextension` looks like in action!

**The Clean 7TV Autocomplete:**
Ditch the default clutter for a simple, 7TV-only selection list.

![Screenshot of the 7TV emote autocomplete in The Lounge](https://github.com/user-attachments/assets/4b5ce917-6954-4619-9044-8958830a3960)

**Adjustable Emote Size:**
Fine-tune the size of the displayed emotes via the extension options.

![Screenshot of the extension options page with emote size setting](https://github.com/user-attachments/assets/fab83660-ae15-490c-9cec-1f2b60ab45bc)

Enjoy the vibes!
