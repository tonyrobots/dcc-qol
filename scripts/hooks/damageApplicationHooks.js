/* global game, Hooks, canvas, console, setTimeout, ui */
import { socket } from "../dcc-qol.js"; // Import the socket

const autoDamageInitiatedForMessageIds = new Set();

/**
 * Handles the automatic application of damage if the roll was automated by the DCC system
 * and the relevant QoL setting is enabled.
 * Called via the renderChatMessage hook.
 *
 * @param {ChatMessage} message - The ChatMessage document being rendered.
 * @param {jQuery} html - The jQuery object representing the message's HTML content. (Unused in this function but part of the hook signature)
 * @param {object} data - The data object provided to the hook. (Unused in this function but part of the hook signature)
 */
export async function handleAutomatedDamageApplication(message, html, data) {
    console.debug(
        "DCC-QOL | handleAutomatedDamageApplication triggered for message:",
        message.id,
        "Flags:",
        JSON.parse(JSON.stringify(message.flags || {}))
    );

    // Ignore messages that are already DCC damage application confirmations
    if (message.flags?.dcc?.isApplyDamage) {
        console.debug(
            "DCC-QOL | Message is already a damage application confirmation. Skipping.",
            message.id
        );
        return;
    }

    // Only allow the GM to initiate automated damage application
    if (!game.user.isGM) {
        // console.debug("DCC-QOL | Not on GM client. Skipping automated damage application."); // Too noisy for players
        return;
    }

    // Check the global QoL setting for this feature (GM-controlled)
    if (!game.settings.get("dcc-qol", "automateDamageApply")) {
        console.debug(
            "DCC-QOL | automateDamageApply setting is OFF. Skipping.",
            message.id
        );
        return;
    }

    // If we've already initiated the auto damage process for this message ID, stop.
    if (autoDamageInitiatedForMessageIds.has(message.id)) {
        console.debug(
            "DCC-QOL | Auto damage already initiated for this message ID. Skipping.",
            message.id
        );
        return;
    }

    const qolFlags = message.flags?.dccqol;
    let damageToApply;
    let targetTokenId;
    let sourceOfAutomation = null;

    console.debug(
        "DCC-QOL | Checking primary QoL damage logic for message:",
        message.id,
        "qolFlags:",
        JSON.parse(JSON.stringify(qolFlags || {}))
    );

    // Primary QoL automated damage application logic
    if (
        qolFlags?.automatedDamageTotal !== undefined &&
        qolFlags?.targetTokenId
    ) {
        console.debug(
            "DCC-QOL | Primary condition met (automatedDamageTotal & targetTokenId present) for message:",
            message.id
        );
        if (qolFlags.isAttackRoll && !qolFlags.hitsTarget) {
            console.debug(
                "DCC-QOL | DCC System Automated damage from attack roll SKIPPED due to MISS for message:",
                message.id
            );
        } else {
            damageToApply = qolFlags.automatedDamageTotal;
            targetTokenId = qolFlags.targetTokenId;
            sourceOfAutomation = qolFlags.isAttackRoll
                ? "dcc_system_auto_damage_on_hit"
                : "qol_button_or_other_damage";
            console.debug(
                `DCC-QOL | Primary logic determined: damage=${damageToApply}, target=${targetTokenId}, source=${sourceOfAutomation} for message:`,
                message.id
            );
        }
    }
    // If the primary QoL path didn't set a source, and it's a damage roll, log it for debugging.
    else if (
        !sourceOfAutomation &&
        message.rolls &&
        message.rolls.length > 0 &&
        message.flavor?.toLowerCase().includes("damage") &&
        message.speaker?.actor
    ) {
        console.warn(
            "DCC-QOL | Damage Application Fallback would have been triggered (logging only) for message:",
            message.id,
            message
        );
    } else {
        console.debug(
            "DCC-QOL | Message did not qualify for primary QoL damage or fallback logging for message:",
            message.id
        );
    }

    // Safety Check & Exit if no valid automation was determined
    if (
        !sourceOfAutomation ||
        damageToApply === undefined ||
        damageToApply <= 0 ||
        targetTokenId === undefined
    ) {
        console.debug(
            "DCC-QOL | Safety check failed or no automation determined. Exiting for message:",
            message.id,
            `Source: ${sourceOfAutomation}, Damage: ${damageToApply}, Target: ${targetTokenId}`
        );
        return;
    }

    console.debug(
        "DCC-QOL | Proceeding to apply damage for message:",
        message.id,
        `Source: ${sourceOfAutomation}, Damage: ${damageToApply}, Target: ${targetTokenId}`
    );

    // Mark that we are initiating auto damage for this message ID.
    autoDamageInitiatedForMessageIds.add(message.id);
    setTimeout(() => {
        autoDamageInitiatedForMessageIds.delete(message.id);
    }, 5000);

    const payload = {
        targetTokenId: targetTokenId,
        damageToApply: damageToApply,
        originalAttackMessageId: message.id,
    };

    const applyAutomatedDamage = () => {
        console.debug(
            `DCC-QOL | Executing applyAutomatedDamage via socket for ${damageToApply} to ${targetTokenId}. Message ID: ${message.id}`
        );
        socket
            .executeAsGM("gmApplyDamage", payload)
            .catch((err) =>
                console.error(
                    `DCC-QOL | Error in socket call for gmApplyDamage (Source: ${sourceOfAutomation}):`,
                    err
                )
            );
    };

    if (game.modules.get("dice-so-nice")?.active) {
        if (!message._dccQolDsnDamageApplied) {
            Hooks.once("diceSoNiceRollComplete", (completedMessageId) => {
                if (
                    completedMessageId === message.id &&
                    !message._dccQolDsnDamageApplied
                ) {
                    message._dccQolDsnDamageApplied = true;
                    console.debug(
                        `DCC-QOL | DSN Hook: Triggering applyAutomatedDamage for message: ${message.id}`
                    );
                    applyAutomatedDamage();
                }
            });
        }
    } else {
        if (!message._dccQolTimeoutDamageApplied) {
            message._dccQolTimeoutDamageApplied = true;
            console.debug(
                `DCC-QOL | setTimeout: Triggering applyAutomatedDamage for message: ${message.id}`
            );
            setTimeout(applyAutomatedDamage, 100);
        }
    }
}

/**
 * Appends "Applied Damage" information to QoL Damage Roll chat messages.
 * Called via the renderChatMessage hook. Not currently used.
 *
 * @param {ChatMessage} message - The ChatMessage document being rendered.
 * @param {jQuery} html - The jQuery object representing the message's HTML content.
 * @param {object} data - The data object provided to the hook. (Unused in this function but part of the hook signature)
 */
export function appendAppliedDamageInfoToCard(message, html, data) {
    const qolFlags = message.flags?.dccqol;
    if (
        qolFlags &&
        qolFlags.isDamageRoll &&
        qolFlags.appliedDamageValue !== undefined &&
        qolFlags.appliedDamageTargetName
    ) {
        const appliedDamageHtml =
            `<div style="color: red; font-style: italic; text-align: center; padding-top: 5px;" class="dccqol-damage-applied-info">` +
            `Applied ${qolFlags.appliedDamageValue} damage to ${qolFlags.appliedDamageTargetName}.` +
            `</div>`;

        const messageContent = html.find(".message-content");
        if (messageContent.length > 0) {
            messageContent.append(appliedDamageHtml);
        } else {
            html.append(appliedDamageHtml);
        }
    }
}
