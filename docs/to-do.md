Overall Goal:
Convert this dcc-qol Foundry VTT module from one that works based on overrides of the core DCC-RPG system functions, and instead is event based, listening for hooks from the system and reacting accordingly.

Methodology:
We will implement the legacy features (as appropriate) one by one, using the new hooks-based approach, replacing the code in patch.js, chat.js, etc, with hook-based implementations in hooks/ directory. As we complete items in the to-do section, add check marks next to completed items. Each implementation step must include corresponding unit tests.

Keep the code cleanly organized and well documented, in a format that's amenable to autodocumentation.

Project Structure is in @docs/project_structure.md

To do:

[x] fix attack card for NPCs -- looks like a problem where if the weapon only exists on the token, there is a dcc-qol error, and the rendering is handled by the system instead

[x] fix crit table display/crit table lookup

[x] automatically apply damage

-   range check/penalties:
    functional specification:
    **Range Check (Setting: `checkWeaponRange`):** (from settings.js) - Requires a controlled token and a single target. - Calculates distance between attacker and target using DCC diagonal rules and accounting for token size (`measureTokenDistance`). (from utils.js) - **Melee:** Warns if the target is further than 1 grid unit away. - **Ranged:** - Warns if the target is beyond the weapon's maximum range (e.g., > 150ft for `50/100/150`). - Applies a `-2` penalty to the attack roll if the target is at Medium range (between short and long, e.g., > 50ft and <= 100ft). - Applies a `-1D` step penalty (e.g., d20 -> d16) to the action die if the target is at Long range (between medium and max, e.g., > 100ft and <= 150ft).

Note/bug to fix: Properties set in range check aren't making it through to prepareQolData, check flow of data. Look at adding logical data, e.g. range value, penalty applied, and then adding conditional logic on the attackroll hook to figure out how to present that (logically separating the two parts)

-   Apply players Luck score against monsters' crit roll
-   clean up settings
-   lucky weapon bonus?
-   fix Error: The async option for Roll#evaluate has been removed. Use Roll#evaluateSync for synchronous roll evaluation.
-   make sure all settings are respected, and various combinations work correctly
-   clean up overly verbose logging
-   clean up en.json, and make sure strings are represented in pt-br.json
-   create es.json, fr.json, de.json?
-   implement unit testing

non-core

-   with character sheet in focus, if clipboard contains an image, on paste action, open a dialog asking if the user wants to set the character portrait and/or the token image to the pasted image
