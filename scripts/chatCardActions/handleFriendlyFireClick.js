/* global ui, Roll, ChatMessage, game, renderTemplate */
/**
 * Handles the click event for the "Friendly Fire Check" button on the QoL attack card.
 * Performs a d100 friendly fire check, and if it fails (<=50), automatically makes a
 * simplified attack roll against a randomly selected friendly target, showing the result
 * inline with a damage button if it hits.
 *
 * @param {Event} event - The click event.
 * @param {ChatMessage} message - The chat message document associated with the card.
 * @param {Actor} actor - The actor performing the action (the one who might have friendly fired).
 * @param {object} qolFlags - The dccqol flags from the message.
 */
export async function handleFriendlyFireClick(event, message, actor, qolFlags) {
    event.preventDefault();
    console.debug(
        "DCC-QOL | Friendly Fire button clicked via handleFriendlyFireClick",
        { actor, qolFlags }
    );

    if (!actor) {
        console.error(
            "DCC-QOL | Actor not available for friendly fire check. Message ID:",
            message.id
        );
        ui.notifications.error(
            "DCC QoL: Actor context not found for friendly fire check."
        );
        return;
    }

    // Validate that we have friendly tokens to potentially target
    const friendliesInMelee = qolFlags.friendliesInMelee || [];
    if (!Array.isArray(friendliesInMelee) || friendliesInMelee.length === 0) {
        console.error(
            "DCC-QOL | No friendly tokens found in melee for friendly fire check"
        );
        ui.notifications.error(
            "DCC QoL: No friendly targets available for friendly fire."
        );
        return;
    }

    // Get weapon for attack calculations
    const weapon = actor.items.get(qolFlags.weaponId);
    if (!weapon) {
        console.error("DCC-QOL | Weapon not found for friendly fire attack");
        ui.notifications.error(
            "DCC QoL: Weapon not found for friendly fire check."
        );
        return;
    }

    try {
        // Step 1: Roll d100 to determine if friendly fire occurs
        const d100Roll = new Roll("1d100", actor.getRollData());
        await d100Roll.evaluate();

        const d100HTML = await d100Roll.render();
        let friendlyFireOccurs = d100Roll.total <= 50;

        if (!friendlyFireOccurs) {
            // Success - missed everyone, use simple message
            const resultText = game.i18n.localize(
                "DCC-QOL.FriendlyFireSuccess"
            );
            const finalContent = `<div class="dccqol-friendlyfire-result status-success">${
                d100Roll.toAnchor().outerHTML
            } - ${resultText}</div>`;

            d100Roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
                content: finalContent,
                flags: {
                    dccqol: {
                        isFriendlyFireCheck: true,
                        parentId: message.id,
                        actorId: actor.id,
                    },
                },
            });
            return;
        }

        // Step 2: Friendly fire occurs - select random friendly target
        const randomIndex = Math.floor(
            Math.random() * friendliesInMelee.length
        );
        const selectedFriendlyData = friendliesInMelee[randomIndex];

        // Validate the selected token still exists on the canvas
        const friendlyTokenPlaceable = game.canvas.tokens.get(
            selectedFriendlyData.id
        );
        if (!friendlyTokenPlaceable) {
            console.error(
                `DCC-QOL | Selected friendly token ${selectedFriendlyData.id} no longer exists on canvas`
            );
            ui.notifications.error(
                "DCC QoL: Selected friendly target is no longer available."
            );
            return;
        }

        // Get the TokenDocument and Actor from the placeable
        const selectedFriendlyTokenDoc = friendlyTokenPlaceable.document;
        const friendlyActor = selectedFriendlyTokenDoc.actor;

        if (!friendlyActor) {
            console.error(
                `DCC-QOL | No actor found for friendly token ${selectedFriendlyData.id}`
            );
            ui.notifications.error(
                "DCC QoL: Friendly target has no associated actor."
            );
            return;
        }

        // Step 3: Make attack roll against the friendly target
        const attackRollResult = await _makeFriendlyFireAttackRoll(
            actor,
            weapon,
            friendlyActor
        );

        // Step 4: Prepare template data and render using the template
        const templateData = await _prepareFriendlyFireTemplateData(
            d100Roll,
            selectedFriendlyData.name,
            attackRollResult,
            actor,
            weapon,
            friendlyActor,
            qolFlags
        );

        // Step 5: Render the friendly fire card using the template
        const friendlyFireContent = await renderTemplate(
            "modules/dcc-qol/templates/friendly-fire-card.html",
            templateData
        );

        // Step 6: Create the message data structure
        const messageData = {
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
            content: friendlyFireContent,
            // Add system data that handleDamageClick expects
            system: {
                actorId: actor.id,
                weaponId: weapon.id,
                weaponName: weapon.name,
                damageRollFormula: weapon.system.damage || "1d4",
            },
            flags: {
                dccqol: {
                    isFriendlyFireCheck: true,
                    parentId: message.id,
                    actorId: actor.id,
                    weaponId: weapon.id,
                    selectedFriendlyTarget: selectedFriendlyData.id,
                    friendlyFireHit: attackRollResult.hit,
                    targetActorId: friendlyActor.id,
                    targetTokenId: selectedFriendlyData.id,
                    target: selectedFriendlyData.name, // For handleDamageClick
                },
            },
        };

        // Send the friendly fire message
        await d100Roll.toMessage(messageData);

        console.debug(
            "DCC-QOL | Friendly fire check completed. If attack hit, damage button will use standard damage handling."
        );
    } catch (rollError) {
        console.error(
            "DCC-QOL | Error performing friendly fire roll:",
            rollError
        );
        ui.notifications.error(
            `DCC QoL: Error performing friendly fire roll - ${rollError.message}`
        );
    }
}

/**
 * Makes a simplified attack roll against a friendly target
 * @param {Actor} attacker - The attacking actor
 * @param {Item} weapon - The weapon being used
 * @param {Actor} target - The friendly target actor
 * @returns {Promise<object>} Object with hit status, attack roll, and target AC
 * @private
 */
async function _makeFriendlyFireAttackRoll(attacker, weapon, target) {
    // Get proper attack bonus from the weapon's toHit formula (which includes @ab replacements)
    const rawToHit = weapon.system?.toHit || "+0";
    const attackBonus = rawToHit.replaceAll(
        "@ab",
        attacker.system.details.attackBonus
    );

    // Get target AC
    const targetAC = target.system?.attributes?.ac?.value || 10;

    // Make attack roll (d20 + attack bonus)
    // We use a simplified attack roll without action dice complications for friendly fire
    const attackFormula = `1d20 + ${attackBonus}`;
    const attackRoll = new Roll(attackFormula, attacker.getRollData());
    await attackRoll.evaluate();

    const hit = attackRoll.total >= targetAC;

    return {
        hit: hit,
        attackRoll: attackRoll,
        attackTotal: attackRoll.total,
        targetAC: targetAC,
        attackBonus: attackBonus,
    };
}

/**
 * Prepares template data for the friendly fire card template
 * @param {Roll} d100Roll - The rolled d100 object
 * @param {string} targetName - Name of the friendly target
 * @param {object} attackResult - Result of the attack roll
 * @param {Actor} attacker - The attacking actor
 * @param {Item} weapon - The weapon used
 * @param {Actor} target - The target actor
 * @param {object} qolFlags - Original QoL flags
 * @returns {Promise<object>} The template data object
 * @private
 */
async function _prepareFriendlyFireTemplateData(
    d100Roll,
    targetName,
    attackResult,
    attacker,
    weapon,
    target,
    qolFlags
) {
    const attackRollHTML = await attackResult.attackRoll.render();

    // Prepare text content for hit/miss
    let hitText = "";
    let missText = "";

    if (attackResult.hit) {
        hitText = game.i18n.format("DCC-QOL.FriendlyFireAttackHits", {
            total: attackResult.attackTotal,
            ac: attackResult.targetAC,
            targetName: targetName,
        });
    } else {
        missText = game.i18n.format("DCC-QOL.FriendlyFireAttackMisses", {
            total: attackResult.attackTotal,
            ac: attackResult.targetAC,
            targetName: targetName,
        });
    }

    // Get weapon properties (reusing existing utility)
    const { getWeaponProperties } = await import("../utils.js");
    const properties = await getWeaponProperties(
        weapon,
        qolFlags.options || {}
    );

    return {
        actor: attacker,
        weapon: weapon,
        target: targetName,
        targetTokenId: qolFlags.targetTokenId,
        tokenId: qolFlags.tokenId,
        d100Roll: d100Roll,
        d100RollHTML: d100Roll.toAnchor().outerHTML,
        attackRollHTML: attackRollHTML,
        hit: attackResult.hit,
        hitText: hitText,
        missText: missText,
        struckAllyText: game.i18n.format("DCC-QOL.FriendlyFireFailWithTarget", {
            originalTarget: qolFlags.target || "the intended target",
            targetName: targetName,
        }),
        properties: properties,
        // Add permission checking per-client (same as attack cards)
        canUserModify: attacker.canUserModify(game.user, "update"),
        isGM: game.user.isGM,
        damageButtonClicked: false, // Always false for new friendly fire cards
        damageTotal: null, // No damage rolled yet
    };
}
