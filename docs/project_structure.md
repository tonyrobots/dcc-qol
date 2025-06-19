# Project Structure and Architecture

This document outlines the file structure and architectural approach for the `dcc-qol` Foundry VTT module. The purpose of the module is to provide automation options and other enhancements to the DCC RPG experience on Foundry.

**Current Status:** ✅ **V13 Compatible** - Module has been successfully converted to Foundry VTT V13.

## Key Directories

-   **`/` (Root):** Contains module configuration (`module.json`), packaging files (`package.json`), documentation (`README.md`, `CHANGELOG.md`), license (`LICENSE`), and build/tooling configurations (`.gitignore`, `.prettierrc`, etc.).
-   **`.github/`:** GitHub-specific files, including issue templates and workflow definitions (e.g., for automated testing or releases).
-   **`docs/`:** Project documentation, including this structure document, planning documents (like `to-do.md`), V13 conversion documentation (`to-do_v13_conversion.md`), and potentially user-facing guides or technical specifications.
-   **`language/`:** Localization files (e.g., `en.json`) for module text.
-   **`scripts/`:** Contains all JavaScript code for the module.
    -   **`scripts/hooks/`:** The core of the V13-compatible architecture.
        -   `listeners.js`: Central file responsible for registering all hook listeners using `Hooks.on()` or `Hooks.once()`. **V13 Update:** Now uses `renderChatMessageHTML` instead of deprecated `renderChatMessage`.
        -   `*.js` (e.g., `attackRollHooks.js`): Individual files containing the specific logic (handler functions) that respond to different hooks. Files should be named logically based on the hooks they handle or the features they implement (e.g., `chatMessageHooks.js`, `damageApplicationHooks.js`). **V13 Update:** All files now use vanilla DOM APIs instead of jQuery.
    -   **`scripts/chatCardActions/`:** Contains handler functions for actions triggered by user interactions with custom chat card elements (e.g., buttons on a QoL attack card). These are typically called by event listeners set up in `chatMessageHooks.js`. **V13 Update:** All DOM manipulation converted to vanilla JavaScript.
        -   `*.js` (e.g., `handleDamageClick.js`): Individual files for specific card actions.
    -   **`scripts/__tests__/`:** Contains automated test files using Jest. Test files should end with `.test.js` and be organized to mirror the structure of the code they test. **V13 Update:** All tests updated to work with V13 DOM handling patterns.
        -   `*.test.js` (e.g., `chatMessageHooks.test.js`, `utils.test.js`): Test files grouped by the modules or features they validate.
    -   **`scripts/__mocks__/`:** Contains mock implementations and test data factories. **V13 Update:** Includes V13 namespace mocks.
        -   `foundry.js`: Core mock implementations for Foundry VTT API objects (game, Hooks, Actor, etc.). **V13 Update:** Now includes `global.foundry.applications.handlebars` namespace mock.
        -   `mock-data.js`: Factory functions for creating standardized test data (actors, weapons, etc.).
        -   `*.js`: Additional specialized mocks as needed.
    -   `settings.js`: Registers module settings and menus using Foundry VTT's Settings API.
    -   `config.js`: Contains module-level configuration constants or flags.
    -   `dcc-qol.js`: Main module entry point.
    -   `socketHandlers.js`: Handles real-time communication via sockets.
    -   `utils.js`: Contains utility functions used across the module. **V13 Update:** All utility functions now use vanilla DOM APIs.
    -   `compatibility.js`: Manages compatibility with other modules or system versions. **V13 Update:** Contains DCC system compatibility checks.
-   **`styles/`:** CSS or SCSS files for module styling (e.g., `dcc-qol.css`).
-   **`templates/`:** Handlebars (`.hbs`) templates used for rendering UI elements, such as chat messages or dialogs. Note that legacy templates might exist and need updating or replacing as features are refactored.

## V13 Architectural Changes

### **Hook Migration**

The module has been updated to use V13-compatible hooks:

-   **`renderChatMessage` → `renderChatMessageHTML`** - The primary hook for chat message enhancement
-   **Parameter Changes:** The `html` parameter is now a raw DOM element instead of a jQuery object

### **Namespace Migration**

V13 moved several global functions into namespaces:

-   **`renderTemplate` → `foundry.applications.handlebars.renderTemplate`**
-   **Import Pattern:** Files that use `renderTemplate` now import it from the V13 namespace:
    ```javascript
    const { renderTemplate } = foundry.applications.handlebars;
    ```

### **jQuery Elimination**

All jQuery usage has been completely removed and replaced with vanilla DOM APIs:

| jQuery Method                  | V13 Vanilla Replacement                            |
| ------------------------------ | -------------------------------------------------- |
| `html.find('.selector')`       | `html.querySelector('.selector')`                  |
| `element.html(content)`        | `element.innerHTML = content`                      |
| `element.append(content)`      | `element.insertAdjacentHTML('beforeend', content)` |
| `element.addClass('class')`    | `element.classList.add('class')`                   |
| `element.on('click', handler)` | `element.addEventListener('click', handler)`       |

### **DOM Handling Patterns**

All hook handlers now follow V13 DOM patterns:

```javascript
// V13 Pattern - html is a DOM element
export function enhanceAttackRollCard(message, html, data) {
    // Use querySelector instead of find()
    const messageContent = html.querySelector(".message-content");
    if (messageContent) {
        // Use innerHTML instead of html()
        messageContent.innerHTML = renderedContent;

        // Use addEventListener instead of on()
        const button = messageContent.querySelector(
            'button[data-action="damage"]'
        );
        if (button) {
            button.addEventListener("click", handleClick);
        }
    }
}
```

## Architectural Approach: Hook-Based Events

The module **must** operate based on listening to hooks provided by Foundry VTT core and the DCC-RPG system wherever possible.

1.  **Identify the Hook:** Determine the appropriate V13-compatible hook that fires when the desired action occurs or data is available (e.g., `renderChatMessageHTML`, `dcc.rollWeaponAttack`, `dcc.modifyRoll`).
2.  **Register Listener:** Add a listener for the hook in `scripts/hooks/listeners.js`.
3.  **Implement Handler:** Create the function that will execute when the hook fires. This function should reside in a logically named file within `scripts/hooks/` (e.g., `attackRollHooks.js`). **V13 Requirement:** All handlers must use vanilla DOM APIs.
4.  **Import and Connect:** Import the handler function into `listeners.js` and pass it as the callback when registering the hook.

**V13 Hook Requirements:**

-   Use `renderChatMessageHTML` instead of `renderChatMessage`
-   Treat the `html` parameter as a raw DOM element, not jQuery object
-   Use `foundry.applications.handlebars.renderTemplate` instead of global `renderTemplate`
-   All DOM manipulation must use vanilla JavaScript APIs

**Avoid Overrides:** Direct modification or replacement (monkey-patching) of core Foundry or DCC system functions is strictly forbidden in the new architecture. Rely solely on the available hooks. If a necessary hook doesn't exist, the preferred approach is to request its addition to the core DCC system.

**Modularity:** Keep hook handler files focused on specific features or hook types. This promotes maintainability and testability.

## V13 Testing Architecture

The module includes a comprehensive suite of automated tests that validate V13 compatibility. For detailed information on the testing framework, mock implementation, and how to run tests, please see the [Automated Testing documentation](./testing.md).

### **V13 Test Requirements**

-   **Mock Setup:** Tests use V13 namespace mocks (`global.foundry.applications.handlebars`)
-   **DOM Testing:** All tests pass raw DOM elements instead of jQuery objects
-   **Realistic Fixtures:** Tests use actual HTML structures that match production templates
-   **True Validation:** Tests verify real DOM manipulation, not shallow mocks

### **Test Status:** ✅ **All 44 tests passing** with V13 compatibility

## Utility Functions

The `scripts/utils.js` file contains shared utility functions that should be used consistently across the module to maintain code quality and reduce duplication. **V13 Update:** All utility functions have been updated to use vanilla DOM APIs.

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

When adding new utility functions, ensure they follow the established patterns of input validation, error handling, debug logging, and **V13 vanilla DOM APIs**.

## V13 Compatibility Status

### **✅ Completed V13 Migrations**

-   Hook name migration (`renderChatMessage` → `renderChatMessageHTML`)
-   Namespace migration (`renderTemplate` → `foundry.applications.handlebars.renderTemplate`)
-   Complete jQuery elimination (all files converted to vanilla DOM)
-   Test suite updated for V13 DOM handling
-   Mock infrastructure updated with V13 namespaces

### **⚠️ Known V13 Issues**

-   **DCC System Warnings:** Some console warnings appear from DCC system code using deprecated V13 APIs (not dcc-qol code)
-   **Dialog V1 Deprecation:** Two files still use deprecated V1 Dialog API (functional but shows warnings)

### **🎯 V13 Success Criteria Met**

-   ✅ All automated tests pass (44/44)
-   ✅ No jQuery dependencies remaining
-   ✅ All DOM queries have null checking
-   ✅ Code follows V13 best practices
-   ✅ JSDoc comments accurate for V13

For complete V13 conversion details, see [V13 Conversion Documentation](./to-do_v13_conversion.md).
