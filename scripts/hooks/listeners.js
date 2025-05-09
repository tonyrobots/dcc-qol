import {
    addTestBonus,
    prepareQoLAttackData,
    applyFiringIntoMeleePenalty,
} from "./attackRollHooks.js";
import { enhanceAttackRollCard } from "./chatMessageHooks.js";
// Import other hook listeners here as they are created...
// e.g., import { setupChatListeners } from './chatHooks.js';

/**
 * Initializes and registers all hook listeners for the module.
 */
export function registerHookListeners() {
    console.log("DCC-QOL | Initializing hook listeners...");

    // Register attack roll listeners
    // Hooks.on("dcc.modifyAttackRollTerms", addTestBonus);
    Hooks.on("dcc.modifyAttackRollTerms", applyFiringIntoMeleePenalty);
    Hooks.on("dcc.rollWeaponAttack", prepareQoLAttackData);
    console.log("DCC-QOL | Registered listener for dcc.rollWeaponAttack");
    console.log("DCC-QOL | Registered listener for dcc.modifyAttackRollTerms");

    // Register chat message listeners
    Hooks.on("renderChatMessage", enhanceAttackRollCard);
    console.log("DCC-QOL | Registered listener for renderChatMessage");

    // Register chat listeners (example)
    // Hooks.on('renderChatMessage', setupChatListeners);

    // Register other hooks...

    console.log("DCC-QOL | Hook listeners initialized.");
}
