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

    try {
        // --- Fetch Actor ---
        let actor;
        const speaker = message.speaker;
        const actorIdFromFlags = qolFlags.actorId;

        if (speaker.token && speaker.scene) {
            const scene = game.scenes.get(speaker.scene);
            if (scene) {
                const tokenDocument = scene.tokens.get(speaker.token);
                if (tokenDocument) {
                    actor = tokenDocument.actor;
                }
            }
        }

        // If actor wasn't found via token, or if the message wasn't from a token,
        // fall back to using the actorId from qolFlags.
        if (!actor && actorIdFromFlags) {
            actor = game.actors.get(actorIdFromFlags);
            if (!actor) {
                console.warn(
                    `DCC-QOL | Actor not found for ID: ${actorIdFromFlags} (fallback). Message ID: ${message.id}`
                );
            }
        }

        // Final check if an actor was determined
        if (!actor) {
            console.warn(
                `DCC-QOL | Actor could not be determined. Speaker Token: ${speaker.token}, Speaker Scene: ${speaker.scene}, Flagged Actor ID: ${actorIdFromFlags}. Message ID: ${message.id}`
            );
            return; // Can't get weapon without actor
        }

        // --- Fetch Weapon FROM ACTOR ---
        const weapon = actor.items.get(qolFlags.weaponId);
        if (!weapon) {
            // --- Debug: Log the actor and the weapon ID we tried ---
            console.warn(
                `DCC-QOL | Weapon not found on Actor ${actor.name} (ID: ${actor.id}) with Weapon ID: ${qolFlags.weaponId} | Message ID: ${message.id}`
            );
            return; // Stop if weapon not found on the actor
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
            .on("click", async (event) => {
                event.preventDefault();
                // console.log("DCC-QOL | Damage button clicked", { messageSystem: message.system, actor, weapon, qolFlags });

                if (!message.system || !message.system.damageRollFormula) {
                    console.error(
                        "DCC-QOL | Damage roll formula not found in message.system",
                        message
                    );
                    ui.notifications.error(
                        "DCC QoL: Damage roll formula not found in the original message data!"
                    );
                    return;
                }

                // Ensure actor is available (it should be from the outer function's scope)
                if (!actor) {
                    console.error(
                        "DCC-QOL | Actor not available for damage roll processing. Message ID:",
                        message.id
                    );
                    ui.notifications.error(
                        "DCC QoL: Actor context not found for damage roll."
                    );
                    return;
                }

                try {
                    // Use actor.getRollData() to allow for @attributes in the formula from the actor's sheet
                    const roll = new Roll(
                        message.system.damageRollFormula,
                        actor.getRollData()
                    );
                    await roll.evaluate({ async: true });

                    // Construct flavor text for the damage roll
                    // We'll need to add these localization strings to language/en.json later
                    // For now, using placeholders or direct English strings.
                    let flavorText = `Rolling Damage for ${
                        message.system.weaponName || weapon?.name || "weapon"
                    }`;
                    if (qolFlags.target) {
                        flavorText += ` against ${qolFlags.target}`;
                    }
                    // A more robust localization approach:
                    // let weaponNameForFlavor = message.system.weaponName || weapon?.name || game.i18n.localize("DCC-QOL.UnknownWeapon");
                    // let flavor = game.i18n.format("DCC-QOL.RollsDamageWith", { weaponName: weaponNameForFlavor });
                    // if (qolFlags.target) {
                    //     flavor += " " + game.i18n.format("DCC-QOL.AgainstTarget", { targetName: qolFlags.target });
                    // }

                    roll.toMessage({
                        speaker: ChatMessage.getSpeaker({ actor: actor }),
                        flavor: flavorText, // Replace with localized version later
                        flags: {
                            "dcc.RollType": "Damage", // Standard DCC system flag for damage type
                            "dccqol.isDamageRoll": true,
                            "dccqol.parentId": message.id, // Link back to the original attack card message
                            "dccqol.actorId": actor.id,
                            "dccqol.weaponId": weapon?.id || qolFlags.weaponId,
                        },
                    });
                } catch (rollError) {
                    console.error(
                        "DCC-QOL | Error performing damage roll:",
                        rollError,
                        {
                            formula: message.system.damageRollFormula,
                            actorData: actor.getRollData(),
                        }
                    );
                    ui.notifications.error(
                        `DCC QoL: Error performing damage roll - ${rollError.message}`
                    );
                }
            });

        // Placeholder for other button listeners (fumble, crit, friendly fire)
        // cardElement.find('button[data-action="fumble"]').on('click', async (event) => { /* ... handler ... */ });
        // cardElement.find('button[data-action="crit"]').on('click', async (event) => { /* ... handler ... */ });
        // cardElement.find('button[data-action="friendlyFire"]').on('click', async (event) => { /* ... handler ... */ });
    } catch (err) {
        console.error(
            "DCC QoL | Error enhancing attack roll card:",
            err,
            message.id,
            qolFlags
        );
    }
}
