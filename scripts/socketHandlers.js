/* global canvas, CONST, ui, ChatMessage, game */
import { socket } from "./dcc-qol.js"; // Import the socket for broadcasting to clients

/**
 * Creates scrolling damage text at the specified token position.
 * This function is called on all clients to ensure everyone sees the damage animation.
 *
 * @param {string} tokenId - The ID of the token to display damage text above.
 * @param {number} damage - The damage amount to display.
 */
export function createDamageScrollingText(tokenId, damage) {
    const token = canvas.tokens.get(tokenId);
    if (!token || !canvas.interface) return;

    canvas.interface.createScrollingText(token.center, damage.toString(), {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: 28,
        fill: "#FF0000", // Red for damage
        stroke: "#000000",
        strokeThickness: 4,
        duration: 3000,
    });
}

/**
 * Handles the request to apply damage, executed on the GM's client via socketlib.
 *
 * @param {object} payload - The data payload from the client.
 * @param {string} payload.targetTokenId - The ID of the target token.
 * @param {number} payload.damageToApply - The amount of damage to apply.
 */
export async function gmApplyDamage(payload) {
    const { targetTokenId, damageToApply } = payload;

    if (!game.user.isGM) {
        return { success: false, reason: "not-gm" };
    }

    const targetToken = canvas.tokens.get(targetTokenId);
    if (!targetToken || !targetToken.actor) {
        return { success: false, reason: "no-target" };
    }

    const targetActor = targetToken.actor;

    try {
        // Use the DCC system's applyDamage method
        await targetActor.applyDamage(damageToApply, 1); // multiplier of 1 for standard damage

        // Show scrolling text on canvas for ALL clients
        createDamageScrollingText(targetTokenId, damageToApply);
        socket.executeForOthers(
            "createDamageScrollingText",
            targetTokenId,
            damageToApply
        );

        return { success: true };
    } catch (applyError) {
        console.error("DCC-QOL | Error applying damage:", applyError);
        return { success: false };
    }
}

/**
 * Handles the request to update multiple message flags at once, executed on the GM's client via socketlib.
 * This ensures atomic updates and proper re-rendering on all clients.
 *
 * @param {object} payload - The data payload from the client.
 * @param {string} payload.messageId - The ID of the message to update.
 * @param {string} payload.flagScope - The flag scope (module ID).
 * @param {object} payload.flags - Object containing key-value pairs of flags to update.
 */
export async function gmUpdateMessageFlags(payload) {
    const { messageId, flagScope, flags } = payload;

    if (!game.user.isGM) {
        return { success: false, reason: "not-gm" };
    }

    try {
        const message = game.messages.get(messageId);
        if (!message) {
            return { success: false, reason: "message-not-found" };
        }

        // Update all flags in a single operation
        const updateData = {};
        for (const [key, value] of Object.entries(flags)) {
            updateData[`flags.${flagScope}.${key}`] = value;
        }

        // Foundry will automatically re-render the message on all clients when updated
        await message.update(updateData);

        return { success: true };
    } catch (error) {
        console.error("DCC-QOL | Error updating message flags:", error);
        return { success: false, reason: error.message };
    }
}
