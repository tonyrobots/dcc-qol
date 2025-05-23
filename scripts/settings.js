/* global game */
export const registerSettings = async function () {
    /**
     * Use QoL Attack Card
     * Use the QoL Attack Card for attack rolls
     */
    game.settings.register("dcc-qol", "useQoLAttackCard", {
        name: "DCC-QOL.SettingUseQoLAttackCard",
        hint: "DCC-QOL.SettingUseQoLAttackCardHint",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
    });
    /**
     * Automate damage apply
     */
    game.settings.register("dcc-qol", "automateDamageApply", {
        name: "DCC-QOL.SettingAutomateDamageApply",
        hint: "DCC-QOL.SettingAutomateDamageApplyHint",
        scope: "world",
        type: Boolean,
        default: false,
        config: true,
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
        default: false,
        config: true,
    });

    /**
     * Automatically add Firing into Melee penalty
     * Add a -1 penalty when firing a missile weapon into melee
     */
    game.settings.register("dcc-qol", "automateFiringIntoMeleePenalty", {
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
     * Automatically apply lucky weapon modifier
     * For classes with lucky weapons (e.g. Warriors & Dwarves, set in config.js), automatically apply the lucky weapon modifier (as specified) to the attack roll.
     */
    game.settings.register("dcc-qol", "automateLuckyWeaponModifier", {
        name: "DCC-QOL.SettingAutomateLuckyWeaponModifier",
        hint: "DCC-QOL.SettingAutomateLuckyWeaponModifierHint",
        scope: "world",
        type: String,
        default: "standard",
        choices: {
            // none: "DCC-QOL.SettingAutomateLuckyWeaponModifierNone",
            standard: "DCC-QOL.SettingAutomateLuckyWeaponModifierStandard",
            plus1: "DCC-QOL.SettingAutomateLuckyWeaponModifierPlus1",
            positive: "DCC-QOL.SettingAutomateLuckyWeaponModifierPositive",
        },
        config: true,
        onChange: (value) => {
            // value is the new value of the setting
            // warn if dcc automate lucky is not enabled
            if (!game.settings.get("dcc", "automateLuckyWeaponAttack")) {
                ui.notifications.warn(
                    game.i18n.localize(
                        "DCC-QOL.AutomateLuckyWeaponsNotEnabledWarning"
                    )
                );
            }
        },
    });

    /**
     * Check weapon's range and if target is out of range, or would incur a penalty, UI warning/confirmation dialog appears
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
};
