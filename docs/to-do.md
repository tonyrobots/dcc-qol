Project Structure is in @docs/project_structure.md

## Active Tasks

### Core Features & Enhancements

-   [ ] Lucky weapon bonus? - hold for subsequent release?

### Bugs to Fix

-   [ ] Properties set in range check aren't making it through to `prepareQolData`, check flow of data. Look at adding logical data, e.g. range value, penalty applied, and then adding conditional logic on the `attackroll` hook to figure out how to present that (logically separating the two parts).

## Non-Core Future Tasks

-   [ ] With character sheet in focus, if clipboard contains an image, on paste action, open a dialog asking if the user wants to set the character portrait and/or the token image to the pasted image

## Possible Features

1. **"Burn Luck" button on misses and other failures.** Offer option to burn luck to improve a failed attack (or other) roll. Player is prompted to enter how many points of luck they want to burn, and the value is added to the roll. (Rolling the value in the case of a thief, for whom each luck point burned is worth 1d3.) As a GM controlled option, for misses, the button can automatically default to the necessary number to turn the miss into a hit (or recommended in the case of a thief, given average roll values).

2. **Ammunition support.** Add ammunition item type. Add ability to associate ammunition with a ranged weapon. Auto-decrement ammo when firing. Allow re-collection of ammo (50% is considered to be recoverable) at the end of fight.

3. **Add bonus support on items** (including ammo). Equipped items (or fired ammo) can apply bonuses. Add bonus field to items. Will need to define syntax for this bonus field. e.g. ring of robustness: `AC:+1,Will:+1,Fort:+1`

4. **Automate player "death".** When a PC level 1+ hits ≤0 hit points, they get the status "bleeding out". Show a chat card indicating this event, and explaining the rule. This status lasts until the end of the next round. If the player isn't healed before the end of the next round, they gain the status "Possibly Dead." (Healing applied to a player with less than 0 HP can be considered to be starting at 0 HP, e.g. applying 10HP healing to a PC with -5 HP, yields 10HP.) If the player is "possibly dead", show a chat card announcing this, with a "Recover the Body" button. "Recover the body" rules: "possibly dead" player rolls a luck check (luck or less). If successful, they lose "possibly dead" status, and survive with 1 HP, and get the "groggy" status; if failed, offer the option to burn luck to improve their roll (if possible), but if not, they get the status "dead". PCs who were either healed during "bleeding out", or successfully "recovered the body" suffer a permanent injury. Offer roll on (to be created) injury table. (A 0-level PC simply dies at 0 HP.)

5. **PC-attached bonuses/maluses system** (Originally "scars" system). Generalized system to record PC-applied bonuses and maluses of all types. Attributes would include:

    - **Description:** e.g. "Scar that stretches from the left ear to the corner of his mouth", "Justicia's Blessing", "Massive Hangover"
    - **Duration:** e.g. permanent, 2 days, until a critical success is achieved (not automated, just a note)
    - **Effect(s) formula:** This would use the same bonus/malus formula subsystem as mentioned for items (see #6 below). It would support a formula like `AC:-1, STR:-1, fort:-2` (need to work out the right syntax.)

6. **Bonus/Malus formula subsystem.** A generalized subsystem for handling bonuses and maluses that can be applied to items, PC conditions, spells, etc. This would define the syntax and processing logic for bonus formulas used in features #3 and #5 above.

7. **Prompt to select target.** If no target is currently selected, before an attack roll is made, present a selection list for the player to choose from. Should only include tokens of the appropriate disposition (by default, though you could remove this filter), and only tokens that are visible to the token (based on the system/Foundry's determination)

8. **Rest button** Automated rest function to heal, restore spellburned stats, thieves regenerate luck, reduce disapproval, etc. Button on PC character sheet; possibly a GM-available button or command to apply to full party?

## Completed Tasks

### Core Features & Enhancements (Recently Completed)

-   [x] Apply players Luck score against monsters' crit roll. If an actor targeting a Player gets a critical hit, subtract the players luck modifier from the attacker's crit roll.
-   [x] Backstab improvements/fixes. Add appropriate "backstab" messaging for backstabs in attack roll cards. no crit on misses.
-   [x] Clean up settings
-   [x] Clean up overly verbose logging
-   [x] Clean up `en.json`, and make sure strings are represented in `pt-br.json`
-   [x] Create `es.json`, `fr.json`, `de.json`?
-   [x] Set up unit testing infrastructure (Jest, Vitest, or similar)
-   [x] Implement unit testing

### Small fixes/tweaks (Recently Completed)

-   [x] Add more color to chat card buttons to make them more obviously buttons.

### Bugs Fixed (Recently Completed)

-   [x] Fix Error: The async option for Roll#evaluate has been removed. Use Roll#evaluateSync for synchronous roll evaluation.
-   [x] Check rolltable (fumbles/crits) on tempo PC main install
-   [x] Crit and fumble button doesn't disappear when clicked by player clients.

### Earlier Completed Tasks

-   [x] Fix attack card for NPCs -- looks like a problem where if the weapon only exists on the token, there is a dcc-qol error, and the rendering is handled by the system instead
-   [x] Fix crit table display/crit table lookup
-   [x] Automatically apply damage
-   [x] Range check/penalties:
    -   Functional specification:
        -   **Range Check (Setting: `checkWeaponRange`):** (from settings.js) - Requires a controlled token and a single target.
        -   Calculates distance between attacker and target using DCC diagonal rules and accounting for token size (`measureTokenDistance`). (from utils.js)
        -   **Melee:** Warns if the target is further than 1 grid unit away.
        -   **Ranged:**
            -   Warns if the target is beyond the weapon's maximum range (e.g., > 150ft for `50/100/150`).
            -   Applies a `-2` penalty to the attack roll if the target is at Medium range (between short and long, e.g., > 50ft and <= 100ft).
            -   Applies a `-1D` step penalty (e.g., d20 -> d16) to the action die if the target is at Long range (between medium and max, e.g., > 100ft and <= 150ft).
-   [x] Doesn't respect dcc system setting to roll damage, crits, fumbles at same time as attack roll.
-   [x] Any crit should be a hit, regardless of AC
-   [x] Make sure all settings are respected, and various combinations work correctly
-   [x] Streamline and simplify `handleAutomatedDamageApplication()` function
