/* global game, renderTemplate, $ */
import { getWeaponProperties } from "../utils.js"; // Import the utility function

/**
 * Replaces the content of DCC attack roll chat cards with a custom QoL template.
 * Called via the renderChatMessage hook.
 * Assumes data has been prepared by the dcc.rollWeaponAttack hook.
 *
 * @param {ChatMessage} message - The ChatMessage document being rendered.
 * @param {jQuery} html - The jQuery object representing the message's HTML content.
 * @param {object} data - The data object provided to the hook (includes original message content).
 */
export async function enhanceAttackRollCard(message, html, data) {
    // Quick check for QoL setting and our specific flag
    const qolFlags = message.flags?.dccqol;
    if (
        !game.settings.get("dcc-qol", "useQoLAttackCard") ||
        !qolFlags?.isAttackRoll
    ) {
        // --- Debug: Log why we are returning early ---
        // console.debug(`DCC-QOL | Skipping Message ID: ${message.id} | Setting: ${game.settings.get("dcc-qol", "useQoLAttackCard")}, Flag: ${qolFlags?.isAttackRoll}`);
        return;
    }

    // --- Debug: Log specifically when starting to process our QoL card ---
    // console.debug( // Keep this one commented out unless needed later
    //     "DCC-QOL | Replacing content for message:",
    //     message.id,
    //     "with QoL Card"
    // );

    try {
        // --- Fetch Actor FIRST ---
        const actor = game.actors.get(qolFlags.actorId);
        if (!actor) {
            console.warn(
                `DCC-QOL | Actor not found for ID: ${qolFlags.actorId} | Message ID: ${message.id}`
            );
            return; // Can't get weapon without actor
        }

        // --- Fetch Weapon FROM ACTOR ---
        const weapon = actor.items.get(qolFlags.weaponId); // Corrected: Use actor.items
        if (!weapon) {
            // --- Debug: Log the actor and the weapon ID we tried ---
            console.warn(
                `DCC-QOL | Weapon not found on Actor ${actor.name} (ID: ${actor.id}) with Weapon ID: ${qolFlags.weaponId} | Message ID: ${message.id}`
            );
            return; // Stop if weapon not found on the actor
        }
        // --- Debug: Confirm weapon found ---
        // console.debug( // Keep this one commented out unless needed later
        //     `DCC-QOL | Found Weapon: ${weapon.name} on Actor: ${actor.name} | Message ID: ${message.id}`
        // );

        // --- Extract Original Roll HTML ---
        const originalContent = $(`<div>${message.content}</div>`); // Use message.content
        const diceHTML =
            originalContent.find(".dice-roll").first()?.prop("outerHTML") || "";

        // --- Get Weapon Properties ---
        const properties = await getWeaponProperties(
            weapon,
            qolFlags.options || {}
        );

        // --- Prepare Template Data ---
        const templateData = {
            ...qolFlags, // Includes deedDieResult from flags now
            actor: actor,
            weapon: weapon,
            diceHTML: diceHTML, // Pass the extracted attack roll HTML
            properties: properties,
            messageId: message.id,
        };

        // --- Render the Custom Template ---
        const renderedContentHtml = await renderTemplate(
            "modules/dcc-qol/templates/attackroll-card.html",
            templateData
        );

        // --- Modify existing message elements ---
        const messageHeader = html.find(".message-header");
        if (messageHeader.length > 0) {
            // Remove the specific flavor text span
            messageHeader.find("span.flavor-text").remove();

            // Add a custom class to the sender for styling
            messageHeader
                .find("h4.message-sender")
                .addClass("dccqol-speaker-name");
        }

        // Replace the content of the .message-content div with our card
        const messageContentElement = html.find(".message-content");
        if (messageContentElement.length > 0) {
            messageContentElement.html(renderedContentHtml);
        } else {
            // Fallback if .message-content wasn't found (should be rare for standard messages)
            console.warn(
                "DCC-QOL | .message-content not found. Appending card to main message element (li)."
            );
            html.append(renderedContentHtml);
        }
    } catch (err) {
        console.error(
            "DCC QoL | Error enhancing attack roll card:",
            err,
            message.id,
            qolFlags
        );
    }
}
