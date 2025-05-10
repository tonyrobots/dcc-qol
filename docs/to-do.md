Overall Goal:
Convert this dcc-qol Foundry VTT module from one that works based on overrides of the core DCC-RPG system functions, and instead is event based, listening for hooks from the system and reacting accordingly.

Methodology:
We will implement the legacy features (as appropriate) one by one, using the new hooks-based approach, replacing the code in patch.js, chat.js, etc, with hook-based implementations in hooks/ directory. As we complete items in the to-do section, add check marks next to completed items. Each implementation step must include corresponding unit tests.

Keep the code cleanly organized and well documented, in a format that's amenable to autodocumentation.

To do:

[x] fix attack card for NPCs -- looks like a problem where if the weapon only exists on the token, there is a dcc-qol error, and the rendering is handled by the system instead

[x] fix crit table display/crit table lookup

-   automatically apply damage
-   clean up overly verbose logging
-   range check/penalties
-   clean up settings
-   lucky weapon bonus?
-   fix Error: The async option for Roll#evaluate has been removed. Use Roll#evaluateSync for synchronous roll evaluation.
