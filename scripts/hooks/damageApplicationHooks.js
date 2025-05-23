/* global game, Hooks, canvas, console, setTimeout, ui */
import { socket } from "../dcc-qol.js"; // Import the socket

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
    if (!game.settings.get("dcc-qol", "automateDamageApply")) {
        return; // Master QoL setting for this feature is off
    }

    const qolFlags = message.flags?.dccqol;
    let damageToApply;
    let targetTokenId;
    let sourceOfAutomation = null; // For logging: "attack_roll", "generic_roll"

    // Scenario 1: Damage from a QoL-enhanced attack roll that hit
    if (
        qolFlags &&
        qolFlags.isAttackRoll && // Flag indicating it came through our attack roll prep
        qolFlags.hitsTarget && // The attack roll was a hit
        qolFlags.automatedDamageTotal !== undefined && // Damage amount is available from attack data
        qolFlags.targettokenId // Target is known from attack data
    ) {
        damageToApply = qolFlags.automatedDamageTotal;
        targetTokenId = qolFlags.targettokenId;
        sourceOfAutomation = "attack_roll";
    }
    // Scenario 2: A generic damage roll (not covered by Scenario 1)
    else if (
        message.rolls &&
        message.rolls.length > 0 &&
        message.flavor &&
        message.flavor.toLowerCase().includes("damage")
    ) {
        const rollTotal = message.rolls[0]?.total;
        if (rollTotal !== undefined && rollTotal > 0) {
            // For generic damage rolls, we rely on the user having targeted tokens.
            const targets = Array.from(game.user.targets);
            if (targets.length > 0) {
                damageToApply = rollTotal;
                targetTokenId = targets[0].id; // Apply to the first selected target
                sourceOfAutomation = "generic_roll";
                if (targets.length > 1) {
                    ui.notifications.info(
                        `DCC-QOL: Auto-applied damage to the first of ${targets.length} selected targets. For applying to multiple targets, please do so manually for now.`
                    );
                }
            } else {
                // console.log(`DCC-QOL | handleAutomatedDamageApplication: Generic damage roll for message ${message.id}, but no target selected.`);
            }
        } else {
            // console.log(`DCC-QOL | handleAutomatedDamageApplication: Generic damage roll for message ${message.id} has no valid roll total.`);
        }
    }

    if (
        !sourceOfAutomation ||
        damageToApply === undefined ||
        damageToApply <= 0 || // Don't apply if no damage or healing
        targetTokenId === undefined
    ) {
        // console.log(`DCC-QOL | handleAutomatedDamageApplication: Conditions not met or no damage to apply for message ${message.id}. Source: ${sourceOfAutomation}, Damage: ${damageToApply}, Target: ${targetTokenId}`);
        return;
    }

    // --- Proceed with damage application ---
    console.log(
        `DCC-QOL | handleAutomatedDamageApplication: Attempting to apply ${damageToApply} to ${targetTokenId} (Source: ${sourceOfAutomation}). Message ID: ${message.id}`
    );

    const payload = {
        targetTokenId: targetTokenId,
        damageToApply: damageToApply,
        originalAttackMessageId: message.id,
    };

    const applyAutomatedDamage = () => {
        console.log(
            `DCC-QOL | Executing applyAutomatedDamage for ${damageToApply} to ${targetTokenId}. Message ID: ${message.id}, QoL Flags (if any):`,
            qolFlags ? JSON.parse(JSON.stringify(qolFlags)) : "No QoL Flags"
        );
        socket
            .executeAsGM("gmApplyDamage", payload)
            .catch((err) =>
                console.error(
                    `DCC-QOL | Error applying automated system damage (Source: ${sourceOfAutomation}):`,
                    err
                )
            );
    };

    if (game.modules.get("dice-so-nice")?.active) {
        if (!message._dccQolDsnDamageApplied) {
            // Check the message-specific flag
            Hooks.once("diceSoNiceRollComplete", (completedMessageId) => {
                if (
                    completedMessageId === message.id &&
                    !message._dccQolDsnDamageApplied // Double-check before applying
                ) {
                    message._dccQolDsnDamageApplied = true; // Set the flag
                    console.log(
                        `DCC-QOL | DSN Hook for applyAutomatedDamage (Source: ${sourceOfAutomation}). Message ID: ${message.id}, Completed ID: ${completedMessageId}`
                    );
                    applyAutomatedDamage();
                }
            });
        }
    } else {
        if (!message._dccQolTimeoutDamageApplied) {
            // Check the message-specific flag
            message._dccQolTimeoutDamageApplied = true; // Set the flag
            console.log(
                `DCC-QOL | setTimeout for applyAutomatedDamage (Source: ${sourceOfAutomation}). Message ID: ${message.id}`
            );
            setTimeout(applyAutomatedDamage, 100);
        }
    }
}

/**
 * Appends "Applied Damage" information to QoL Damage Roll chat messages.
 * Called via the renderChatMessage hook.
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
            // Fallback if .message-content isn't found, append to the root message element
            html.append(appliedDamageHtml);
        }
    }
}
