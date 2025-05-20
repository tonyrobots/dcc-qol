/* global canvas, CONST, ui, ChatMessage */

/**
 * Handles the request to apply damage, executed on the GM's client via socketlib.
 *
 * @param {object} payload - The data payload from the client.
 * @param {string} payload.targetTokenId - The ID of the target token.
 * @param {number} payload.damageToApply - The amount of damage to apply.
 * @param {string} payload.attackerActorId - The ID of the actor initiating the attack.
 * @param {string} payload.weaponId - The ID of the weapon used.
 * @param {object} payload.qolFlags - The dccqol flags from the original message.
 * @param {string} payload.originalMessageId - The ID of the original chat message that initiated the damage roll.
 * @param {string} payload.damageRollFormula - The damage roll formula.
 * @param {string} payload.weaponName - The name of the weapon.
 */
export async function gmApplyDamage(payload) {
    const {
        targetTokenId,
        damageToApply,
        attackerActorId,
        // weaponId, // Not directly used in this snippet, but good to have
        qolFlags,
        // originalMessageId, // Not directly used in this snippet
        // damageRollFormula, // Not directly used in this snippet
        weaponName,
    } = payload;

    // console.log("DCC-QOL | gmApplyDamage called with payload:", payload);

    if (!game.user.isGM) {
        console.warn("DCC-QOL | gmApplyDamage called by non-GM. Ignoring.");
        ui.notifications.warn(
            "DCC QoL: Damage application can only be processed by a GM."
        );
        return;
    }

    const targetToken = canvas.tokens.get(targetTokenId);
    if (!targetToken || !targetToken.actor) {
        console.error(
            "DCC-QOL | gmApplyDamage: Target token or actor not found for ID:",
            targetTokenId
        );
        ui.notifications.error(
            "DCC QoL: Target not found for damage application."
        );
        return;
    }

    const targetActor = targetToken.actor;

    try {
        // Attempt to use the system's applyDamage, assuming it might be fixed or for compatibility.
        // If it's still buggy, the manual update is a fallback.
        if (typeof targetActor.applyDamage === "function") {
            await targetActor.applyDamage(damageToApply, 1); // multiplier of 1
        } else {
            console.warn(
                "DCC-QOL | targetActor.applyDamage is not a function. Falling back to manual HP update."
            );
            const currentHp = targetActor.system.attributes.hp.value;
            const newHp = currentHp - damageToApply;
            await targetActor.update({
                "system.attributes.hp.value": newHp,
            });
        }

        // Show scrolling text on canvas
        if (canvas.interface) {
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

        // It might be beneficial to create a new chat message or update the existing one
        // to confirm damage application, especially since this now happens asynchronously on the GM client.
        // For now, we'll rely on the scrolling text and the GM's view.

        // A simple notification to the GM who performed the action.
        ui.notifications.info(
            `DCC QoL: Applied ${damageToApply} damage to ${targetToken.name}.`
        );

        // If we need to update the original message or inform the triggering player,
        // we might need to emit another socket event back or have the GM's client update the message.
        // For now, let's keep it simple. The damage is applied, and scrolling text is shown.

        // Update the damage message with applied damage info
        // This part might be tricky if the original damage message was created by the player.
        // The GM might need to create a new message or update the existing one if permissions allow.
        // Let's assume the GM can update any message or create a new one.

        const attackerActor = game.actors.get(attackerActorId);
        let flavorText = `Applied ${damageToApply} damage from ${
            weaponName || "weapon"
        }`;
        if (qolFlags.target) {
            // qolFlags.target here is the target *name*
            flavorText += ` to ${qolFlags.target}`;
        }

        // The original damage roll message (created by the player) might not yet exist or be finalized
        // when this GM action runs. We need to be careful about updating it.
        // A safer approach might be for the GM to create a *new* confirmation message.

        // For now, the main goal is to apply the damage and show scrolling text.
        // Confirming via chat can be a follow-up improvement if needed.

        // Let's log for now, and consider chat message updates later.
        console.log(
            `DCC-QOL | Successfully applied ${damageToApply} to ${
                targetToken.name
            } by ${attackerActor ? attackerActor.name : "Unknown attacker"}`
        );
    } catch (applyError) {
        console.error("DCC-QOL | Error in gmApplyDamage:", applyError);
        ui.notifications.error(
            "DCC QoL: Error applying damage automatically via GM."
        );
    }
}
