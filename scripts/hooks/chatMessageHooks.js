/**
 * Handles Foundry VTT hooks related to chat message rendering and interaction.
 * This typically involves modifying the HTML of a chat message before it's displayed
 * or attaching event listeners to elements within a rendered chat message.
 */
/* global game, renderTemplate, $, canvas, Hooks */
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
    if (!qolFlags) {
        return;
    }
    // Handle QoL Attack Card enhancement
    if (
        qolFlags.isAttackRoll &&
        game.settings.get("dcc-qol", "useQoLAttackCard")
    ) {
        try {
            // --- Fetch Actor (Simplified) ---
            let actor;
            const speaker = message.speaker;
            const actorIdForContext = qolFlags?.actorId; // For logging if needed

            // Try to get actor from the token speaker first
            if (speaker.token && speaker.scene) {
                const tokenDocument = game.scenes
                    .get(speaker.scene)
                    ?.tokens.get(speaker.token);
                if (tokenDocument) {
                    actor = tokenDocument.actor;
                }
            }

            // If no actor from token speaker, fallback to general speaker actor resolution
            if (!actor) {
                actor = message.getSpeakerActor();
            }

            // Final check if an actor was determined
            if (!actor) {
                console.warn(
                    `DCC-QOL | Actor could not be determined for message ${message.id}. Speaker details - Token: ${speaker.token}, Scene: ${speaker.scene}, Actor: ${speaker.actor}. Associated qolFlags.actorId: ${actorIdForContext}`
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
                originalContent.find(".dice-roll").first()?.prop("outerHTML") ||
                "";

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

            // --- Apply Dice Roll Status Coloring for Hits/Misses/Crits/Fumbles ---
            const diceTotalElement = cardElement.find(".dice-roll .dice-total");
            if (diceTotalElement.length > 0) {
                if (qolFlags.isCrit) {
                    diceTotalElement.addClass("critical");
                } else if (qolFlags.isFumble) {
                    diceTotalElement.addClass("fumble");
                } else if (qolFlags.target) {
                    // Only apply hit/miss if it's a targeted roll and not a crit/fumble
                    if (qolFlags.hitsTarget) {
                        diceTotalElement.addClass("status-success");
                    } else {
                        diceTotalElement.addClass("status-failure");
                    }
                }
            }
            // Note: .critical and .fumble classes are expected to be added by Foundry's core roll rendering
            // or by the diceHTML content itself if it comes from a Roll object that was evaluated.
            // Our CSS handles .dccqol.chat-card .dice-roll .dice-total.critical and .fumble directly.
        } catch (err) {
            console.error(
                "DCC QoL | Error enhancing attack roll card:",
                err,
                message.id,
                qolFlags
            );
        }
    } // End of Attack Roll specific enhancements

    // Handle Appending "Applied Damage" info to QoL Damage Rolls
    // This section was moved to damageApplicationHooks.js
}

/**
 * Adds a specific CSS class to non-QoL chat messages if the 'useQoLAttackCard' setting is enabled.
 * This allows for applying a consistent base font style to system messages.
 * @param {ChatMessage} message - The ChatMessage document.
 * @param {jQuery} html - The jQuery object for the message's HTML.
 * @param {object} data - Additional data related to the message.
 */
export const styleSystemChatCard = (message, html, data) => {
    if (game.settings.get("dcc-qol", "useQoLAttackCard")) {
        // html is the jQuery object for the outer .chat-message element.
        // QoL cards have .dccqol.chat-card class usually on a direct child of .message-content or similar.
        // We check if such a card exists within the current message's HTML.
        const qolCard = html.find(".dccqol.chat-card");

        if (qolCard.length === 0) {
            // If no .dccqol.chat-card is found, it's not a QoL card,
            // so we add our class to the main message element for font styling.
            html.addClass("dccqol-system-card-font");
        }
    }
};
