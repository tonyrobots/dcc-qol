/* global ui, Roll, ChatMessage, game, canvas, CONST */
import { socket } from "../../dcc-qol.js";

/**
 * Handles the click event for the "Roll Damage" button on the QoL attack card.
 *
 * @param {Event} event - The click event.
 * @param {ChatMessage} message - The chat message document associated with the card.
 * @param {Actor} actor - The actor performing the action.
 * @param {Item} weapon - The weapon item used.
 * @param {object} qolFlags - The dccqol flags from the message.
 */
export async function handleDamageClick(
    event,
    message,
    actor,
    weapon,
    qolFlags
) {
    event.preventDefault();
    // console.log("DCC-QOL | Damage button clicked via handleDamageClick", { messageSystem: message.system, actor, weapon, qolFlags });

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

    // Ensure actor is available
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

        // --- Prepare flags for the damage roll message, including applied damage info if successful ---
        const damageMessageFlags = {
            "dcc.RollType": "Damage",
            "dccqol.isDamageRoll": true,
            "dccqol.parentId": message.id,
            "dccqol.actorId": actor.id,
            "dccqol.weaponId": weapon?.id || qolFlags.weaponId,
        };

        // --- BEGIN AUTOMATIC DAMAGE APPLICATION (via Socket to GM) ---
        if (game.settings.get("dcc-qol", "automateDamageApply")) {
            if (qolFlags.targettokenId) {
                const damageToApply = roll.total;
                const payload = {
                    targetTokenId: qolFlags.targettokenId,
                    damageToApply: damageToApply,
                    attackerActorId: actor.id,
                    weaponId: weapon?.id || qolFlags.weaponId,
                    qolFlags: qolFlags,
                    originalMessageId: message.id,
                    damageRollFormula: message.system.damageRollFormula,
                    weaponName:
                        message.system.weaponName ||
                        weapon?.name ||
                        "Unknown Weapon",
                };

                try {
                    // console.log("DCC-QOL | Requesting GM to apply damage with payload:", payload);
                    await socket.executeAsGM("gmApplyDamage", payload);
                    // Notification that the request was sent. Actual application feedback will come from GM side (e.g., scrolling text)
                    // ui.notifications.info("DCC QoL: Damage application request sent to GM.");

                    // The flags for applied damage are removed here as the GM handles the actual application
                    // and confirmation. If the chat card needs to be updated by the player's client
                    // after GM confirmation, that would require a more complex return value or a separate socket event.
                } catch (socketError) {
                    console.error(
                        "DCC-QOL | Error sending damage application request to GM:",
                        socketError
                    );
                    ui.notifications.error(
                        "DCC QoL: Error communicating with GM to apply damage."
                    );
                }
            } else {
                console.debug(
                    "DCC-QOL | automateDamageApply: No targettokenId found in qolFlags. Cannot send to GM."
                );
            }
        }
        // --- END AUTOMATIC DAMAGE APPLICATION ---

        // Create the damage roll chat message with all necessary flags
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorText, // Existing flavor text
            flags: damageMessageFlags, // Pass all accumulated flags
        });
    } catch (rollError) {
        console.error("DCC-QOL | Error performing damage roll:", rollError, {
            formula: message.system.damageRollFormula,
            actorData: actor.getRollData(),
        });
        ui.notifications.error(
            `DCC QoL: Error performing damage roll - ${rollError.message}`
        );
    }
}
