/**
 * Handles Foundry VTT hooks related to chat message rendering and interaction.
 * This typically involves modifying the HTML of a chat message before it's displayed
 * or attaching event listeners to elements within a rendered chat message.
 */
/* global game, renderTemplate, $ */
import { getWeaponProperties, getWeaponFromActorById } from "../utils.js"; // Import the utility function
import { handleDamageClick } from "../chatCardActions/handleDamageClick.js";
import { handleCritClick } from "../chatCardActions/handleCritClick.js";
import { handleFumbleClick } from "../chatCardActions/handleFumbleClick.js";
import { handleFriendlyFireClick } from "../chatCardActions/handleFriendlyFireClick.js";

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

    try {
        // --- Fetch Actor ---
        let actor;
        const actorIdFromFlags = qolFlags.actorId;

        if (actorIdFromFlags) {
            actor = game.actors.get(actorIdFromFlags);
        } else {
            // This would indicate an issue if actorIdFromFlags is expected for all attack rolls
            console.warn(
                `DCC-QOL | actorId missing from qolFlags. Message ID: ${message.id}. Attempting fallback to speaker.`
            );
            actor = message.getSpeakerActor(); // Optional: fallback if flag is missing
        }

        // Final check if an actor was determined
        if (!actor) {
            console.warn(
                `DCC-QOL | Actor could not be determined. Speaker Token: ${message.speaker.token}, Speaker Scene: ${message.speaker.scene}, Flagged Actor ID: ${actorIdFromFlags}. Message ID: ${message.id}`
            );
            return; // Can't get weapon without actor
        }

        // --- Fetch Weapon FROM ACTOR using utility function ---
        const weapon = getWeaponFromActorById(actor, qolFlags.weaponId);
        if (!weapon) {
            return;
        }

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
            ...qolFlags, // Includes deedDieResult and now isPC from flags
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

        // --- Add Event Listeners for QoL Card Buttons ---
        // Determine the correct element to attach listeners to (either the specific .message-content div or the whole html if .message-content wasn't found)
        const cardElement =
            messageContentElement.length > 0 ? messageContentElement : html;

        cardElement
            .find('button[data-action="damage"]')
            .on("click", (event) =>
                handleDamageClick(event, message, actor, weapon, qolFlags)
            );

        cardElement
            .find('button[data-action="crit"]')
            .on("click", (event) =>
                handleCritClick(event, message, actor, weapon, qolFlags)
            );

        cardElement
            .find('button[data-action="fumble"]')
            .on("click", (event) =>
                handleFumbleClick(event, message, actor, weapon, qolFlags)
            );

        cardElement
            .find('button[data-action="friendlyFire"]')
            .on("click", (event) =>
                handleFriendlyFireClick(event, message, actor, qolFlags)
            );
    } catch (err) {
        console.error(
            "DCC QoL | Error enhancing attack roll card:",
            err,
            message.id,
            qolFlags
        );
    }
}
