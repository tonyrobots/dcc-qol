// Chat message handling for DCC-QOL
import { getWeaponProperties, exploreObject } from "./utils.js";

export class DCCQOLChat {
    /**
     * Handle chat message creation
     * @param {ChatMessage} message - The chat message being created
     * @param {Object} options - Additional options
     * @param {string} userId - The user who created the message
     */
    static async onCreateChatMessage(message, options, userId) {
        try {
            // Debug log
            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Processing chat message:", message);

                // Enhanced debug exploration
                if (game.settings.get("dcc-qol", "debugExplore")) {
                    exploreObject(message, "Chat Message", { depth: 2 });

                    if (message.rolls?.length) {
                        exploreObject(message.rolls[0], "Roll", { depth: 3 });

                        // Explore roll terms
                        message.rolls[0].terms.forEach((term, i) => {
                            exploreObject(
                                term,
                                `Roll Term ${i} (${term.constructor.name})`,
                                { depth: 2 }
                            );
                        });
                    }

                    // Explore actor and related objects if available
                    const actor = game.actors.get(message.speaker.actor);
                    if (actor) {
                        exploreObject(actor, "Actor", { depth: 1 });

                        // Find weapons
                        const weapons = actor.items.filter(
                            (i) => i.type === "weapon"
                        );
                        if (weapons.length) {
                            exploreObject(weapons[0], "Sample Weapon", {
                                depth: 2,
                            });
                        }
                    }
                }
            }

            // Only process messages that have rolls
            if (!message.rolls?.length) return;

            const actor = game.actors.get(message.speaker.actor);
            if (!actor) return;

            // Check if this is an attack roll using ONLY the system's isToHit flag
            const isAttackRoll = message.flags?.dcc?.isToHit === true;

            if (!isAttackRoll) return;

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Attack roll detected");
            }

            // Get weapon - try multiple sources in order of reliability
            const weaponId =
                message.system?.weaponId || message.flags?.dcc?.ItemId;
            let weapon;

            if (weaponId) {
                // Try direct lookup by ID first
                weapon = actor.items.get(weaponId);
            }

            // If we couldn't find the weapon by ID and we have a name, try by name
            if (!weapon && message.system?.weaponName) {
                weapon = actor.items.find(
                    (i) =>
                        i.type === "weapon" &&
                        i.name === message.system.weaponName
                );
            }

            // If still no weapon, check if we have a flavor text we can parse
            if (!weapon && message.flavor?.includes("Attack Roll with")) {
                const weaponName = message.flavor
                    .split("Attack Roll with ")[1]
                    ?.trim();
                if (weaponName) {
                    weapon = actor.items.find(
                        (i) => i.type === "weapon" && i.name === weaponName
                    );
                }
            }

            if (!weapon) {
                console.warn(
                    "DCC-QOL | Could not identify weapon for attack roll"
                );
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Found weapon:", weapon);
            }

            // Get target information
            const target = game.user.targets.first();
            const targetData = target
                ? {
                      name: target.actor.name,
                      tokenId: target.document.uuid,
                      ac: target.actor.system.attributes.ac.value,
                  }
                : null;

            // Get roll data
            const roll = message.rolls[0];

            // Extract roll outcomes directly from system data
            const rollData = {
                deedDieValue: message.system?.deedDieRollResult,
                deedRollSuccess: message.system?.deedRollSuccess,
                // ONLY use the system's isNaturalCrit flag
                isCrit: message.flags?.dcc?.isNaturalCrit === true,
                // ONLY use the system's isFumble flag
                isFumble: message.flags?.dcc?.isFumble === true,
                hitsTarget: targetData
                    ? (message.system?.hitsAc || roll.total) >= targetData.ac
                    : false,
            };

            // Check for firing into melee using proper canvas methods
            const firingIntoMelee =
                targetData &&
                weapon.system.range === "ranged" &&
                canvas.tokens.placeables.some(
                    (t) =>
                        t.actor?.type === "Player Character" &&
                        t.id !== target.id &&
                        canvas.grid.measureDistance(t, target) <= 5
                );

            // Get token information
            const token = canvas.tokens.placeables.find(
                (t) => t.actor?.id === actor.id
            );
            const tokenId = token?.id || message.speaker.token || "";

            // Prepare template data
            const templateData = {
                actor,
                weapon,
                properties: await getWeaponProperties(weapon, {}),
                target: targetData,
                roll,
                diceHTML: await roll.render(),
                deedDieValue: rollData.deedDieValue,
                deedRollSuccess: rollData.deedRollSuccess,
                isFumble: rollData.isFumble,
                isCrit: rollData.isCrit,
                hitsTarget: rollData.hitsTarget,
                isDisplayHitMiss: game.settings.get(
                    "dcc-qol",
                    "DisplayHitMiss"
                ),
                friendlyFire: firingIntoMelee,
                headerText: `${actor.name} - Attack Roll with ${weapon.name}`,
                actorId: actor.id,
                tokenId: tokenId,
                options: JSON.stringify({}),
            };

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Template data:", templateData);
            }

            // Render the template
            const content = await renderTemplate(
                "modules/dcc-qol/templates/attackroll-card.html",
                templateData
            );

            // Update the message with proper flags
            await message.update({
                content,
                flags: {
                    "dcc-qol": {
                        processed: true,
                        weaponId: weapon.id,
                        rollType: "attack",
                        deedDieValue: rollData.deedDieValue,
                        isCrit: rollData.isCrit,
                        isFumble: rollData.isFumble,
                        hitsTarget: rollData.hitsTarget,
                    },
                },
            });
        } catch (error) {
            console.error("DCC-QOL | Error handling attack roll:", error);
        }
    }

    /**
     * Handle chat message rendering
     * @param {ChatMessage} message - The chat message being rendered
     * @param {jQuery} html - The rendered HTML
     * @param {Object} data - The message data
     */
    static async onRenderChatMessage(message, html, data) {
        try {
            // Add click handlers for buttons
            html.find(".card-buttons button").on(
                "click",
                this._onChatCardAction.bind(this)
            );
            html.find(".card-header").on(
                "click",
                this._onChatCardToggleContent.bind(this)
            );

            // Add visual enhancements for attack rolls based only on DCC flags
            if (message.flags?.dcc?.isToHit === true) {
                if (message.flags.dcc.isFumble === true) {
                    html.find(".dice-total").addClass("fumble");
                } else if (message.flags.dcc.isNaturalCrit === true) {
                    html.find(".dice-total").addClass("critical");
                }
            }
        } catch (error) {
            console.error("DCC-QOL | Error rendering chat message:", error);
        }
    }

    /**
     * Handle attack roll chat message
     */
    static async _handleAttackRoll(message, actor, weaponId) {
        try {
            // If no weaponId provided, try to find the weapon from the message flavor
            let weapon = weaponId ? actor.items.get(weaponId) : null;
            if (!weapon && message.flavor) {
                const weaponName = message.flavor.split("Attack Roll with ")[1];
                if (weaponName) {
                    weapon = actor.items.find(
                        (i) => i.name === weaponName && i.type === "weapon"
                    );
                }
            }

            if (!weapon) {
                console.warn("DCC-QOL | Could not find weapon for attack roll");
                return;
            }

            // Get target information
            const target = game.user.targets.first();
            const targetData = target
                ? {
                      name: target.actor.name,
                      tokenId: target.document.uuid,
                      ac: target.actor.system.attributes.ac.value,
                  }
                : null;

            // Get roll information
            const roll = message.rolls[0];
            if (!roll) {
                console.warn("DCC-QOL | No roll found in message");
                return;
            }

            const d20Result = roll.dice[0]?.total;
            const total = roll.total;

            // Determine hit/miss
            const hitsTarget = targetData ? total >= targetData.ac : false;
            const isFumble = d20Result === 1;
            const isCrit = this._isCritical(roll, actor);

            // Get deed die result if applicable
            let deedDieHTML = "";
            if (game.settings.get("dcc-qol", "automateDeedDieRoll")) {
                const deedDie = actor.system.details.attackBonus;
                if (deedDie) {
                    const deedDieRoll = new Roll(deedDie);
                    await deedDieRoll.evaluate({ async: true });
                    deedDieHTML = await this._getDeedDieHTML(deedDieRoll);
                }
            }

            // Check for friendly fire
            const friendlyFire =
                message.flags.dcc?.options?.firingIntoMelee || false;

            // Prepare template data
            const templateData = {
                actor: actor,
                weapon: weapon,
                properties: await getWeaponProperties(
                    weapon,
                    message.flags.dcc?.options || {}
                ),
                target: targetData,
                roll: roll,
                diceHTML: await roll.render(),
                deedDieHTML: deedDieHTML,
                isFumble: isFumble,
                isCrit: isCrit,
                hitsTarget: hitsTarget,
                isDisplayHitMiss: game.settings.get(
                    "dcc-qol",
                    "DisplayHitMiss"
                ),
                friendlyFire: friendlyFire,
                headerText: `${actor.name} - Attack Roll with ${weapon.name}`,
                options: JSON.stringify(message.flags.dcc?.options || {}),
            };

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Template data:", templateData);
            }

            // Render the template
            const content = await renderTemplate(
                "modules/dcc-qol/templates/attackroll-card.html",
                templateData
            );

            // Update the message
            await message.update({
                content: content,
                "flags.dcc-qol.processed": true,
                "flags.dcc-qol.weaponId": weapon.id,
            });
        } catch (error) {
            console.error("DCC-QOL | Error handling attack roll:", error);
        }
    }

    /**
     * Handle damage roll chat message
     */
    static async _handleDamageRoll(message, actor) {
        const weapon = actor.items.get(message.flags.dcc.ItemId);
        if (!weapon) return;

        // Get target information
        const target = game.user.targets.first();
        if (!target) return;

        let content = await message.rolls[0].render();

        // Add damage application message if enabled
        if (game.settings.get("dcc-qol", "automateDamageApply")) {
            content += `<br/>${game.i18n.format("DCC-QOL.TakeDamage", {
                actor: target.actor.name,
                damage: message.rolls[0].total,
            })}`;
        } else {
            content += game.i18n.format("DCC-QOL.TakeDamageManual", {
                actor: target.actor.name,
                damage: message.rolls[0].total,
            });
        }

        // Update the message
        await message.update({
            content: content,
            "flags.dcc-qol.processed": true,
        });
    }

    /**
     * Handle critical roll chat message
     */
    static async _handleCriticalRoll(message, actor) {
        // Add any critical hit specific modifications
        if (!message.flags.dcc.processed) {
            await message.update({
                "flags.dcc-qol.processed": true,
            });
        }
    }

    /**
     * Handle chat card button clicks
     */
    static async _onChatCardAction(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const action = button.dataset.action;

        // Get the actor - either from token or directly
        let actor = null;
        const actorId = card.dataset.actorId;
        const tokenId = card.dataset.tokenId;

        if (tokenId && canvas.ready) {
            // Try to get token actor first
            const token = canvas.tokens.get(tokenId);
            if (token) {
                actor = token.actor;
            }
        }

        // Fallback to actor directly if no token found
        if (!actor && actorId) {
            actor = game.actors.get(actorId);
        }

        if (!actor) {
            console.warn("No actor found for card!", card);
            return;
        }

        // Get the weapon
        const weaponId = card.dataset.weaponId;
        const weapon = actor.items.get(weaponId);
        if (!weapon) {
            console.warn("No weapon found for card!", card);
            return;
        }

        // Handle the action
        switch (action) {
            case "damage":
                // DCC system uses this method to roll damage for a weapon
                await this._rollDamage(actor, weapon);
                break;
            case "fumble":
                // Use DCC system's fumble method if available
                if (typeof actor.rollFumble === "function") {
                    await actor.rollFumble();
                } else {
                    // Fallback to rolling on fumble table
                    await this._rollFumble(actor);
                }
                break;
            case "crit":
                // Use DCC system's crit method if available
                if (typeof actor.rollCritical === "function") {
                    await actor.rollCritical();
                } else {
                    // Fallback to rolling on crit table
                    await this._rollCritical(actor, weapon);
                }
                break;
            case "friendlyFire":
                await this._handleFriendlyFire(actor, card);
                break;
        }
    }

    /**
     * Roll damage using DCC system methods
     */
    static async _rollDamage(actor, weapon) {
        try {
            // Check how the DCC system handles damage rolls
            if (typeof actor.rollDamage === "function") {
                // Direct method on actor
                await actor.rollDamage(weapon.id);
            } else if (typeof weapon.rollDamage === "function") {
                // Method on the weapon item
                await weapon.rollDamage();
            } else {
                // Last resort - use weapon's damage formula to create a roll
                const damageFormula = weapon.system.damage;
                if (!damageFormula) {
                    console.warn("No damage formula found for weapon", weapon);
                    return;
                }

                // Create and roll the damage
                const roll = new Roll(damageFormula, actor.getRollData());
                await roll.evaluate({ async: true });

                // Send to chat
                await roll.toMessage({
                    flavor: `${actor.name} - Damage with ${weapon.name}`,
                    speaker: ChatMessage.getSpeaker({ actor }),
                });
            }
        } catch (error) {
            console.error("Error rolling damage:", error);
        }
    }

    /**
     * Handle chat card header toggle
     */
    static async _onChatCardToggleContent(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const card = header.closest(".chat-card");
        const content = card.querySelector(".card-content");
        content.style.display =
            content.style.display === "none" ? "block" : "none";
    }

    /**
     * Get actor from chat card
     */
    static async _getChatCardActor(card) {
        // First try to get the token actor
        const tokenUuid = card.dataset.tokenId;
        if (tokenUuid) {
            const token = await fromUuid(tokenUuid);
            if (token) return token.actor;
        }

        // Fallback to actor ID
        const actorId = card.dataset.actorId;
        return game.actors.get(actorId);
    }

    /**
     * Handle friendly fire check
     */
    static async _handleFriendlyFire(actor, card) {
        const roll = new Roll("d100");
        await roll.evaluate({ async: true });

        const weapon = actor.items.get(card.dataset.weaponId);
        const success = roll.total >= 51;

        const chatText = game.i18n.format(
            success
                ? "DCC-QOL.FriendlyFireSuccess"
                : "DCC-QOL.FriendlyFireFail",
            { weapon: weapon.name }
        );

        const friendlyFireHTML = `<div class="dice-roll">
                <div class="dice-result">
                    <h4 class="dice-total ${success ? "success" : "fail"}">${
            roll.total
        }</h4>
                </div>
            </div>
            <div class="dccqol chat-card">
                <div class="chat-details">
                    <div class="ff-result">${chatText}</div>
                </div>
            </div>`;

        await roll.toMessage({
            speaker: { alias: actor.name },
            flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
            content: friendlyFireHTML,
        });
    }

    /**
     * Check if roll is a critical hit
     */
    static _isCritical(roll, actor) {
        if (!roll || !actor) return false;

        const d20Term = roll.terms?.find(
            (t) => t instanceof foundry.dice.terms.Die && t.faces === 20
        );
        if (!d20Term) return false;

        const d20Result = d20Term.total;
        const critRange = actor.system.details.critRange || 20;
        return d20Result >= critRange;
    }

    /**
     * Generate deed die HTML
     */
    static async _getDeedDieHTML(roll) {
        if (!roll) return "";

        const deedDieResult = roll.total;
        const isSuccess = deedDieResult >= 3;

        return `
            <div class="chat-details">
                <div class="roll-result">${game.i18n.localize(
                    "DCC.DeedRollValue"
                )}</div>
            </div>
            <div class="dice-roll">
                <div class="dice-result">
                    <h4 class="dice-total">
                        <span style="color:${
                            isSuccess ? "green" : "black"
                        }">${deedDieResult}</span>
                    </h4>
                </div>
            </div>`;
    }

    /**
     * Roll on fumble table (fallback method)
     */
    static async _rollFumble(actor) {
        try {
            // Get the fumble die directly from the actor's system data
            const fumbleDie = actor?.system?.attributes?.fumble?.die;

            if (!fumbleDie) {
                console.error(
                    `DCC-QOL | No fumble die found for ${actor.name}`
                );
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Using fumble die for ${actor.name}: ${fumbleDie}`
                );
            }

            // Create the roll
            const roll = new Roll(fumbleDie, actor.getRollData());
            await roll.evaluate({ async: true });

            // Send to chat
            await roll.toMessage({
                flavor: `${actor.name} - Fumble Roll`,
                speaker: ChatMessage.getSpeaker({ actor }),
            });
        } catch (error) {
            console.error("Error rolling fumble:", error);
        }
    }

    /**
     * Roll on critical table (fallback method)
     */
    static async _rollCritical(actor, weapon) {
        try {
            // Get critical hit information directly from actor data
            const critDie = actor?.system?.attributes?.critical?.die;

            if (!critDie) {
                console.error(
                    `DCC-QOL | No critical die found for ${actor.name}`
                );
                return;
            }

            // Get critical table from actor data or weapon data
            const critTable =
                actor?.system?.attributes?.critical?.table ||
                weapon?.system?.critTable;

            if (!critTable) {
                console.error(
                    `DCC-QOL | No critical table found for ${actor.name} or ${weapon.name}`
                );
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Using critical die for ${actor.name}: ${critDie}`
                );
                console.log(
                    `DCC-QOL | Using critical table for ${weapon.name}: ${critTable}`
                );
            }

            // Format die roll correctly (ensure it has a leading number)
            let rollFormula = critDie;
            if (!rollFormula.match(/^\d+/)) {
                rollFormula = "1" + rollFormula;
            }

            // Create and evaluate the roll
            const roll = new Roll(rollFormula, actor.getRollData());
            await roll.evaluate({ async: true });

            // Send to chat
            await roll.toMessage({
                flavor: `${actor.name} - Critical Hit (Table ${critTable})`,
                speaker: ChatMessage.getSpeaker({ actor }),
            });
        } catch (error) {
            console.error("Error rolling critical:", error);
        }
    }
}
