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
import { socket } from "../dcc-qol.js"; // Import the socket

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
    // If no qolFlags, or if it's not an attack roll and not a damage roll with applied damage, do nothing for this specific QoL handling.
    // Other general message rendering will still occur.
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

            // --- BEGIN AUTOMATIC DAMAGE APPLICATION IF DAMAGE WAS AUTOMATED BY DCC SYSTEM ---
            if (
                qolFlags.damageWasAutomated &&
                qolFlags.automatedDamageTotal !== undefined && // Ensure we have a damage total
                game.settings.get("dcc-qol", "automateDamageApply") &&
                qolFlags.targettokenId &&
                qolFlags.hitsTarget // Only apply if the attack actually hit a target
            ) {
                const damageToApply = qolFlags.automatedDamageTotal;
                const targetTokenDocument = canvas.scene.tokens.get(
                    qolFlags.targettokenId
                );
                const targetNameForDisplay =
                    targetTokenDocument?.name || qolFlags.target || "target";

                const payload = {
                    targetTokenId: qolFlags.targettokenId,
                    damageToApply: damageToApply,
                    // Optionally, pass the original attack message ID for context or feedback
                    originalAttackMessageId: message.id,
                };

                // Function to actually apply the damage via GM
                const applyAutomatedDamage = () => {
                    console.log(
                        `DCC-QOL | applyAutomatedDamage: Attempting to apply ${damageToApply} to ${qolFlags.targettokenId}. Message ID: ${message.id}, QoL Flags:`,
                        JSON.parse(JSON.stringify(qolFlags))
                    );
                    socket // Assuming 'socket' is defined/imported in this file scope
                        .executeAsGM("gmApplyDamage", payload)
                        .catch((err) =>
                            console.error(
                                "DCC-QOL | Error applying automated system damage:",
                                err
                            )
                        );
                };

                // If Dice So Nice is active, wait for its animation to complete for the original message
                // before applying damage.
                if (game.modules.get("dice-so-nice")?.active) {
                    if (!message._dccQolDsnDamageApplied) {
                        // Check our custom flag
                        Hooks.once(
                            "diceSoNiceRollComplete",
                            (completedMessageId) => {
                                // Ensure we only act if the completed roll is for our message and the flag hasn't been set by a concurrent execution
                                if (
                                    completedMessageId === message.id &&
                                    !message._dccQolDsnDamageApplied
                                ) {
                                    message._dccQolDsnDamageApplied = true; // Set flag immediately
                                    console.log(
                                        `DCC-QOL | DSN Hook for applyAutomatedDamage. Message ID: ${message.id}, Completed ID: ${completedMessageId}`
                                    );
                                    applyAutomatedDamage();
                                }
                            }
                        );
                    }
                } else {
                    // If DSN is not active, apply with a small delay.
                    // Check a different flag for this path to prevent multiple executions if renderChatMessage fires rapidly.
                    if (!message._dccQolTimeoutDamageApplied) {
                        message._dccQolTimeoutDamageApplied = true; // Set flag immediately
                        console.log(
                            `DCC-QOL | setTimeout for applyAutomatedDamage. Message ID: ${message.id}`
                        );
                        setTimeout(applyAutomatedDamage, 100);
                    }
                }
            }
            // --- END AUTOMATIC DAMAGE APPLICATION IF DAMAGE WAS AUTOMATED BY DCC SYSTEM ---
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
    if (
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
