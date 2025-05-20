/* global ui, Roll, ChatMessage, game, canvas, CONST */
import { socket } from "../dcc-qol.js";

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

        // --- Prepare flags for the damage roll message ---
        // The dccqol.appliedDamageValue and dccqol.appliedDamageTargetName flags are removed
        // as the GM-side handler is responsible for the feedback of actual damage application.
        // The original message flags are primarily for the roll itself.
        const damageMessageFlags = {
            "dcc.RollType": "Damage",
            "dccqol.isDamageRoll": true,
            "dccqol.parentId": message.id,
            "dccqol.actorId": actor.id,
            "dccqol.weaponId": weapon?.id || qolFlags.weaponId,
        };

        // Create the damage roll chat message with all necessary flags
        const chatMessage = await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorText,
            flags: damageMessageFlags,
        });

        // --- BEGIN AUTOMATIC DAMAGE APPLICATION ---
        if (
            game.settings.get("dcc-qol", "automateDamageApply") &&
            qolFlags.targettokenId
        ) {
            const damageToApply = roll.total;
            const payload = {
                targetTokenId: qolFlags.targettokenId,
                damageToApply: damageToApply,
            };

            // Function to actually apply the damage via GM
            const applyDamage = () => {
                socket
                    .executeAsGM("gmApplyDamage", payload)
                    .catch((err) =>
                        console.error("DCC-QOL | Error applying damage:", err)
                    );
            };

            // Check if Dice So Nice is active and wait for its animation if so
            if (game.modules.get("dice-so-nice")?.active) {
                // Use the Dice So Nice completion hook to apply damage when dice finish rolling
                Hooks.once("diceSoNiceRollComplete", (messageId) => {
                    // Only trigger for our specific damage roll message
                    if (messageId === chatMessage.id) {
                        applyDamage();
                    }
                });
            } else {
                // Fallback: small delay to ensure chat message is processed
                setTimeout(applyDamage, 300);
            }
        }
        // --- END AUTOMATIC DAMAGE APPLICATION ---
    } catch (rollError) {
        console.error("DCC-QOL | Error performing damage roll:", rollError);
        ui.notifications.error(
            `DCC QoL: Error performing damage roll - ${rollError.message}`
        );
    }
}
