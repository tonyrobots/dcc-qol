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
    -   **`scripts/legacy/`:** Contains legacy JavaScript files retained for reference during the migration to the hook-based system. **These files are deprecated and will be removed** once their functionality is fully reimplemented using hooks. **Do not add new code or modify files here.**
        -   `dcc-qol.js`: Legacy main module entry point.
        -   `patch.js`: Legacy file containing function overrides (monkey-patching).
        -   `chat.js`: Legacy file for chat message manipulation and listeners.
-   **`styles/`:** CSS or SCSS files for module styling (e.g., `dcc-qol.css`).
-   **`templates/`:** Handlebars (`.hbs`) templates used for rendering UI elements, such as chat messages or dialogs. Note that legacy templates might exist and need updating or replacing as features are refactored.

## Architectural Approach: Hook-Based Events

The module **must** operate based on listening to hooks provided by Foundry VTT core and the DCC-RPG system.

1.  **Identify the Hook:** Determine the appropriate hook that fires when the desired action occurs or data is available (e.g., `renderChatMessage`, `dcc.rollWeaponAttack`, `dcc.modifyRoll`).
2.  **Register Listener:** Add a listener for the hook in `scripts/hooks/listeners.js`.
3.  **Implement Handler:** Create the function that will execute when the hook fires. This function should reside in a logically named file within `scripts/hooks/` (e.g., `attackRollHooks.js`).
4.  **Import and Connect:** Import the handler function into `listeners.js` and pass it as the callback when registering the hook.

**Avoid Overrides:** Direct modification or replacement (monkey-patching) of core Foundry or DCC system functions (like methods previously targeted in `patch.js`) is strictly forbidden in the new architecture. Rely solely on the available hooks. If a necessary hook doesn't exist, the preferred approach is to request its addition to the core DCC system.

**Modularity:** Keep hook handler files focused on specific features or hook types. This promotes maintainability and testability.

**Reference Legacy Code:** The legacy files (`legacy/patch.js`, `legacy/chat.js`, `legacy/dcc-qol.js`) can be consulted to understand previous functionality but should not be directly copied or modified. The goal is to reimplement their features using the hook-based pattern. These files will be deleted once their functionality is fully migrated.
