Overall Goal:
Convert this dcc-qol Foundry VTT module from one that works based on overrides of the core DCC-RPG system functions, and instead is event based, listening for hooks from the system and reacting accordingly.

Methodology:
We will implement the legacy features (as appropriate) one by one, using the new hooks-based approach, replacing the code in patch.js, chat.js, etc, with hook-based implementations in hooks/ directory. As we complete items in the to-do section, add check marks next to completed items. Each implementation step must include corresponding unit tests.

Keep the code cleanly organized and well documented, in a format that's amenable to autodocumentation.

To do:

-   [ ] **Apply QoL Attack Card Styling:** Modify the attack roll chat message HTML to match the styling and content from legacy dcc-qol, including adding buttons to roll damage, roll critical hit, and roll fumble.

    -   _Setting:_ `applyQoLAttackCardStyling` (New Setting - Boolean, default true/false TBD). If false, leave core DCC styling untouched.
    -   _Primary Hook:_ `renderChatMessage`.
    -   _Legacy Ref:_ `templates/attackroll-card.html`, button listener logic in `chat.js`.
    -   _Unit Test:_ Verify card HTML structure changes correctly based on setting; verify buttons are added and have correct dataset attributes.

-   [ ] **Display Hit/Miss:** Read hit/miss status from the chat message data provided by the DCC system and display explicit "Hit" or "Miss" text on the attack chat card.

    -   _Setting:_ `DisplayHitMiss`.
    -   _Primary Hook:_ `renderChatMessage`, reading data flags/dataset from the message.
    -   _Legacy Ref:_ N/A (was previously calculated in `patch.js`, now just reading system data).
    -   _Unit Test:_ Verify "Hit"/"Miss" text appears correctly based on mock chat message data flags/dataset and the `DisplayHitMiss` setting.

-   [ ] **Auto-Apply Damage:** When the damage roll button on the attack card is clicked, automatically apply the rolled damage to the originally targeted token(s).

    -   _Setting:_ `automateDamageApply`.
    -   _Primary Hook:_ Likely involves listeners added to damage buttons (via `renderChatMessage` or `Hooks.on('renderChatPopout', ...)`) which then trigger damage application. Investigate DCC system hooks related to damage rolls or chat message updates for potential alternatives.
    -   _Legacy Ref:_ Damage application logic likely in `chat.js` button handlers.
    -   _Unit Test:_ Verify damage is correctly applied to target token(s) when button is clicked and setting is enabled; verify no damage applied if setting disabled.

-   [ ] **Apply Range Modifiers:** Add attack roll penalties based on weapon range increments compared to target distance.

    -   _Setting:_ `checkWeaponRange`.
    -   _Primary Hook:_ `dcc.modifyAttackRollTerms`.
    -   _Legacy Ref:_ `checkRangePenalty` logic within `rollWeaponAttackQOL` in `patch.js`.
    -   _Unit Test:_ Verify correct penalty term is added to the roll terms based on weapon range, target distance, and setting state. Test edge cases (within range, exactly at range threshold, beyond range).

-   [ ] **Apply Firing into Melee Penalty:** Add a -1 attack roll penalty if the attacker makes a ranged attack against a target engaged in melee with a friendly combatant.

    -   _Setting:_ `automateFiringIntoMeleePenalty`.
    -   _Primary Hook:_ `dcc.modifyAttackRollTerms` (requires analyzing target's combat engagement relative to other tokens).
    -   _Legacy Ref:_ Firing into melee logic within `rollWeaponAttackQOL` in `patch.js`.
    -   _Unit Test:_ Verify -1 penalty term is added when conditions are met and setting is enabled; verify no penalty added otherwise. Test various combat positioning scenarios.

-   [ ] **Implement Friendly Fire Check:** When a ranged attack _misses_ a target engaged in melee with one or more friendly combatants, roll 1d2. On a 1, the attack hits a random friendly combatant engaged with the original target. Offer an optional house rule: instead of 1d2, roll 1d9 to determine which adjacent/diagonal square relative to the original target is hit.
    -   _Settings:_ `automateFriendlyFire`, `friendlyFireHouseRuleD9` (New Setting - Boolean, default false).
    -   _Primary Hook:_ Likely requires listening on `renderChatMessage` (or a roll completion hook) to detect a miss under the specified conditions. If conditions met, trigger secondary logic (determine potential friendlies, roll 1d2/1d9, potentially create new chat message or damage application workflow for the friendly hit).
    -   _Legacy Ref:_ Friendly fire check logic within `rollWeaponAttackQOL` in `patch.js`.
    -   _Unit Test:_ Verify secondary check triggers only on miss when conditions met and setting enabled. Verify correct friendly target is chosen (or d9 square identified). Verify no check occurs if setting disabled or conditions not met.
