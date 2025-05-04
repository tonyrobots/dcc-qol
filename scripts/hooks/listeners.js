import { addTestBonus as addTestBonus } from "./attackRollHooks.js";
// Import other hook listeners here as they are created...
// e.g., import { setupChatListeners } from './chatHooks.js';

/**
 * Initializes and registers all hook listeners for the module.
 */
export function initializeHookListeners() {
    console.log("DCC-QOL | Initializing hook listeners...");

    // Register attack roll listeners
    Hooks.on("dcc.modifyAttackRollTerms", addTestBonus);
    console.log("DCC-QOL | Registered listener for dcc.modifyAttackRollTerms");

    // Register chat listeners (example)
    // Hooks.on('renderChatMessage', setupChatListeners);

    // Register other hooks...

    console.log("DCC-QOL | Hook listeners initialized.");
}
