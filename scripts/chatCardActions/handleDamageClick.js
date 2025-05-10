/* global ui, Roll, ChatMessage */
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

        // --- BEGIN AUTOMATIC DAMAGE APPLICATION ---
        if (game.settings.get("dcc-qol", "automateDamageApply")) {
            if (qolFlags.targettokenId) {
                const targetToken = canvas.tokens.get(qolFlags.targettokenId);
                if (targetToken && targetToken.actor) {
                    const targetActor = targetToken.actor;
                    const damageToApply = roll.total;

                    try {
                        // Should use the DCC system's method to apply damage, but it's currently buggy -- generates a chat message that doesn't display properly
                        // await targetActor.applyDamage(damageToApply, 1); // multiplier of 1 for standard damage
                        // instead, we'll manually update the HP value
                        const currentHp =
                            targetActor.system.attributes.hp.value;
                        // HP can go below 0
                        const newHp = currentHp - damageToApply;

                        await targetActor.update({
                            "system.attributes.hp.value": newHp,
                        });

                        // Show scrolling text on canvas
                        if (canvas.interface) {
                            // Ensure canvas.interface is available
                            canvas.interface.createScrollingText(
                                targetToken.center,
                                damageToApply.toString(),
                                {
                                    anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
                                    fontSize: 28,
                                    fill: "#FF0000", // Red for damage
                                    stroke: "#000000",
                                    strokeThickness: 4,
                                    duration: 3000,
                                }
                            );
                        }

                        // Add applied damage info to flags for the render hook
                        damageMessageFlags["dccqol.appliedDamageValue"] =
                            damageToApply;
                        damageMessageFlags["dccqol.appliedDamageTargetName"] =
                            targetToken.name;
                    } catch (applyError) {
                        console.error(
                            "DCC-QOL | Error applying damage or updating message:",
                            applyError
                        );
                        ui.notifications.error(
                            "DCC QoL: Error applying damage automatically."
                        );
                    }
                } else {
                    console.warn(
                        "DCC-QOL | automateDamageApply: Target token or actor not found for ID:",
                        qolFlags.targettokenId
                    );
                }
            } else {
                console.debug(
                    "DCC-QOL | automateDamageApply: No targettokenId found in qolFlags."
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
