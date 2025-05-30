/* global game */
import { getFirstTarget } from "../utils.js";

// TODO: I'm not sure we need this; we should be able to use the attackRollHooks.js/prepareQoLAttackData hook instead.
// Also, I'm leaning towards not making the qol attack card optional, in which case we don't need to worry about dcc system attack card handling.

/**
 * Enriches DCC system weapon attack messages with QoL flags.
 * Hook: dcc.rollWeaponAttack
 *
 * @param {Roll[]} rolls - Array of Roll objects associated with the attack.
 * @param {object} messageData - The data for the chat message to be created.
 */
export function enrichDccWeaponAttackMessage(rolls, messageData) {
    console.debug(
        "DCC-QOL | enrichDccWeaponAttackMessage triggered. Initial messageData.flags:",
        JSON.parse(JSON.stringify(messageData.flags || {}))
    );

    // If QoL flags already exist (e.g., from a QoL card), do nothing.
    if (messageData.flags?.dccqol) {
        console.debug(
            "DCC-QOL | QoL flags already present. Skipping enrichment.",
            messageData.flags.dccqol
        );
        return;
    }

    // Initialize QoL flags
    messageData.flags = messageData.flags || {}; // Ensure flags object exists
    messageData.flags.dccqol = {};

    const qolFlags = messageData.flags.dccqol;

    // Mark that these flags were added by enrichment
    qolFlags.enrichedFromSystem = true;

    // Basic roll information
    qolFlags.isAttackRoll = true; // This hook is specifically for weapon attacks
    qolFlags.hitsTarget = messageData.system?.hitsAc ?? false;

    // Target information
    const rollerTargets = messageData.system?.targets; // This is a Set<Token>
    if (rollerTargets instanceof Set && rollerTargets.size > 0) {
        // Attempt to get the first target's document using the utility.
        // Note: getFirstTarget expects a Set<Token> and returns a TokenDocument or null.
        const targetTokenDoc = getFirstTarget(rollerTargets);
        if (targetTokenDoc) {
            qolFlags.targetTokenId = targetTokenDoc.id;
            console.debug(
                "DCC-QOL | Enrichment: Target determined:",
                targetTokenDoc.id,
                targetTokenDoc.name
            );
        } else {
            console.debug(
                "DCC-QOL | Enrichment: getFirstTarget returned null, no valid target document found in the Set."
            );
            qolFlags.targetTokenId = null; // Explicitly set to null if no valid target
        }
    } else {
        console.debug(
            "DCC-QOL | Enrichment: No targets found in messageData.system.targets."
        );
        qolFlags.targetTokenId = null; // Explicitly set to null if no targets
    }

    // Damage information
    // DCC's 'automateDamageFumblesCrits' (client setting) determines if damageRoll is populated.
    // If that setting is off, damage isn't pre-rolled by DCC, so we shouldn't try to auto-apply.
    if (
        messageData.system?.damageRoll instanceof Roll &&
        messageData.system.damageRoll.total !== undefined
    ) {
        qolFlags.automatedDamageTotal = Number(
            messageData.system.damageRoll.total
        );
        console.debug(
            "DCC-QOL | Enrichment: Automated damage total from damageRoll:",
            qolFlags.automatedDamageTotal
        );
    } else if (qolFlags.hitsTarget && messageData.system?.damageRollFormula) {
        // If it hits, and there's a formula, but no pre-rolled damage total,
        // it implies DCC's auto-damage was off or didn't run.
        // We will not try to roll it here; QoL auto-damage will only apply if total is present.
        console.debug(
            "DCC-QOL | Enrichment: Hits target, damageRollFormula present, but no damageRoll.total. No automatedDamageTotal set."
        );
        qolFlags.automatedDamageTotal = undefined; // Explicitly
    } else {
        qolFlags.automatedDamageTotal = undefined; // Explicitly
    }

    // Store the attack roll (first roll in the array)
    if (rolls && rolls.length > 0 && rolls[0] instanceof Roll) {
        try {
            qolFlags.originalRollData = rolls[0].toJSON(); // Store the JSON representation
            console.debug("DCC-QOL | Enrichment: Stored originalRollData.");
        } catch (e) {
            console.error(
                "DCC-QOL | Error serializing roll for originalRollData:",
                e
            );
        }
    }

    console.debug(
        "DCC-QOL | Completed enrichment. Resulting messageData.flags.dccqol:",
        JSON.parse(JSON.stringify(qolFlags))
    );
}
