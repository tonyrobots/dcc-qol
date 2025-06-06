/* global ui, Roll, ChatMessage, game, renderTemplate */
import { socket } from "../dcc-qol.js";

/**
 * Handles the click event for the "Friendly Fire Check" button on the QoL attack card.
 * Performs a d100 friendly fire check. Regardless of outcome (hit ally or miss all),
 * it uses the friendly-fire-card.html template to display the result.
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

    const friendliesInMelee = qolFlags.friendliesInMelee || [];
    if (!Array.isArray(friendliesInMelee) || friendliesInMelee.length === 0) {
        console.error(
            "DCC-QOL | No friendly tokens found in melee for friendly fire check"
        );
        // Still proceed to roll, but the outcome will always be "missed everyone"
        // as there are no valid targets for actual friendly fire.
        // The template will handle this gracefully if no target is selected.
    }

    const weapon = actor.items.get(qolFlags.weaponId);
    if (
        !weapon &&
        Array.isArray(friendliesInMelee) &&
        friendliesInMelee.length > 0
    ) {
        // Weapon is only strictly necessary if there are friendlies to potentially hit.
        // If no friendlies, we can proceed to the "missed everyone" outcome without a weapon.
        console.error("DCC-QOL | Weapon not found for friendly fire attack");
        ui.notifications.error(
            "DCC QoL: Weapon not found for friendly fire check."
        );
        return;
    }

    try {
        const d100Roll = new Roll("1d100", actor.getRollData());
        await d100Roll.evaluate();

        const friendlyFireAttemptOccurs = d100Roll.total <= 50;
        let noFriendlyFireActuallyOccurred = true; // True if d100 > 50 OR no valid targets/weapon
        let templateData;
        let messageSystemData = {}; // For damage button related data
        let messageFlags = {}; // For qol flags specific to this FF event

        // Store the d100 roll HTML for reliable re-rendering
        const d100RollHTML = d100Roll.toAnchor().outerHTML;

        if (
            friendlyFireAttemptOccurs &&
            weapon &&
            friendliesInMelee.length > 0
        ) {
            // Friendly fire roll failed (<=50), and there are potential targets and a weapon
            noFriendlyFireActuallyOccurred = false;

            const randomIndex = Math.floor(
                Math.random() * friendliesInMelee.length
            );
            const selectedFriendlyData = friendliesInMelee[randomIndex];
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
                // Fallback to "missed everyone" scenario by setting noFriendlyFireActuallyOccurred to true
                noFriendlyFireActuallyOccurred = true;
                templateData = await _prepareFriendlyFireTemplateData({
                    d100Roll,
                    attacker: actor,
                    qolFlags,
                    noFriendlyFireOccurred: true,
                });
            } else {
                const selectedFriendlyTokenDoc =
                    friendlyTokenPlaceable.document;
                const friendlyActor = selectedFriendlyTokenDoc.actor;

                if (!friendlyActor) {
                    console.error(
                        `DCC-QOL | No actor found for friendly token ${selectedFriendlyData.id}`
                    );
                    ui.notifications.error(
                        "DCC QoL: Friendly target has no associated actor."
                    );
                    noFriendlyFireActuallyOccurred = true; // Fallback
                    templateData = await _prepareFriendlyFireTemplateData({
                        d100Roll,
                        attacker: actor,
                        qolFlags,
                        noFriendlyFireOccurred: true,
                    });
                } else {
                    const attackRollResult = await _makeFriendlyFireAttackRoll(
                        actor,
                        weapon,
                        friendlyActor
                    );
                    // Show DSN for the attack roll
                    // if (
                    //     game.dice3d &&
                    //     attackRollResult &&
                    //     attackRollResult.attackRoll
                    // ) {
                    //     await game.dice3d.showForRoll(
                    //         attackRollResult.attackRoll
                    //     );
                    // }

                    templateData = await _prepareFriendlyFireTemplateData({
                        d100Roll,
                        attacker: actor,
                        qolFlags,
                        noFriendlyFireOccurred: false,
                        targetName: selectedFriendlyData.name,
                        attackResult: attackRollResult,
                        weapon,
                        targetActor: friendlyActor,
                        selectedFriendlyTokenDocId: selectedFriendlyData.id,
                    });

                    // Prepare system data and flags for when FF occurs and might hit
                    messageSystemData = {
                        actorId: actor.id,
                        weaponId: weapon.id,
                        weaponName: weapon.name,
                        damageRollFormula: weapon.system.damage || "1d4",
                    };
                    messageFlags = {
                        selectedFriendlyTarget: selectedFriendlyData.id,
                        friendlyFireHit: attackRollResult.hit,
                        targetActorId: friendlyActor.id,
                        targetTokenId: selectedFriendlyData.id,
                        target: selectedFriendlyData.name,
                        weaponId: weapon.id,
                        // Store attack roll HTML for re-rendering
                        attackRollHTML:
                            await attackRollResult.attackRoll.render(),
                    };
                }
            }
        } else {
            // Friendly fire roll succeeded (d100 > 50), or no weapon/targets for FF
            noFriendlyFireActuallyOccurred = true;
            templateData = await _prepareFriendlyFireTemplateData({
                d100Roll,
                attacker: actor,
                qolFlags,
                noFriendlyFireOccurred: true,
                weapon, // Pass weapon if available, might be used for properties footer
            });
            // If weapon is available, try to get properties for the footer
            // This was implicitly handled by _prepareFriendlyFireTemplateData if weapon was null there.
            // Let's ensure `properties` is populated in templateData if weapon exists.
            if (weapon && templateData) {
                // templateData should exist here
                const { getWeaponProperties } = await import("../utils.js");
                templateData.properties = await getWeaponProperties(
                    weapon,
                    qolFlags.options || {}
                );
            }
        }

        const friendlyFireContent = await renderTemplate(
            "modules/dcc-qol/templates/friendly-fire-card.html",
            templateData
        );

        const finalMessageData = {
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
            content: friendlyFireContent,
            system: noFriendlyFireActuallyOccurred ? {} : messageSystemData,
            flags: {
                dccqol: {
                    isFriendlyFireCheck: true,
                    parentId: message.id,
                    actorId: actor.id,
                    weaponId: weapon?.id || null,
                    tokenId: qolFlags.tokenId,
                    target: templateData.target || null,
                    targetTokenId: templateData.targetTokenId || null,
                    noFriendlyFireActuallyOccurred:
                        noFriendlyFireActuallyOccurred,
                    // Store text content for re-rendering
                    hitText: templateData.hitText || "",
                    missText: templateData.missText || "",
                    struckAllyText: templateData.struckAllyText || "",
                    friendlyFireSafeText:
                        templateData.friendlyFireSafeText || "",
                    // Store roll HTML for reliable re-rendering
                    d100RollHTML: d100RollHTML,
                    options: qolFlags.options || {},
                    ...messageFlags, // Spread flags for FF hit scenario
                },
            },
        };

        await ChatMessage.create(finalMessageData);
        // d100Roll.toMessage(finalMessageData); // Using ChatMessage.create for consistency

        // Update the original message to mark that friendly fire button was clicked
        // This will cause all clients to re-render with the button disabled
        // Use socket to have GM update the flags since players can't modify message flags
        try {
            await socket.executeAsGM("gmUpdateMessageFlags", {
                messageId: message.id,
                flagScope: "dcc-qol",
                flags: {
                    friendlyFireButtonClicked: true,
                },
            });
        } catch (flagError) {
            console.warn(
                "DCC-QOL | Could not update friendly fire button clicked flag:",
                flagError
            );
            // Don't throw here - the friendly fire check was successful even if flag update failed
        }

        console.debug(
            "DCC-QOL | Friendly fire check completed using unified template."
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
 * @param {object} options - The options object containing all necessary data
 * @param {Roll} options.d100Roll - The rolled d100 object
 * @param {Actor} options.attacker - The attacking actor
 * @param {object} options.qolFlags - Original QoL flags from the message
 * @param {boolean} options.noFriendlyFireOccurred - True if the d100 roll means no FF
 * @param {string} [options.targetName] - Name of the friendly target (if FF occurred)
 * @param {object} [options.attackResult] - Result of the attack roll (if FF occurred)
 * @param {Item} [options.weapon] - The weapon used (if FF occurred, otherwise null)
 * @param {Actor} [options.targetActor] - The target actor (if FF occurred)
 * @param {string} [options.selectedFriendlyTokenDocId] - Token document ID of the friendly target (if FF occurred)
 * @returns {Promise<object>} The template data object
 * @private
 */
async function _prepareFriendlyFireTemplateData(options) {
    const {
        d100Roll,
        attacker,
        qolFlags,
        noFriendlyFireOccurred,
        targetName,
        attackResult,
        weapon,
        targetActor,
        selectedFriendlyTokenDocId,
    } = options;

    const d100RollHTML = d100Roll.toAnchor().outerHTML;

    let templateData = {
        actor: attacker,
        tokenId: qolFlags.tokenId, // Attacker's token ID
        d100Roll: d100Roll,
        d100RollHTML: d100RollHTML,
        noFriendlyFireOccurred: noFriendlyFireOccurred,
        canUserModify: attacker.canUserModify(game.user, "update"),
        isGM: game.user.isGM,
        damageButtonClicked: false, // Always false for new cards
        damageTotal: null, // No damage rolled yet
        // Initialize fields that are conditional
        weapon: null,
        target: null, // Name of the target hit
        targetTokenId: null, // Token ID of the target hit
        attackRollHTML: null,
        hit: false,
        hitText: "",
        missText: "",
        struckAllyText: "",
        friendlyFireSafeText: "",
        properties: [],
    };

    if (noFriendlyFireOccurred) {
        templateData.friendlyFireSafeText = game.i18n.localize(
            "DCC-QOL.FriendlyFireSuccess"
        );
        // weapon, target, targetTokenId, attack details, properties remain null/empty
    } else {
        // Friendly fire occurred, populate all relevant fields
        const attackRollHTML = await attackResult.attackRoll.render();
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

        const { getWeaponProperties } = await import("../utils.js");
        const properties = await getWeaponProperties(
            weapon,
            qolFlags.options || {}
        );

        templateData.weapon = weapon;
        templateData.target = targetName; // Friendly target's name
        templateData.targetTokenId = selectedFriendlyTokenDocId; // Friendly target's token document ID
        templateData.attackRollHTML = attackRollHTML;
        templateData.hit = attackResult.hit;
        templateData.hitText = hitText;
        templateData.missText = missText;
        templateData.struckAllyText = game.i18n.format(
            "DCC-QOL.FriendlyFireFailWithTarget",
            {
                originalTarget: qolFlags.target || "the intended target",
                targetName: targetName,
            }
        );
        templateData.properties = properties;
    }

    return templateData;
}
