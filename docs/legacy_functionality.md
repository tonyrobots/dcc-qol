# DCC Quality of Life (QoL) Module - Legacy Functionality

## Overview

This document outlines the features provided by the DCC Quality of Life (QoL) module based on the codebase analysis performed on 5/3/25. The module primarily enhances the Dungeon Crawl Classics (DCC) system's weapon attack workflow within Foundry VTT by automating various checks, calculations, and improving chat card feedback. It requires the `libWrapper` and `socketlib` modules to function.

## Core Feature: Enhanced Weapon Attack Roll (`rollWeaponAttackQOL`)

This is the central feature, patching the default `game.dcc.DCCActor.prototype.rollWeaponAttack` method. It orchestrates several sub-features:

1.  **Weapon Lookup:** Finds the weapon being used by ID, name, or inventory slot (e.g., `m1`, `r2`). Warns if the weapon is not found or not equipped (if the core DCC setting `checkWeaponEquipment` is enabled).
2.  **To-Hit Roll Calculation (`rollToHitQOL`):** Calculates the actual attack roll, incorporating numerous optional modifiers and automations (detailed below).
3.  **Deed Die Automation (Setting: `automateDeedDieRoll`):**
    -   If enabled for appropriate classes (Warrior, Dwarf, Elf) or if `lastRolledAttackBonus` is manually set:
        -   Extracts the deed die type (e.g., d3, d4) from the actor's Attack Bonus field (e.g., `+d3`).
        -   Includes the deed die roll directly within the attack roll calculation (replacing `@ab`).
        -   Stores the _result_ of the deed die roll in the actor's `system.details.lastRolledAttackBonus` field after the roll (waits for Dice So Nice animation if active).
        -   Displays the deed die result on the chat card, colored green if 3 or higher.
    -   If disabled, uses the value _manually entered_ in the `system.details.lastRolledAttackBonus` field for display purposes only (does not affect the attack roll itself unless `@ab` is still in the weapon's `toHit` formula).
4.  **Targeting Requirement:** Requires a single token to be targeted for most automated checks. Warns if zero or multiple targets are selected.
5.  **Range Check (Setting: `checkWeaponRange`):**
    -   Requires a controlled token and a single target.
    -   Calculates distance between attacker and target using DCC diagonal rules and accounting for token size (`measureTokenDistance`).
    -   **Melee:** Warns if the target is further than 1 grid unit away.
    -   **Ranged:**
        -   Warns if the target is beyond the weapon's maximum range (e.g., > 150ft for `50/100/150`).
        -   Applies a `-2` penalty to the attack roll if the target is at Medium range (between short and long, e.g., > 50ft and <= 100ft).
        -   Applies a `-1D` step penalty (e.g., d20 -> d16) to the action die if the target is at Long range (between medium and max, e.g., > 100ft and <= 150ft).
6.  **Hit Determination:** Compares the final attack roll total (`hitsAc`) against the target's AC.
7.  **Friendly Fire Check (Setting: `automateFriendlyFire`):**
    -   Requires a controlled token and a single target.
    -   If a _ranged_ attack _misses_ the target:
        -   Checks if any allied token is adjacent (<= 5ft) to the _target_ token (`checkFiringIntoMelee`).
        -   Flags `friendlyFire` as true if an ally is adjacent. This is used for display on the chat card; it does not automatically apply damage or effects.
8.  **Custom Chat Card (`attackroll-card.html`):**
    -   Displays a detailed chat message for the attack.
    -   Includes: Attacker, Weapon Name, Weapon Properties (Melee/Ranged, Range, Equipped, Trained, Two-Handed, Backstab status).
    -   Shows the roll formula and result, clearly indicating Crits and Fumbles.
    -   Displays the calculated AC Hit value (`hitsAc`).
    -   **Hit/Miss Display (Setting: `DisplayHitMiss`):** If enabled, shows whether the attack hit or missed the specific targeted token.
    -   Shows the Deed Die roll result (if applicable).
    -   Indicates if Friendly Fire was possible (see point 7).
    -   Provides buttons (handled by `chat.js`) to roll Damage, Crit, or Fumble effects based on the attack result.

## Supporting Features & Automations

These features support the main attack roll or provide other enhancements:

1.  **To-Hit Calculation Modifiers (`rollToHitQOL`):**
    -   **Untrained Weapon Penalty (Core Setting: `automateUntrainedAttack`):** Applies a `-1D` step penalty to the action die if using an untrained weapon.
    -   **Backstab Bonus:** Adds the character's backstab die value if the backstab option was chosen.
    -   **Ability Modifier (Core Setting: `automateCombatModifier`):** Adds Strength mod for melee or Agility mod for ranged attacks.
    -   **Firing into Melee Penalty (Setting: `automateFiringIntoMeleePenalty`):** Applies a `-1` penalty to _ranged_ attacks if the target is adjacent to an ally (`checkFiringIntoMelee`).
    -   **Lucky Weapon Bonus (Core + QoL Settings):** For specific classes (`Halfling`), if using their defined Lucky Weapon and the core `automateLuckyWeaponAttack` setting is on, adds a bonus based on the QoL `automateLuckyWeaponModifier` setting:
        -   `standard`: Full Luck modifier.
        -   `plus1`: Flat +1 bonus.
        -   `positive`: Luck modifier, minimum 0.
        -   `none`: No bonus applied by this feature.
2.  **Critical Hit Automation (`rollCriticalQOL`):**
    -   Triggered from the attack chat card's "Crit" button.
    -   Rolls the actor's critical die (`system.attributes.critical.die`).
    -   **Player Crits:** Adds the player's Luck modifier.
    -   **NPC Crits (Setting: `automateMonsterCritLuck`):** If enabled, _subtracts the target's Luck modifier_ instead of adding the NPC's own Luck. If disabled or no target, uses the NPC's Luck mod (or 0 if none).
    -   Looks up the result on the appropriate Critical Hit table compendium (`Crit Table X`).
    -   Displays the result in chat, either from the table draw or just the die roll if no table is found/used.
3.  **Fumble Handling:** The attack chat card provides a "Fumble" button, likely linked to rolling on the Fumble table (implementation details assumed to be standard DCC system functionality triggered via `chat.js`).
4.  **Chat Card Interactivity (`chat.js`):** Adds listeners to the custom attack roll chat cards to handle clicks on the Damage, Crit, and Fumble buttons, triggering the appropriate subsequent actions (rolling damage, calling `rollCriticalQOL`, etc.).
5.  **Configuration Settings (`settings.js`):** Registers various module settings in the Foundry VTT settings menu to allow users to enable/disable or configure the behavior of the automated features listed above.
6.  **Distance Measurement (`measureTokenDistance`):** Utility function to calculate grid distance between two tokens accurately according to DCC rules (diagonals = 1 unit) and token size.
7.  **Check Firing into Melee (`checkFiringIntoMelee`):** Utility function to determine if a target token has any allied tokens adjacent to it.
8.  **Debug Logging (Setting: `log`):** If enabled, outputs detailed information about roll calculations and modifiers to the developer console (F12) for GM users.

## Required Dependencies

-   **libWrapper:** Used for patching the core `DCCActor.rollWeaponAttack` method non-destructively.
-   **socketlib:** Used for inter-user communication, likely related to chat message updates or actions triggered from chat cards.

## Missing Documentation/Areas for Clarification

-   Detailed functionality of `chat.js` (button handling logic).
-   Specific implementation of damage rolls triggered from the chat card.
-   Exact lists defined in `config.js` (`DEED_DIE_CLASSES`, `LUCKY_WEAPON_CLASSES`).
-   Precise socket events used by `socketlib`.
