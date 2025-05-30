import {
    addTestBonus,
    prepareQoLAttackData,
    applyFiringIntoMeleePenalty,
    applyRangeChecksAndPenalties,
} from "./attackRollHooks.js";
import {
    enhanceAttackRollCard,
    styleSystemChatCard,
} from "./chatMessageHooks.js";
import {
    handleAutomatedDamageApplication,
    appendAppliedDamageInfoToCard,
} from "./damageApplicationHooks.js";
import { enrichDccWeaponAttackMessage } from "./enrichmentHooks.js";
// Import other hook listeners here as they are created...
// e.g., import { setupChatListeners } from './chatHooks.js';

/**
 * Initializes and registers all hook listeners for the module.
 */
export function registerHookListeners() {
    // Register attack roll listeners
    // Hooks.on("dcc.modifyAttackRollTerms", addTestBonus);
    Hooks.on("dcc.modifyAttackRollTerms", applyFiringIntoMeleePenalty);
    Hooks.on("dcc.modifyAttackRollTerms", applyRangeChecksAndPenalties);
    Hooks.on("dcc.rollWeaponAttack", prepareQoLAttackData);
    // Hooks.on("dcc.rollWeaponAttack", enrichDccWeaponAttackMessage);

    // Register chat message listeners
    Hooks.on("renderChatMessage", (message, html, data) => {
        enhanceAttackRollCard(message, html, data);
        styleSystemChatCard(message, html, data);
        handleAutomatedDamageApplication(message, html, data);
        appendAppliedDamageInfoToCard(message, html, data);
    });

    console.log("DCC-QOL | Hook listeners initialized.");
}
