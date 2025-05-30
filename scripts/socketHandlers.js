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
 * Handles the request to update a message flag, executed on the GM's client via socketlib.
 * This is needed because only the GM has permission to update chat message flags.
 *
 * @param {object} payload - The data payload from the client.
 * @param {string} payload.messageId - The ID of the message to update.
 * @param {string} payload.flagScope - The flag scope (module ID).
 * @param {string} payload.flagKey - The flag key to update.
 * @param {any} payload.flagValue - The value to set for the flag.
 */
export async function gmUpdateMessageFlag(payload) {
    const { messageId, flagScope, flagKey, flagValue } = payload;

    if (!game.user.isGM) {
        return { success: false, reason: "not-gm" };
    }

    try {
        const message = game.messages.get(messageId);
        if (!message) {
            return { success: false, reason: "message-not-found" };
        }

        await message.setFlag(flagScope, flagKey, flagValue);
        return { success: true };
    } catch (error) {
        console.error("DCC-QOL | Error updating message flag:", error);
        return { success: false, reason: error.message };
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

        await message.update(updateData);

        // Trigger re-render on all clients by emitting a socket message
        socket.executeForEveryone("triggerMessageRerender", { messageId });

        return { success: true };
    } catch (error) {
        console.error("DCC-QOL | Error updating message flags:", error);
        return { success: false, reason: error.message };
    }
}

/**
 * Triggers a re-render of a specific chat message on the client.
 * This is called on all clients to ensure the updated flags are reflected.
 *
 * @param {object} payload - The data payload.
 * @param {string} payload.messageId - The ID of the message to re-render.
 */
export function triggerMessageRerender(payload) {
    const { messageId } = payload;

    try {
        const message = game.messages.get(messageId);
        if (message) {
            // Force a re-render by triggering the renderChatMessage hook
            const html = $(`.chat-message[data-message-id="${messageId}"]`);
            if (html.length > 0) {
                // Get the message data and trigger a re-render
                const data = message.getFlag("core", "export") || {};
                Hooks.call("renderChatMessage", message, html, data);
            }
        }
    } catch (error) {
        console.error("DCC-QOL | Error re-rendering message:", error);
    }
}
