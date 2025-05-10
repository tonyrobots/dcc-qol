/**
 * Handles Foundry VTT hooks related to the data generation and mechanics of attack rolls.
 * This includes modifying roll terms, preparing data before a chat message is created,
 * or reacting to events within the attack sequence itself.
 */
import {
    getFirstTarget,
    checkFiringIntoMelee,
    getWeaponFromActorById,
    measureTokenDistance,
} from "../utils.js";

/**
 * Test Listener for the dcc.modifyAttackRollTerms hook.
 * Adds a bonus based on the length of the target's name.
 * @param {Array} terms - The array of roll terms.
 * @param {Actor} actor - The attacking actor.
 * @param {Item} weapon - The weapon item used.
 * @param {TokenDocument | TokenDocument[] | undefined} targets - The target(s) passed by the hook.
 * @param {object} options - Roll options.
 */
export function addTestBonus(terms, actor, weapon, targets, options) {
    console.debug("DCC-QOL | addTestBonus hook listener called");
    console.log("DCC-QOL Hook | dcc.modifyAttackRollTerms triggered!");
    console.log(
        "DCC-QOL Hook | Initial terms:",
        JSON.parse(JSON.stringify(terms))
    ); // Log initial terms
    console.log("DCC-QOL Hook | Targets received:", targets); // Log received targets

    // Determine the first valid target document
    let targetDocument = undefined;
    if (targets instanceof Set && targets.size > 0) {
        // Standard Foundry target Set<Token>
        targetDocument = targets.first()?.document; // Get the document from the first Token
    }

    if (targetDocument?.name) {
        const targetName = targetDocument.name;
        const weirdBonusValue = targetName.length;
        console.log(
            `DCC-QOL Hook | Target: ${targetName}, Name Length: ${weirdBonusValue}`
        );

        // Add the new modifier term
        terms.push({
            type: "Modifier",
            label: "Weird Bonus", // Translate if needed: game.i18n.localize("DCC-QOL.WeirdBonusLabel")
            formula: "+" + weirdBonusValue.toString(), // Ensure formula is a string
        });

        console.log("DCC-QOL Hook | Final terms:", terms); // Log terms after modification
    } else {
        console.log(
            "DCC-QOL Hook | No valid target document found in the Set."
        );
    }
}

/**
 * Hooks into 'dcc.rollWeaponAttack' to prepare data for the QoL Attack Card.
 * Augments the messageData object with flags needed by the renderChatMessage hook.
 *
 * @param {Roll[]} rolls - Array of roll objects involved in the attack.
 * @param {object} messageData - The chat message data object before creation.
 */
export async function prepareQoLAttackData(rolls, messageData) {
    const useQoLAttackCard = game.settings.get("dcc-qol", "useQoLAttackCard");
    if (!useQoLAttackCard) {
        return; // Do nothing if the setting is disabled
    }

    console.debug("DCC-QOL | prepareQoLAttackData hook listener called");
    console.debug("DCC-QOL | Received messageData:", messageData);

    // Extract basic data
    const actorId = messageData.system.actorId;
    const weaponId = messageData.system.weaponId;
    const tokenId = messageData.speaker.token; // Attacker's token ID

    // --- Fetch Actor (prioritizing token if available) ---
    let actor;
    if (tokenId) {
        const token = canvas.tokens.get(tokenId);
        if (token) {
            actor = token.actor;
        }
    }
    // If no actor from token, or no tokenId, fallback to actorId
    if (!actor && actorId) {
        actor = game.actors.get(actorId);
    }

    if (!actor) {
        console.warn(
            `DCC-QOL | prepareQoLAttackData: Could not determine actor. Token ID: ${tokenId}, Actor ID: ${actorId}`
        );
        // Potentially return or handle error if actor is critical and not found
        // For now, will proceed, and getWeaponFromActorById will likely warn if actor is null/undefined
    }

    // Adjust 'Player Character' if DCC uses a different type string for PCs
    const isPC = actor && actor.type === "Player";

    const tokenName = messageData.speaker.alias || messageData.speaker.name; // Attacker's display name
    const isCrit = messageData.flags["dcc.isCrit"] || false;
    const isFumble = messageData.flags["dcc.isFumble"] || false;
    const hitsAc = messageData.system.hitsAc; // What AC value the roll hits
    const weapon = getWeaponFromActorById(actor, weaponId);

    // Process Targets using utility function
    const targetsSet = messageData.system.targets; // This is a Set<Token>
    const targetDocument = getFirstTarget(targetsSet); // Get the TokenDocument object

    let targetName = "";
    let targetTokenId = null;
    let hitsTarget = false; // Default to false

    if (targetDocument) {
        targetName = targetDocument.name || "target"; // Get name directly
        targetTokenId = targetDocument.id; // Get ID directly
        const targetActor = targetDocument.actor; // Get actor from document

        if (targetActor) {
            const targetAC = targetActor.system?.attributes?.ac?.value;
            if (targetAC !== undefined && hitsAc !== undefined) {
                hitsTarget =
                    !isFumble && parseInt(hitsAc) >= parseInt(targetAC); // Hit if not a fumble and roll >= AC
                console.debug(
                    `DCC-QOL | Target AC: ${targetAC}, Hits AC: ${hitsAc}, Hits Target: ${hitsTarget}`
                );
            } else {
                console.debug(
                    `DCC-QOL | Could not determine target AC (${targetAC}) or Hits AC (${hitsAc})`
                );
            }
        }
    } else {
        console.debug(
            "DCC-QOL | No valid targets found by getFirstTarget utility."
        );
    }

    // --- Friendly Fire Check ---
    let showFriendlyFireButton = false;
    if (
        game.settings.get("dcc-qol", "automateFriendlyFire") && // if setting is enabled
        isPC &&
        weapon &&
        !weapon.system.melee && // is Ranged weapon
        !hitsTarget &&
        targetDocument
    ) {
        // Missed a specific target
        try {
            showFriendlyFireButton = await checkFiringIntoMelee(targetDocument);
        } catch (e) {
            console.error("DCC-QOL | Error calling checkFiringIntoMelee:", e);
            showFriendlyFireButton = false; // Default to false on error
        }
    }

    // --- Prepare QoL Data ---
    const qolData = {
        isAttackRoll: true, // Flag for the render hook
        actorId: actorId,
        weaponId: weaponId,
        tokenId: tokenId,
        tokenName: tokenName,
        isPC: isPC, // Add the isPC flag here
        target: targetName,
        targettokenId: targetTokenId,
        hitsTarget: hitsTarget,
        isCrit: isCrit,
        isFumble: isFumble,
        deedDieResult: messageData.system?.deedDieRollResult ?? null,
        deedRollSuccess: messageData.system?.deedRollSuccess ?? null,
        isDisplayHitMiss: game.settings.get("dcc-qol", "DisplayHitMiss"), // Get setting value
        hitsAc: hitsAc, // Pass the raw hitsAC value for display when no target
        showFriendlyFireButton: showFriendlyFireButton,
        options: {}, // Placeholder for future options
    };

    // Attach QoL data to message flags
    messageData.flags.dccqol = qolData;

    console.debug(
        "DCC-QOL | Augmented messageData with flags:",
        messageData.flags.dccqol
    );
}

/**
 * Hooks into 'dcc.modifyAttackRollTerms' to apply a penalty if firing a ranged weapon
 * at a target engaged in melee with a friendly creature.
 *
 * @param {Array} terms - The array of roll terms.
 * @param {Actor} actor - The attacking actor.
 * @param {Item} weapon - The weapon item used.
 * @param {object} options - The options object from the hook, containing the actual targets Set and other roll parameters.
 */
export function applyFiringIntoMeleePenalty(terms, actor, weapon, options) {
    console.debug("DCC-QOL | applyFiringIntoMeleePenalty hook listener called");
    console.debug(
        "DCC-QOL | Options received by applyFiringIntoMeleePenalty:",
        options
    );

    // Check if the setting is enabled
    if (!game.settings.get("dcc-qol", "automateFiringIntoMeleePenalty")) {
        console.debug(
            "DCC-QOL | Firing into melee penalty automation is disabled."
        );
        return;
    }

    // Check if the weapon is ranged
    if (!weapon || weapon.system.melee) {
        console.debug(
            "DCC-QOL | Weapon is melee or not found, skipping penalty."
        );
        return;
    }

    // Determine the first valid target document
    const targetDocument = getFirstTarget(options.targets);
    if (!targetDocument) {
        console.debug(
            "DCC-QOL | No valid target found for firing into melee check."
        );
        return;
    }

    console.debug(
        `DCC-QOL | Checking firing into melee for target: ${targetDocument.name}`
    );

    try {
        const isFiringIntoMelee = checkFiringIntoMelee(targetDocument);
        if (isFiringIntoMelee) {
            console.log(
                `DCC-QOL | Firing into melee detected for target ${targetDocument.name}. Applying penalty.`
            );
            terms.push({
                type: "Modifier",
                label: game.i18n.localize(
                    "DCC-QOL.FiringIntoMeleePenaltyLabel"
                ),
                formula: "-1", // Apply a -1 penalty
            });
            console.log(
                "DCC-QOL | Terms after applying penalty:",
                JSON.parse(JSON.stringify(terms))
            );
        } else {
            console.debug(
                `DCC-QOL | Target ${targetDocument.name} is not engaged in melee with friendlies.`
            );
        }
    } catch (e) {
        console.error("DCC-QOL | Error checking firing into melee:", e);
    }
}

/**
 * Applies range checks and penalties based on weapon type and distance to target.
 * Hooks into 'dcc.modifyAttackRollTerms'.
 *
 * @param {Array} terms - The array of roll terms.
 * @param {Actor} actor - The attacking actor.
 * @param {Item} weapon - The weapon item used.
 * @param {object} options - The options object from the hook, containing targets and other roll parameters.
 */
export function applyRangeChecksAndPenalties(terms, actor, weapon, options) {
    console.debug(
        "DCC-QOL | applyRangeChecksAndPenalties hook listener called"
    );

    if (!game.settings.get("dcc-qol", "checkWeaponRange")) {
        return; // Setting disabled
    }

    // Get attacker token
    let attackerTokenDoc = actor.token; // This is often the case for linked actors
    if (!attackerTokenDoc && options.token) {
        // options.token might be the token ID for unlinked, or the TokenDocument itself
        if (typeof options.token === "string") {
            const tokenOnCanvas = canvas.tokens.get(options.token);
            if (tokenOnCanvas) {
                attackerTokenDoc = tokenOnCanvas.document;
            }
        } else if (options.token instanceof TokenDocument) {
            attackerTokenDoc = options.token;
        }
    }
    // If still no token, try to get the first active token for the actor
    if (!attackerTokenDoc && actor.getActiveTokens().length > 0) {
        attackerTokenDoc = actor.getActiveTokens()[0].document;
    }

    if (!attackerTokenDoc) {
        ui.notifications.warn(
            game.i18n.localize("DCC-QOL.WeaponRangeNoAttackerTokenWarn")
        );
        return;
    }

    // Handle targets
    const targetTokenDoc = getFirstTarget(options.targets);

    if (!targetTokenDoc) {
        ui.notifications.warn(
            game.i18n.localize("DCC-QOL.WeaponRangeNoTargetWarn")
        );
        return; // No target, so no range check to perform
    }

    if (options.targets instanceof Set && options.targets.size > 1) {
        ui.notifications.warn(
            game.i18n.format("DCC-QOL.WeaponRangeMultipleTargetsWarn", {
                targetName: targetTokenDoc.name,
            })
        );
    }

    // Weapon and actor checks
    if (!weapon) {
        console.debug(
            "DCC-QOL | applyRangeChecksAndPenalties: No weapon found."
        );
        return; // No weapon, no range check
    }
    if (!actor) {
        console.debug(
            "DCC-QOL | applyRangeChecksAndPenalties: No actor found."
        );
        return; // No actor, no range check
    }

    // Proceed with distance calculation and checks...
    const distance = measureTokenDistance(attackerTokenDoc, targetTokenDoc);
    const gridUnitSize = game.canvas.dimensions.distance;
    const gridUnits = game.scenes.active?.grid.units || "ft"; // Fallback to ft if units not set

    if (weapon.system.melee) {
        // Melee Weapon Logic
        if (distance > gridUnitSize) {
            ui.notifications.warn(
                game.i18n.format("DCC-QOL.WeaponMeleeWarn", {
                    distance: Math.round(distance),
                    units: gridUnits,
                })
            );
        }
    } else {
        // Ranged Weapon Logic
        const rangeString = weapon.system.range || ""; // e.g., "30/60/120" or "50"
        const rangeParts = rangeString.split("/").map(Number);

        let shortRange = 0,
            mediumRange = 0,
            longRange = 0;

        if (rangeParts.length === 3) {
            [shortRange, mediumRange, longRange] = rangeParts;
        } else if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
            // If only one number, assume it's short range, then double for medium, triple for long (common DCC convention for thrown)
            // Or, more simply, treat it as max range and don't apply medium/long penalties unless specified
            // For now, let's assume a single number is just the MAX range and has no distinct short/medium bands for penalties
            // This part might need refinement based on how DCC handles single range values for penalties
            longRange = rangeParts[0];
            // To strictly follow the spec for a 3-part range for penalties, we'd only act if 3 parts are given.
            // Let's only apply penalties if we have 3 distinct range bands.
            if (distance > longRange) {
                ui.notifications.warn(
                    game.i18n.format("DCC-QOL.WeaponRangedWarnTooFar", {
                        distance: Math.round(distance),
                        units: gridUnits,
                        maxRange: longRange,
                    })
                );
            }
            // Early return if not 3-part range, as penalties below are for 3-part ranges.
            console.debug(
                `DCC-QOL | Ranged weapon ${weapon.name} has range ${rangeString}. Penalties apply to 3-part ranges.`
            );
            return;
        } else {
            console.warn(
                `DCC-QOL | Weapon ${weapon.name} has an unparsable range: ${rangeString}`
            );
            return; // Cannot parse range, so skip checks
        }

        if (distance > longRange) {
            ui.notifications.warn(
                game.i18n.format("DCC-QOL.WeaponRangedWarnTooFar", {
                    distance: Math.round(distance),
                    units: gridUnits,
                    maxRange: longRange,
                })
            );
        } else if (distance > mediumRange) {
            // Target is at Long Range (mediumRange < distance <= longRange)
            // Ensure terms[0] is the action die before modifying its formula
            if (terms.length > 0 && terms[0] && terms[0].type === "Die") {
                terms[0].formula = game.dcc.DiceChain.bumpDie(
                    terms[0].formula,
                    "-1"
                );
                ui.notifications.warn(
                    game.i18n.format("DCC-QOL.WeaponRangedWarnLong", {
                        distance: Math.round(distance),
                        units: gridUnits,
                        mediumRange: mediumRange,
                        longRange: longRange,
                    })
                );
            } else {
                console.warn(
                    "DCC-QOL | Could not find action die term to apply long range penalty."
                );
            }
        } else if (distance > shortRange) {
            // Target is at Medium Range (shortRange < distance <= mediumRange)
            terms.push({
                type: "Modifier",
                label: game.i18n.localize("DCC-QOL.WeaponRangePenaltyMedium"),
                formula: "-2",
            });
            ui.notifications.warn(
                game.i18n.format("DCC-QOL.WeaponRangedWarnMedium", {
                    distance: Math.round(distance),
                    units: gridUnits,
                    shortRange: shortRange,
                    mediumRange: mediumRange,
                })
            );
        }
        // If distance <= shortRange, it's Short Range or closer, no penalty, no warning needed for this.
    }

    console.debug(
        `DCC-QOL | Attacker: ${attackerTokenDoc.name}, Target: ${targetTokenDoc.name}, Distance: ${distance} ${gridUnits}`
    );
}
