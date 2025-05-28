Overall Goal:
Convert this dcc-qol Foundry VTT module from one that works based on overrides of the core DCC-RPG system functions, and instead is event based, listening for hooks from the system and reacting accordingly.

Methodology:
We will implement the legacy features (as appropriate) one by one, using the new hooks-based approach, replacing the code in patch.js, chat.js, etc, with hook-based implementations in hooks/ directory. As we complete items in the to-do section, add check marks next to completed items. Each implementation step must include corresponding unit tests.

Keep the code cleanly organized and well documented, in a format that's amenable to autodocumentation.

Project Structure is in @docs/project_structure.md

## Active Tasks

### Core Features & Enhancements

-   [ ] Apply players Luck score against monsters' crit roll. If an actor targeting a Player gets a critical hit, subtract the players luck modifier from the attacker's crit roll.
-   [x] Backstab improvements/fixes. Add appropriate "backstab" messaging for backstabs in attack roll cards. no crit on misses.
-   [ ] Clean up settings
-   [ ] Lucky weapon bonus? - hold for subsequent release?
-   [ ] Clean up overly verbose logging
-   [ ] Clean up `en.json`, and make sure strings are represented in `pt-br.json`
-   [ ] Create `es.json`, `fr.json`, `de.json`?
-   [ ] Implement unit testing

### Small fixes/tweaks

-   [x] Add more color to chat card buttons to make them more obviously buttons.

### Bugs to Fix

-   [x] Fix Error: The async option for Roll#evaluate has been removed. Use Roll#evaluateSync for synchronous roll evaluation.
-   [ ] Properties set in range check aren't making it through to `prepareQolData`, check flow of data. Look at adding logical data, e.g. range value, penalty applied, and then adding conditional logic on the `attackroll` hook to figure out how to present that (logically separating the two parts).
-   [ ] Check rolltable (fumbles/crits) on tempo PC main install

## Non-Core Future Tasks

-   [ ] With character sheet in focus, if clipboard contains an image, on paste action, open a dialog asking if the user wants to set the character portrait and/or the token image to the pasted image

## Completed Tasks

-   Fix attack card for NPCs -- looks like a problem where if the weapon only exists on the token, there is a dcc-qol error, and the rendering is handled by the system instead
-   Fix crit table display/crit table lookup
-   Automatically apply damage
-   Range check/penalties:
    -   Functional specification:
        -   **Range Check (Setting: `checkWeaponRange`):** (from settings.js) - Requires a controlled token and a single target.
        -   Calculates distance between attacker and target using DCC diagonal rules and accounting for token size (`measureTokenDistance`). (from utils.js)
        -   **Melee:** Warns if the target is further than 1 grid unit away.
        -   **Ranged:**
            -   Warns if the target is beyond the weapon's maximum range (e.g., > 150ft for `50/100/150`).
            -   Applies a `-2` penalty to the attack roll if the target is at Medium range (between short and long, e.g., > 50ft and <= 100ft).
            -   Applies a `-1D` step penalty (e.g., d20 -> d16) to the action die if the target is at Long range (between medium and max, e.g., > 100ft and <= 150ft).
-   Doesn't respect dcc system setting to roll damage, crits, fumbles at same time as attack roll.
-   Any crit should be a hit, regardless of AC
-   Make sure all settings are respected, and various combinations work correctly
