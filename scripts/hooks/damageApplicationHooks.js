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
    // Check the global QoL setting for this feature (GM-controlled)
    if (!game.settings.get("dcc-qol", "automateDamageApply")) {
        return;
    }

    // Ignore messages that are already DCC damage application confirmations
    if (message.flags?.dcc?.isApplyDamage) {
        return;
    }

    // Check if QoL damage has already been processed for this message
    if (message.flags?.dccqol?.automatedDamageProcessed) {
        return;
    }

    // Only allow the GM to initiate automated damage application
    if (!game.user.isGM) {
        return;
    }

    const qolFlags = message.flags?.dccqol;

    // Only process DCC-QOL messages with automated damage
    if (!qolFlags?.automatedDamageTotal || !qolFlags?.targetTokenId) {
        return;
    }

    // Skip damage application for attack rolls that missed
    if (qolFlags.isAttackRoll && !qolFlags.hitsTarget) {
        console.debug(
            "DCC-QOL | Skipping damage application for missed attack:",
            message.id
        );
        return;
    }

    const damageToApply = qolFlags.automatedDamageTotal;
    const targetTokenId = qolFlags.targetTokenId;

    // Final safety check
    if (damageToApply <= 0) {
        console.warn(
            "DCC-QOL | Invalid damage amount:",
            damageToApply,
            "for message:",
            message.id
        );
        return;
    }

    const payload = {
        targetTokenId: targetTokenId,
        damageToApply: damageToApply,
        originalAttackMessageId: message.id,
    };

    const applyAutomatedDamage = async () => {
        console.debug(
            `DCC-QOL | Applying ${damageToApply} damage to ${targetTokenId} from message ${message.id}`
        );

        try {
            // Set the flag and update the message BEFORE sending the socket request
            await message.update({
                "flags.dccqol.automatedDamageProcessed": true,
            });

            try {
                const result = await socket.executeAsGM(
                    "gmApplyDamage",
                    payload
                );
                if (!result.success) {
                    console.warn(
                        `DCC-QOL | Failed to apply ${damageToApply} damage to ${targetTokenId}: ${result.reason}`
                    );
                }
            } catch (socketError) {
                console.error(
                    "DCC-QOL | Error in socket call for gmApplyDamage:",
                    socketError
                );
            }
        } catch (updateError) {
            console.error(
                `DCC-QOL | Error updating message ${message.id} with automatedDamageProcessed flag:`,
                updateError
            );
            // Still attempt damage application even if flag update fails
            try {
                const result = await socket.executeAsGM(
                    "gmApplyDamage",
                    payload
                );
                if (!result.success) {
                    console.warn(
                        `DCC-QOL | Failed to apply ${damageToApply} damage to ${targetTokenId} (after message update failure): ${result.reason}`
                    );
                }
            } catch (socketError) {
                console.error(
                    "DCC-QOL | Error in socket call for gmApplyDamage after message update failure:",
                    socketError
                );
            }
        }
    };

    // Handle timing with Dice So Nice or use timeout
    if (game.modules.get("dice-so-nice")?.active) {
        if (!message._dccQolDsnDamageApplied) {
            Hooks.once("diceSoNiceRollComplete", (completedMessageId) => {
                if (
                    completedMessageId === message.id &&
                    !message._dccQolDsnDamageApplied
                ) {
                    message._dccQolDsnDamageApplied = true;
                    applyAutomatedDamage();
                }
            });
        }
    } else {
        if (!message._dccQolTimeoutDamageApplied) {
            message._dccQolTimeoutDamageApplied = true;
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
