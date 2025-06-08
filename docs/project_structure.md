# Project Structure and Architecture

This document outlines the file structure and architectural approach for the `dcc-qol` Foundry VTT module. The primary goal is to transition from a legacy system based on function overrides to a modern, event-driven architecture using Foundry VTT's core hooks.

## Key Directories

-   **`/` (Root):** Contains module configuration (`module.json`), packaging files (`package.json`), documentation (`README.md`, `CHANGELOG.md`), license (`LICENSE`), and build/tooling configurations (`.gitignore`, `.prettierrc`, etc.).
-   **`.github/`:** GitHub-specific files, including issue templates and workflow definitions (e.g., for automated testing or releases).
-   **`docs/`:** Project documentation, including this structure document, planning documents (like `to-do.md`), and potentially user-facing guides or technical specifications. The compiled system documentation lives in `docs/dcc-rpg-system-docs/`.
-   **`language/`:** Localization files (e.g., `en.json`) for module text.
-   **`scripts/`:** Contains all JavaScript code for the module.
    -   **`scripts/hooks/`:** The core of the new architecture.
        -   `listeners.js`: Central file responsible for registering all hook listeners using `Hooks.on()` or `Hooks.once()`. It imports functions from other files within this directory.
        -   `*.js` (e.g., `attackRollHooks.js`): Individual files containing the specific logic (handler functions) that respond to different hooks. Files should be named logically based on the hooks they handle or the features they implement (e.g., `chatMessageHooks.js`, `damageApplicationHooks.js`).
    -   **`scripts/chatCardActions/`:** Contains handler functions for actions triggered by user interactions with custom chat card elements (e.g., buttons on a QoL attack card). These are typically called by event listeners set up in `chatMessageHooks.js`.
        -   `*.js` (e.g., `handleDamageClick.js`): Individual files for specific card actions.
    -   `settings.js`: Registers module settings and menus using Foundry VTT's Settings API.
    -   `config.js`: Contains module-level configuration constants or flags.
    -   `dcc-qol.js`: Main module entry point.
    -   `socketHandlers.js`: Handles real-time communication via sockets.
    -   `utils.js`: Contains utility functions used across the module.
    -   `compatibility.js`: Manages compatibility with other modules or system versions.
-   **`styles/`:** CSS or SCSS files for module styling (e.g., `dcc-qol.css`).
-   **`templates/`:** Handlebars (`.hbs`) templates used for rendering UI elements, such as chat messages or dialogs. Note that legacy templates might exist and need updating or replacing as features are refactored.

## Architectural Approach: Hook-Based Events

The module **must** operate based on listening to hooks provided by Foundry VTT core and the DCC-RPG system.

1.  **Identify the Hook:** Determine the appropriate hook that fires when the desired action occurs or data is available (e.g., `renderChatMessage`, `dcc.rollWeaponAttack`, `dcc.modifyRoll`).
2.  **Register Listener:** Add a listener for the hook in `scripts/hooks/listeners.js`.
3.  **Implement Handler:** Create the function that will execute when the hook fires. This function should reside in a logically named file within `scripts/hooks/` (e.g., `attackRollHooks.js`).
4.  **Import and Connect:** Import the handler function into `listeners.js` and pass it as the callback when registering the hook.

**Avoid Overrides:** Direct modification or replacement (monkey-patching) of core Foundry or DCC system functions is strictly forbidden in the new architecture. Rely solely on the available hooks. If a necessary hook doesn't exist, the preferred approach is to request its addition to the core DCC system.

**Modularity:** Keep hook handler files focused on specific features or hook types. This promotes maintainability and testability.

## Automated Testing

The module includes a suite of automated tests to ensure code quality and prevent regressions. For detailed information on the testing framework, mock implementation, and how to run tests, please see the [Automated Testing documentation](./testing.md).

## Utility Functions

The `scripts/utils.js` file contains shared utility functions that should be used consistently across the module to maintain code quality and reduce duplication.

### Key Utility Functions

-   **`getTokenById(tokenId)`:** Retrieves a TokenDocument by its ID from the canvas. This function includes proper error handling, validation, and consistent logging. **Always use this function instead of manually calling `game.canvas.tokens.get(tokenId)?.document`** to ensure consistent behavior and debugging output.

    ```javascript
    import { getTokenById } from "../utils.js";

    // Preferred approach
    const tokenDoc = getTokenById(someTokenId);
    if (tokenDoc) {
        // Use the token document
        console.log(tokenDoc.name, tokenDoc.disposition);
    }

    // Avoid manual lookups like this:
    // const token = game.canvas.tokens.get(tokenId)?.document; // DON'T DO THIS
    ```

-   **`getFirstTarget(targetsSet)`:** Safely extracts the first valid TokenDocument from a Set of targets (e.g., `game.user.targets`). Includes validation and handles the common pattern where hooks provide targets as a Set<Token>.

-   **`getTokensInMeleeRange(targetTokenDocument, scope)`:** Gets all tokens within melee range of a target token, optionally filtered by disposition ("all", "enemy", "friendly", "neutral").

-   **`measureTokenDistance(token1D, token2D)`:** Measures distance between two token documents, accounting for token size.

When adding new utility functions, ensure they follow the established patterns of input validation, error handling, and debug logging.
