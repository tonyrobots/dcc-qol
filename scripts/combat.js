// Combat-related functionality for DCC-QOL
import {
    measureTokenDistance,
    checkFiringIntoMelee,
    getWeaponProperties,
} from "./utils.js";

export class DCCQOLCombat {
    static async onPreUpdateActor(actor, changes, options, userId) {
        // Handle pre-update actor changes (e.g., HP modifications)
        if (!changes.system?.attributes?.hp) return;
        // Additional HP change handling logic here
    }

    static async onWeaponAttack(wrapped, weaponId, options = {}) {
        try {
            // Get the actor's token
            const tokenD = this.token ?? this.getActiveTokens()[0]?.document;

            // Check weapon range if enabled
            if (game.settings.get("dcc-qol", "checkWeaponRange")) {
                if (!tokenD) {
                    ui.notifications.warn(
                        game.i18n.localize("DCC-QOL.ControlAToken")
                    );
                    return null;
                }

                const weapon = this.items.get(weaponId);
                if (!weapon) return wrapped(weaponId, options);

                if (game.user.targets.size > 0) {
                    const target = game.user.targets.first();
                    const distance = await measureTokenDistance(
                        tokenD,
                        target.document
                    );

                    // Check melee range
                    if (
                        weapon.system.melee &&
                        distance > game.canvas.scene.grid.distance
                    ) {
                        ui.notifications.warn(
                            game.i18n.format("DCC-QOL.WeaponMeleeWarn", {
                                distance,
                                units: game.scenes.active.grid.units,
                            })
                        );
                        return null;
                    }

                    // Check ranged weapon
                    if (!weapon.system.melee) {
                        const [short, medium, long] = weapon.system.range
                            .split("/")
                            .map(Number);

                        if (distance > long) {
                            ui.notifications.warn(
                                game.i18n.format("DCC-QOL.WeaponRangedWarn", {
                                    distance,
                                    units: game.scenes.active.grid.units,
                                    weapon: weapon.name,
                                    range: long,
                                })
                            );
                            return null;
                        }

                        // Apply range penalties
                        if (distance > medium) {
                            options.dieStep = -1; // Long range penalty
                        } else if (distance > short) {
                            options.rangePenalty = -2; // Medium range penalty
                        }

                        // Check for firing into melee
                        if (
                            game.settings.get(
                                "dcc-qol",
                                "automateFriendlyFirePenalty"
                            )
                        ) {
                            const inMelee = await checkFiringIntoMelee(
                                target.document
                            );
                            if (inMelee) {
                                options.firingIntoMelee = true;
                                options.meleePenalty = -1;
                            }
                        }
                    }
                }
            }

            // Call the original method with our modified options
            const result = await wrapped(weaponId, options);
            if (!result) return null;

            // Post-roll modifications if needed
            if (
                result.roll &&
                game.settings.get("dcc-qol", "automateDeedDieRoll")
            ) {
                // Handle deed die automation
                const deedDie = this.system.details.attackBonus;
                if (deedDie) {
                    // Add deed die modifications to the result
                    result.deedDie = deedDie;
                    // The actual deed die roll will be handled in chat message creation
                }
            }

            return result;
        } catch (error) {
            console.error("DCC-QOL | Error in onWeaponAttack:", error);
            // Return the original call result in case of error
            return wrapped(weaponId, options);
        }
    }

    static async onRollAttack(actor, roll, weapon, options) {
        // Handle post-attack roll modifications
        // This is where we can add our custom attack roll handling
    }

    static async onPreRollDamage(actor, weapon, options) {
        // Modify damage roll before it happens
    }

    static async onRollDamage(wrapped, weapon, options = {}) {
        const result = await wrapped(weapon, options);
        if (!result) return null;

        if (game.settings.get("dcc-qol", "automateDamageApply")) {
            const target = game.user.targets.first();
            if (!target) return result;

            // Wait for dice animations if using Dice So Nice
            if (game.modules.get("dice-so-nice")?.active) {
                await game.dice3d?.waitFor3DAnimationByMessageID(
                    result.roll.id
                );
            }

            // Apply damage through socket
            if (game.modules.get("socketlib")?.active) {
                const socket = socketlib.registerModule("dcc-qol");
                await socket.executeAsGM(
                    "applyDamage",
                    target.document.uuid,
                    result.total
                );
            }
        }

        return result;
    }

    static async onRollCritical(wrapped, options = {}) {
        if (game.settings.get("dcc-qol", "automateMonsterCritLuck")) {
            const target = game.user.targets.first();
            if (
                target &&
                this.type === "NPC" &&
                target.actor.type === "Player"
            ) {
                // Apply luck modifications for crits
                const luckMod = target.actor.system.abilities.lck.mod;
                options.luckMod = luckMod * -1;
            }
        }

        return wrapped(options);
    }

    static async applyDamage(tokenUuid, damage) {
        const token = await fromUuid(tokenUuid);
        if (!token) return;

        const currentHP = token.actor.system.attributes.hp.value;
        await token.actor.update({
            "system.attributes.hp.value": Math.max(0, currentHP - damage),
        });
    }
}
