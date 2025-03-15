/* global game */
export function registerSettings() {
    /**
     * Automate damage apply
     */
    game.settings.register("dcc-qol", "automateDamageApply", {
        name: game.i18n.localize("DCC-QOL.Settings.EnableApplyDamage"),
        hint: game.i18n.localize("DCC-QOL.Settings.EnableApplyDamageHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
    });

    /**
     * Manual damage apply hint
     */
    game.settings.register("dcc-qol", "takeDamageManual", {
        name: "DCC-QOL.SettingTakeDamageManual",
        hint: "DCC-QOL.SettingTakeDamageManualHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
    });

    /**
     * Automate Deed Die Roll for warrior/dwarf attacks
     */
    game.settings.register("dcc-qol", "automateDeedDieRoll", {
        name: "Automate Deed Die Roll",
        hint: "Automatically roll the deed die when making an attack roll.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
    });

    /**
     * Automatically check Friendly Fire
     * Firing a missile weapon into melee 50% chance of "friendly fire" if attack misses; see page 96.
     */
    game.settings.register("dcc-qol", "automateFriendlyFire", {
        name: "DCC-QOL.SettingAutomateFriendlyFire",
        hint: "DCC-QOL.SettingAutomateFriendlyFireHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
    });

    /**
     * Automatically add Firing into Melee penalty
     * Add a -1 penalty when firing a missile weapon into melee
     */
    game.settings.register("dcc-qol", "automateFriendlyFirePenalty", {
        name: "DCC-QOL.SettingFiringIntoMeleePenalty",
        hint: "DCC-QOL.SettingFiringIntoMeleePenaltyHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
    });

    /**
     * Automatically adjust monster's critical hit.
     * A positive Luck modifier reduces the monster's roll, whereas a negative modifier grants a bonus to the monster's critical hit roll.
     */
    game.settings.register("dcc-qol", "automateMonsterCritLuck", {
        name: "DCC-QOL.SettingAutomateMonsterCritLuck",
        hint: "DCC-QOL.SettingAutomateMonsterCritLuckHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
    });

    /**
     * Display hit/miss on attack chat card
     */
    game.settings.register("dcc-qol", "DisplayHitMiss", {
        name: "Display Hit/Miss",
        hint: "Display whether an attack hits or misses in the chat message.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
    });

    /**
     * Automatically apply lucky weapon modifier
     * For classes with lucky weapons (e.g. Warriors & Dwarves), automatically apply the lucky weapon modifier
     */
    game.settings.register("dcc-qol", "automateLuckyWeaponModifier", {
        name: "DCC-QOL.SettingAutomateLuckyWeaponModifier",
        hint: "DCC-QOL.SettingAutomateLuckyWeaponModifierHint",
        scope: "world",
        type: String,
        default: "standard",
        choices: {
            none: "DCC-QOL.SettingAutomateLuckyWeaponModifierNone",
            manual: "DCC-QOL.SettingAutomateLuckyWeaponModifierManual",
            standard: "DCC-QOL.SettingAutomateLuckyWeaponModifierStandard",
            plus1: "DCC-QOL.SettingAutomateLuckyWeaponModifierPlus1",
            positive: "DCC-QOL.SettingAutomateLuckyWeaponModifierPositive",
        },
        config: true,
    });

    /**
     * Check weapon's range and if target is beyond UI warning display appears and prevent rolls
     * Applies penalty for ranged weapons based on range
     */
    game.settings.register("dcc-qol", "checkWeaponRange", {
        name: "DCC-QOL.SettingWeaponRangeCheck",
        hint: "DCC-QOL.SettingWeaponRangeCheckHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
    });

    /**
     * Logging to console.log
     */
    game.settings.register("dcc-qol", "log", {
        name: game.i18n.localize("DCC-QOL.Settings.LogDebug"),
        hint: game.i18n.localize("DCC-QOL.Settings.LogDebugHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
    });

    // Debug settings for development
    game.settings.register("dcc-qol", "debugExplore", {
        name: "Debug - Explore Objects",
        hint: "Explore and log object structures to console when processing messages",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
    });

    game.settings.register("dcc-qol", "debugTargetMessage", {
        name: "Debug - Target Message ID",
        hint: "Enter a message ID to explore its structure (leave empty to disable)",
        scope: "client",
        config: true,
        type: String,
        default: "",
        onChange: (value) => {
            if (value && game.messages) {
                const message = game.messages.get(value);
                if (message) {
                    // Import dynamically to avoid circular dependency
                    import("./utils.js").then((utils) => {
                        utils.exploreObject(message, "Targeted Message", {
                            depth: 3,
                        });
                        if (message.rolls?.length) {
                            utils.exploreObject(
                                message.rolls[0],
                                "Message Roll",
                                { depth: 3 }
                            );
                        }
                    });
                } else {
                    ui.notifications.warn(`Message with ID ${value} not found`);
                }
            }
        },
    });
}
