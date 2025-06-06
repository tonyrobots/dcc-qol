/* global ui, Roll, ChatMessage, $ */
import { socket } from "../dcc-qol.js";

/**
 * Handles the click event for the "Roll Fumble" button on the QoL attack card.
 *
 * @param {Event} event - The click event.
 * @param {ChatMessage} message - The chat message document associated with the card.
 * @param {Actor} actor - The actor performing the action.
 * @param {Item} weapon - The weapon item used.
 * @param {object} qolFlags - The dccqol flags from the message.
 */
export async function handleFumbleClick(
    event,
    message,
    actor,
    weapon,
    qolFlags
) {
    event.preventDefault();
    // console.log("DCC-QOL | Fumble button clicked via handleFumbleClick", { messageSystem: message.system, actor, weapon, qolFlags });

    if (!message.system || !message.system.fumbleRollFormula) {
        console.error(
            "DCC-QOL | Fumble roll formula not found in message.system",
            message
        );
        ui.notifications.error(
            "DCC QoL: Fumble roll formula not found in the original message data!"
        );
        return;
    }

    if (!actor) {
        console.error(
            "DCC-QOL | Actor not available for fumble roll processing. Message ID:",
            message.id
        );
        ui.notifications.error(
            "DCC QoL: Actor context not found for fumble roll."
        );
        return;
    }

    try {
        let flavorText = game.i18n.localize("DCC.Fumble"); // Default flavor
        if (message.system.fumbleInlineRoll) {
            try {
                const tempDiv = $("<div>").html(
                    message.system.fumbleInlineRoll
                );
                const anchorTag = tempDiv.find("a.inline-roll");
                if (anchorTag.length && anchorTag.data("flavor")) {
                    flavorText = anchorTag.data("flavor");
                }
            } catch (e) {
                console.warn(
                    "DCC-QOL | Could not parse fumbleInlineRoll for flavor, using default.",
                    e
                );
            }
        }

        const roll = new Roll(
            message.system.fumbleRollFormula,
            actor.getRollData()
        );
        await roll.evaluate();

        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorText,
            flags: {
                "dcc.RollType": "Fumble", // System flag for fumble rolls
                "dccqol.isFumbleRoll": true,
                "dccqol.parentId": message.id,
                "dccqol.actorId": actor.id,
                "dccqol.weaponId": weapon?.id || qolFlags.weaponId,
                // If a fumble table name becomes available in message.system, add it here
                // "dccqol.fumbleTableName": message.system.fumbleTableName,
            },
        });

        // Update the original message to mark that fumble button was clicked
        // This will cause all clients to re-render with the button disabled
        // Use socket to have GM update the flags since players can't modify message flags
        try {
            await socket.executeAsGM("gmUpdateMessageFlags", {
                messageId: message.id,
                flagScope: "dcc-qol",
                flags: {
                    fumbleButtonClicked: true,
                },
            });
        } catch (flagError) {
            console.warn(
                "DCC-QOL | Could not update fumble button clicked flag:",
                flagError
            );
            // Don't throw here - the fumble roll was successful even if flag update failed
        }
    } catch (rollError) {
        console.error("DCC-QOL | Error performing fumble roll:", rollError, {
            formula: message.system.fumbleRollFormula,
            actorData: actor.getRollData(),
        });
        ui.notifications.error(
            `DCC QoL: Error performing fumble roll - ${rollError.message}`
        );
    }
}
