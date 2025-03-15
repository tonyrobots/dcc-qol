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
            // Debug logging
            this._logMessageDebug(message);

            // Get the actor if available (not all messages have an associated actor)
            const actor = message.speaker?.actor
                ? game.actors.get(message.speaker.actor)
                : null;

            // Detect message type and process accordingly
            if (this._isAttackRoll(message)) {
                await this._processAttackRoll(message, actor);
            } else if (this._isDamageRoll(message)) {
                await this._processDamageRoll(message, actor);
            }
            // Add more message type handlers here as needed
        } catch (error) {
            console.error("DCC-QOL | Error processing chat message:", error);
        }
    }

    /**
     * Log debug information about a chat message
     * @private
     */
    static _logMessageDebug(message) {
        if (!game.settings.get("dcc-qol", "log")) return;

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
            const actor = game.actors.get(message.speaker?.actor);
            if (actor) {
                exploreObject(actor, "Actor", { depth: 1 });

                // Find weapons
                const weapons = actor.items.filter((i) => i.type === "weapon");
                if (weapons.length) {
                    exploreObject(weapons[0], "Sample Weapon", {
                        depth: 2,
                    });
                }
            }
        }
    }

    /**
     * Check if message is an attack roll
     * @private
     */
    static _isAttackRoll(message) {
        return (
            message.flags?.dcc?.isToHit === true && message.rolls?.length > 0
        );
    }

    /**
     * Check if message is a damage roll
     * @private
     */
    static _isDamageRoll(message) {
        // Enhanced logging for debugging damage detection
        if (game.settings.get("dcc-qol", "log")) {
            console.log("DCC-QOL | Checking if message is a damage roll:", {
                flavor: message.flavor,
                hasRolls: message.rolls?.length > 0,
                rollTotal: message.rolls?.[0]?.total,
                flags: message.flags?.dcc,
            });
        }

        // Try to detect using system data first - most reliable method
        if (
            message.flags?.dcc &&
            message.flavor?.includes(game.i18n.localize("DCC.Damage"))
        ) {
            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Damage roll detected via system flags");
            }
            return true;
        }

        // Check if content contains damage-applyable elements (DCC system's way of marking damage)
        if (
            message.rolls?.length > 0 &&
            message.content?.includes("damage-applyable")
        ) {
            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    "DCC-QOL | Damage roll detected via damage-applyable class"
                );
            }
            return true;
        }

        // Fallback to checking roll properties if it's clearly a damage roll
        const isDamageLike =
            message.rolls?.length > 0 &&
            !message.flags?.dcc?.isToHit &&
            !message.flags?.dcc?.isSave &&
            !message.flags?.dcc?.isAbilityCheck &&
            !message.flags?.dcc?.isSkillCheck &&
            message.flavor?.includes("Damage");

        if (isDamageLike) {
            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    "DCC-QOL | Damage roll detected via fallback method"
                );
            }
            return true;
        }

        return false;
    }

    /**
     * Process an attack roll message
     * @private
     */
    static async _processAttackRoll(message, actor) {
        if (!actor) return;

        if (game.settings.get("dcc-qol", "log")) {
            console.log("DCC-QOL | Attack roll detected");
        }

        // Get weapon - try multiple sources in order of reliability
        const weaponId = message.system?.weaponId || message.flags?.dcc?.ItemId;
        let weapon;

        if (weaponId) {
            // Try direct lookup by ID first
            weapon = actor.items.get(weaponId);
        }

        // If we couldn't find the weapon by ID and we have a name, try by name
        if (!weapon && message.system?.weaponName) {
            weapon = actor.items.find(
                (i) =>
                    i.type === "weapon" && i.name === message.system.weaponName
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
            console.warn("DCC-QOL | Could not identify weapon for attack roll");
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

        // Create options object for weapon properties
        const options = {
            backstab: message.flags?.dcc?.backstab === true,
            useDeedDie:
                message.flags?.dcc?.useDeedDie === true ||
                message.flags?.dcc?.isDeedRoll === true,
        };

        // Extract weapon properties with the proper options
        const weaponProperties = await getWeaponProperties(weapon, options);

        // Extract roll outcomes directly from system data
        const rollData = {
            deedDieValue: message.system?.deedDieRollResult,
            deedRollSuccess: message.system?.deedRollSuccess,
            // ONLY use the system's isNaturalCrit flag
            isCrit: message.flags?.dcc?.isNaturalCrit === true,
            // ONLY use the system's isFumble flag
            isFumble: message.flags?.dcc?.isFumble === true,
        };

        // Determine hit/miss
        const isFumble = rollData.isFumble;
        const isCrit = rollData.isCrit;

        // Critical hits are always hits, fumbles are always misses
        let hitsTarget = false;
        if (isFumble) {
            hitsTarget = false;
        } else if (isCrit) {
            hitsTarget = true;
        } else {
            hitsTarget = targetData ? roll.total >= targetData.ac : false;
        }

        // Enhanced logging for hit status
        if (game.settings.get("dcc-qol", "log")) {
            console.log("DCC-QOL | Attack roll hit determination:", {
                rollTotal: roll.total,
                targetAC: targetData?.ac || "No target",
                hitsTarget,
                isCrit,
                isFumble,
                systemHitsAC: message.system?.hitsAc,
                // Add weapon properties debugging
                weaponEquipped: weapon.system.equipped,
                weaponTrained: weapon.system.trained,
                weaponType: weapon.system.melee ? "Melee" : "Ranged",
                weaponDamage: weapon.system.damage,
                weaponProperties,
            });
        }

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
            properties: weaponProperties, // Use the properties we just calculated
            target: targetData,
            roll,
            diceHTML: await roll.render(),
            deedDieValue: rollData.deedDieValue,
            deedRollSuccess: rollData.deedRollSuccess,
            isFumble: isFumble,
            isCrit: isCrit,
            hitsTarget,
            isDisplayHitMiss: game.settings.get("dcc-qol", "DisplayHitMiss"),
            friendlyFire: firingIntoMelee,
            headerText: `${actor.name} - Attack Roll with ${weapon.name}`,
            actorId: actor.id,
            tokenId: tokenId,
        };

        // Add detailed debug logging to see exactly what's being sent to the template
        if (game.settings.get("dcc-qol", "log")) {
            console.log("DCC-QOL | Template data for attack roll card:", {
                hitsTarget,
                isCrit,
                isFumble,
                weaponName: weapon.name,
                weaponId: weapon.id,
                targetAC: targetData?.ac,
                rollTotal: roll.total,
                displayButtons: !isFumble && (hitsTarget || isCrit),
            });
        }

        // Render the template
        const content = await renderTemplate(
            "modules/dcc-qol/templates/attackroll-card.html",
            templateData
        );

        // Update the message with proper flags - make sure to store the hit status in the flags
        await message.update({
            content,
            flags: {
                "dcc-qol": {
                    processed: true,
                    weaponId: weapon.id,
                    rollType: "attack",
                    deedDieValue: rollData.deedDieValue,
                    isCrit,
                    isFumble,
                    hitsTarget,
                    rollTotal: roll.total,
                    targetAC: targetData?.ac,
                },
            },
        });
    }

    /**
     * Process a damage roll message
     * @private
     */
    static async _processDamageRoll(message, actor) {
        try {
            // Skip if auto-apply is not enabled
            if (!game.settings.get("dcc-qol", "automateDamageApply")) {
                if (game.settings.get("dcc-qol", "log")) {
                    console.log(
                        "DCC-QOL | Auto damage apply disabled, skipping"
                    );
                }
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Processing damage roll:", {
                    messageId: message.id,
                    actor: actor?.name,
                    rolls: message.rolls,
                });
            }

            // Check if this message has already been processed
            if (message.flags?.["dcc-qol"]?.damageApplied) {
                console.log(
                    "DCC-QOL | Damage already applied for this message, skipping"
                );
                return;
            }

            // Get the target(s)
            const targets = game.user.targets;
            if (!targets.size) {
                if (game.settings.get("dcc-qol", "log")) {
                    console.log(
                        "DCC-QOL | No targets selected for damage application"
                    );
                }
                return;
            }

            // Extract damage amount - first check for damage-applyable data attribute (DCC system's approach)
            let damageTotal = null;

            // Create a temporary div to parse the HTML content
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = message.content;
            const damageApplyable = tempDiv.querySelector(".damage-applyable");

            if (damageApplyable) {
                damageTotal = parseInt(damageApplyable.dataset.damage);
                if (game.settings.get("dcc-qol", "log")) {
                    console.log(
                        "DCC-QOL | Found damage from damage-applyable:",
                        damageTotal
                    );
                }
            }

            // Fallback to roll total if no damage-applyable was found
            if (!damageTotal && message.rolls?.length > 0) {
                damageTotal = message.rolls[0].total;
                if (game.settings.get("dcc-qol", "log")) {
                    console.log(
                        "DCC-QOL | Using roll total for damage:",
                        damageTotal
                    );
                }
            }

            if (!damageTotal || isNaN(damageTotal)) {
                console.error("DCC-QOL | Invalid damage total:", damageTotal);
                return;
            }

            // Check if Dice So Nice is active
            if (
                game.modules.get("dice-so-nice")?.active &&
                message.rolls?.length > 0
            ) {
                if (game.settings.get("dcc-qol", "log")) {
                    console.log(
                        "DCC-QOL | Dice So Nice is active, waiting for animation to complete"
                    );
                }

                // Wait for the original dice animation to complete before applying damage
                // Use waitFor3DAnimationByMessageID instead of showForRoll to prevent showing dice twice
                try {
                    await game.dice3d.waitFor3DAnimationByMessageID(message.id);

                    if (game.settings.get("dcc-qol", "log")) {
                        console.log(
                            "DCC-QOL | Dice animation complete, applying damage"
                        );
                    }
                    await this._applyDamageToTargets(
                        message,
                        targets,
                        damageTotal
                    );
                } catch (e) {
                    console.error(
                        "DCC-QOL | Error waiting for dice animation:",
                        e
                    );
                    // If waiting for animation fails, apply damage anyway
                    await this._applyDamageToTargets(
                        message,
                        targets,
                        damageTotal
                    );
                }
            } else {
                // No Dice So Nice, apply damage immediately
                await this._applyDamageToTargets(message, targets, damageTotal);
            }
        } catch (error) {
            console.error("DCC-QOL | Error processing damage roll:", error);
        }
    }

    /**
     * Apply damage to all targets and update the message
     * @private
     */
    static async _applyDamageToTargets(message, targets, damageTotal) {
        try {
            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Applying ${damageTotal} damage to ${targets.size} target(s)`
                );
            }

            // Apply damage to each target
            for (const target of targets) {
                await this._applyDamageToTarget(target, damageTotal);
            }

            // Add note to the message about damage application
            const targetsText = Array.from(targets)
                .map((t) => t.name || "Unknown")
                .join(", ");

            await message.update({
                content: `${message.content}<div class="dcc-qol-damage-applied"><hr><em>Applied ${damageTotal} damage to ${targetsText}</em></div>`,
                flags: {
                    "dcc-qol": {
                        processed: true,
                        damageApplied: true,
                        damageAmount: damageTotal,
                        targets: Array.from(targets).map((t) => t.id),
                    },
                },
            });

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Damage application complete");
            }
        } catch (error) {
            console.error("DCC-QOL | Error applying damage to targets:", error);
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

            // Prevent card-header from toggling the card content
            html.find(".dccqol.chat-card .card-header").on("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                return false;
            });

            // Make sure dice can be expanded and stay expanded
            html.find(".dice-roll").off("click.expandDice");
            html.find(".dice-tooltip").off("click.expandDice");

            // Add visual enhancements for attack rolls based only on DCC flags
            if (message.flags?.dcc?.isToHit === true) {
                if (message.flags.dcc.isFumble === true) {
                    html.find(".dice-total").addClass("fumble");
                } else if (message.flags.dcc.isNaturalCrit === true) {
                    html.find(".dice-total").addClass("critical");
                }
            }

            // Make sure the card content is initially visible and not collapsed
            html.find(".card-content").css("display", "block");
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

            // Get weapon properties first, to ensure they're synchronized with hit detection
            const weaponProperties = await getWeaponProperties(
                weapon,
                message.flags.dcc?.options || {}
            );

            // Determine hit/miss
            const isFumble = d20Result === 1;
            const isCrit = this._isCritical(roll, actor);

            // Critical hits are always hits, fumbles are always misses
            let hitsTarget = false;
            if (isFumble) {
                hitsTarget = false;
            } else if (isCrit) {
                hitsTarget = true;
            } else {
                hitsTarget = targetData ? total >= targetData.ac : false;
            }

            // Detailed logging
            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Attack roll handling:", {
                    weaponName: weapon.name,
                    weaponEquipped: weapon.system.equipped,
                    weaponTrained: weapon.system.trained,
                    weaponProperties,
                    rollTotal: total,
                    targetAC: targetData?.ac,
                    hitsTarget,
                    isCrit,
                    isFumble,
                });
            }

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
                properties: weaponProperties,
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
            };

            if (game.settings.get("dcc-qol", "log")) {
                console.log("DCC-QOL | Template data for attack roll card:", {
                    hitsTarget: templateData.hitsTarget,
                    isCrit: templateData.isCrit,
                    isFumble: templateData.isFumble,
                    weaponName: weapon.name,
                    displayButtons:
                        !templateData.isFumble &&
                        (templateData.hitsTarget || templateData.isCrit),
                });
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
                "flags.dcc-qol.hitsTarget": hitsTarget,
                "flags.dcc-qol.isCrit": isCrit,
                "flags.dcc-qol.isFumble": isFumble,
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
     * Handle button clicks from chat cards
     * @param {Event} event   The originating click event
     * @private
     */
    static async _onChatCardAction(event) {
        event.preventDefault();

        // Extract card data
        const button = event.currentTarget;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);

        // Validate permission to proceed with the roll
        if (!message.isAuthor && !game.user.isGM && !message.isOwner) return;

        // Get the action
        const action = button.dataset.action;
        const actorId = card.dataset.actorId;
        const tokenId = card.dataset.tokenId;
        const weaponId = card.dataset.weaponId;
        const hitsTarget = card.dataset.hitsTarget === "true";
        const isCrit = card.dataset.isCrit === "true";
        const isFumble = card.dataset.isFumble === "true";

        // Extra debugging
        if (game.settings.get("dcc-qol", "log")) {
            console.log("DCC-QOL | Chat Card Action", {
                action,
                actorId,
                tokenId,
                weaponId,
                hitsTarget,
                isCrit,
                isFumble,
            });
        }

        // Get the Actor from a synthetic Token
        let actor = null;
        if (tokenId) {
            const token = await fromUuid(tokenId);
            if (token) actor = token.actor;
        }

        // Get the Actor from the card dataset otherwise
        if (!actor && actorId) {
            actor = game.actors.get(actorId);
        }

        if (!actor) {
            console.error("DCC-QOL | No actor found for chat card action");
            return;
        }

        if (game.settings.get("dcc-qol", "log")) {
            console.log(`DCC-QOL | Actor: ${actor.name}`);
        }

        // Get the Item from Actor
        let weapon = null;
        if (weaponId) {
            weapon = actor.items.get(weaponId);
            if (game.settings.get("dcc-qol", "log")) {
                console.log(`DCC-QOL | Weapon: ${weapon?.name}`);
            }
        }

        // Handle different actions
        switch (action) {
            case "damage":
                await this._handleDamageAction(actor, weapon, isCrit);
                break;
            case "fumble":
                await this._rollFumble(actor);
                break;
            case "crit":
                await this._rollCritical(actor, weapon);
                break;
            case "friendlyFire":
                this._handleFriendlyFire(actor, weapon);
                break;
        }
    }

    /**
     * Roll damage for an attack
     * @param {string} actorId - The actor ID
     * @param {string} weaponId - The weapon ID
     * @param {boolean} isCritical - Whether this is a critical hit
     * @private
     */
    static async _rollDamage(actorId, weaponId, isCritical = false) {
        try {
            const actor = game.actors.get(actorId);
            if (!actor) {
                console.error(
                    `DCC-QOL | Cannot roll damage: No actor found with ID ${actorId}`
                );
                return;
            }

            const weapon = actor.items.get(weaponId);
            if (!weapon) {
                console.error(
                    `DCC-QOL | Cannot roll damage: No weapon found with ID ${weaponId}`
                );
                return;
            }

            // Add detailed debugging for weapon damage
            console.log("DCC-QOL | Weapon details for damage roll:", {
                name: weapon.name,
                id: weapon.id,
                type: weapon.type,
                damageData: weapon.system.damage,
                entireWeapon: weapon,
            });

            // Roll the damage
            const weaponRollData = await weapon.getRollData();

            // Handle different possible damage property structures
            let formula = "";

            // Check for different data structures the weapon damage could have
            if (typeof weapon.system.damage === "string") {
                // Simple string damage formula
                formula = weapon.system.damage;
            } else if (typeof weapon.system.damage === "object") {
                // Object with damage properties
                if (isCritical && weapon.system.damage?.critDamage) {
                    formula = weapon.system.damage.critDamage;
                } else if (weapon.system.damage?.value) {
                    formula = weapon.system.damage.value;
                } else if (weapon.system.damage?.normal) {
                    // Some systems use 'normal' instead of 'value'
                    formula = weapon.system.damage.normal;
                } else if (weapon.system.damage?.formula) {
                    // Some systems use 'formula'
                    formula = weapon.system.damage.formula;
                } else if (weapon.system.damage?.dice) {
                    // Some use 'dice'
                    formula = weapon.system.damage.dice;
                }
            }

            // Log formula details
            console.log("DCC-QOL | Damage formula details:", {
                formula,
                isCritical,
                critDamage: weapon.system?.damage?.critDamage,
                normalDamage: weapon.system?.damage?.value,
                damageStructure: typeof weapon.system.damage,
            });

            if (!formula || formula === "0" || formula === "") {
                // Log formula retrieval failure
                console.error("DCC-QOL | Invalid damage formula:", {
                    formula: formula,
                    weaponName: weapon.name,
                    weaponId: weapon.id,
                    damageObj: weapon.system.damage,
                });

                // Simply show the warning and return without fallbacks
                ui.notifications.warn(
                    game.i18n.localize("DCC-QOL.NoDamageFormula")
                );
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Rolling damage with formula: ${formula}`,
                    {
                        isCritical,
                        actor: actor.name,
                        weapon: weapon.name,
                    }
                );
            }

            // Create the roll
            const roll = await new Roll(formula, weaponRollData).evaluate({
                async: true,
            });

            // Create the message
            const speaker = ChatMessage.getSpeaker({ actor });
            const messageData = {
                flavor: isCritical
                    ? `${actor.name} - ${game.i18n.localize(
                          "DCC.Damage"
                      )} (${game.i18n.localize("DCC.CriticalHit")})`
                    : `${actor.name} - ${game.i18n.localize("DCC.Damage")}`,
                speaker: speaker,
                sound: CONFIG.sounds.dice,
            };

            // Add damage application button if enabled
            const canApplyDamage = game.settings.get(
                "dcc-qol",
                "automateDamageApply"
            );
            if (canApplyDamage) {
                messageData.flags = {
                    "dcc-qol": {
                        type: "damage",
                        damage: roll.total,
                    },
                };
            }

            // Create the message
            return await roll.toMessage(messageData);
        } catch (error) {
            console.error("DCC-QOL | Error rolling damage:", error);
            ui.notifications.error(
                game.i18n.localize("DCC-QOL.ErrorRollingDamage")
            );
        }
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
    static async _handleFriendlyFire(actor, weapon) {
        const roll = new Roll("d100");
        await roll.evaluate({ async: true });

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
     * Roll a fumble die and look up the result
     * @param {Actor} actor - The actor rolling the fumble
     * @private
     */
    static async _rollFumble(actor) {
        if (!actor) {
            console.error("DCC-QOL | Cannot roll fumble: No actor provided");
            return;
        }

        try {
            // Get the fumble die from the actor's system data
            const fumbleDie = actor.system.attributes?.fumble?.die || "1d4";
            if (game.settings.get("dcc-qol", "log")) {
                console.log(`DCC-QOL | Rolling fumble with die: ${fumbleDie}`);
            }

            // Create the roll
            const roll = await new Roll(fumbleDie).evaluate({ async: true });

            // Create the message - the system will handle looking up the result
            const messageData = {
                flavor: game.i18n.localize("DCC.Fumble"),
                speaker: ChatMessage.getSpeaker({ actor }),
                // Add the author ID explicitly for v12+ compatibility
                author: game.user.id,
                flags: {
                    "dcc-qol": { type: "fumble", actorId: actor.id },
                },
            };

            // Create the roll message - the system will handle looking up the result
            await roll.toMessage(messageData);

            // No need to look up the result ourselves - the system will handle it
        } catch (error) {
            console.error("DCC-QOL | Error rolling fumble:", error);
            ui.notifications.error(
                `${game.i18n.localize("DCC-QOL.ErrorRollingFumble")}: ${
                    error.message
                }`
            );
        }
    }

    /**
     * Roll a critical hit and display the result
     * @param {Actor} actor - The actor
     * @param {Item} weapon - The weapon item
     * @private
     */
    static async _rollCritical(actor, weapon) {
        if (!actor) {
            console.error(
                "DCC-QOL | Cannot roll critical hit: No actor provided"
            );
            return;
        }

        try {
            // Get the crit die & table from the actor's system data
            const critDie = actor.system.attributes?.critical?.die || "1d24";
            const critTable = this._getCriticalTable(actor, weapon);

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Rolling critical hit with die: ${critDie}`,
                    {
                        critTable,
                        actor: actor.name,
                        weapon: weapon?.name,
                    }
                );
            }

            // Create the roll - apply luck modifier for PCs if applicable
            let formula = critDie;
            if (actor.type === "Player" && actor.system.abilities?.lck?.mod) {
                const luckMod = parseInt(actor.system.abilities.lck.mod) || 0;
                formula = `${critDie}+${luckMod}`;
            }

            // Roll the crit die
            const roll = await new Roll(formula).evaluate({ async: true });

            // Create the roll message
            const messageData = {
                speaker: ChatMessage.getSpeaker({ actor }),
                // Add the author ID explicitly for v12+ compatibility
                author: game.user.id,
                flavor: `Critical (${critTable.replace("Crit Table ", "")})`,
                flags: {
                    "dcc-qol": {
                        type: "crit",
                        actorId: actor.id,
                        weaponId: weapon?.id || null,
                    },
                },
            };

            // Create the roll message - the system will handle looking up the result
            await roll.toMessage(messageData);

            // No need to look up the result ourselves - the system will handle it
        } catch (error) {
            console.error("DCC-QOL | Error rolling critical hit:", error);
            ui.notifications.error(
                game.i18n.localize("DCC-QOL.ErrorRollingCriticalHit")
            );
        }
    }

    /**
     * Handle damage message
     */
    static async _handleDamageMessage(message) {
        // Skip if auto-apply is not enabled
        if (!game.settings.get("dcc-qol", "automateDamageApply")) return;

        // Check if this is a damage message
        if (message.flavor !== "Damage" || !message.rolls?.length) return;

        // Get the damage amount
        const damageTotal = message.rolls[0].total;

        // Get the target(s)
        const targets = game.user.targets;
        if (!targets.size) return;

        // Apply damage to each target
        for (const target of targets) {
            await this._applyDamageToTarget(target, damageTotal);
        }
    }

    /**
     * Apply damage to target
     */
    static async _applyDamageToTarget(target, damageAmount) {
        try {
            const actor = target.actor;
            if (!actor) {
                console.warn("DCC-QOL | No actor found for target", target.id);
                return;
            }

            // Verify we have permission to modify this actor
            if (!actor.isOwner && !game.user.isGM) {
                console.warn(
                    `DCC-QOL | User lacks permission to modify ${actor.name}`
                );
                return;
            }

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Applying ${damageAmount} damage to ${actor.name}`,
                    {
                        currentHP: actor.system.attributes.hp.value,
                        maxHP: actor.system.attributes.hp.max,
                    }
                );
            }

            // Get current HP
            const hp = actor.system.attributes.hp;
            const newValue = Math.max(0, hp.value - damageAmount);

            // Update the actor
            await actor.update({
                "system.attributes.hp.value": newValue,
            });

            // Visual feedback
            this._createDamageVisualEffect(target, damageAmount);

            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Damage applied: ${actor.name} HP ${hp.value} → ${newValue}`
                );
            }
        } catch (error) {
            console.error(
                "DCC-QOL | Error applying damage to target:",
                error,
                target
            );
        }
    }

    /**
     * Create damage visual effect
     */
    static _createDamageVisualEffect(target, amount) {
        // Create damage number floating up
        canvas.interface.createScrollingText(target.center, `-${amount}`, {
            anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
            fontSize: 36,
            fill: "red",
            stroke: 0x000000,
            strokeThickness: 4,
        });
    }

    /**
     * Get the appropriate critical hit table based on actor and weapon
     * @param {Actor} actor - The actor
     * @param {Item} weapon - The weapon (optional)
     * @returns {string} The critical hit table name
     * @private
     */
    static _getCriticalTable(actor, weapon) {
        // First check if the weapon specifies a table
        if (weapon && weapon.system?.critTable) {
            return `Crit Table ${weapon.system.critTable}`;
        }

        // Then check the actor's default crit table
        const actorTable = actor?.system?.attributes?.critical?.table || "III";
        return `Crit Table ${actorTable}`;
    }

    /**
     * Handle damage action button clicks
     * @param {Actor} actor - The actor
     * @param {Item} weapon - The weapon item
     * @param {boolean} isCrit - Whether this is a critical hit damage roll
     * @returns {Promise<string>} The message content
     * @private
     */
    static async _handleDamageAction(actor, weapon, isCrit = false) {
        if (!actor) {
            console.error("DCC-QOL | Cannot roll damage: No actor provided");
            return null;
        }

        if (!weapon) {
            console.error("DCC-QOL | Cannot roll damage: No weapon provided");
            return null;
        }

        try {
            // Roll damage, specifying if it's a critical hit
            return await this._rollDamage(actor.id, weapon.id, isCrit);
        } catch (error) {
            console.error("DCC-QOL | Error handling damage action:", error);
            ui.notifications.error(
                game.i18n.localize("DCC-QOL.ErrorRollingDamage")
            );
            return null;
        }
    }

    /**
     * Check if a weapon has the friendly fire risk property
     * @param {Item} weapon - The weapon to check
     * @returns {boolean} Whether the weapon has friendly fire risk
     * @private
     */
    static _weaponHasFriendlyFireRisk(weapon) {
        if (!weapon) return false;

        const properties = getWeaponProperties(weapon);
        return properties.includes("friendlyFire");
    }
}
