# DCC Quality of Life Improvements

Requires libWrapper ( https://foundryvtt.com/packages/lib-wrapper )
Requires Dungeon Crawl Classics ( https://foundryvtt.com/packages/dcc )

* Separated attack/damage/crit and fumble roles for weapon attacks
* On the bottom of the attack chat card information displayed about the weapon (type, equipped, range, (un)trained, two-handed)
* Displays weapon description (weapon.system.description.value)
* Automated deed die roll for warriors/dwarves
* Substracting PC's Luck score during monsters' crit roll
* Checks the weapon range (requires token targeting)
  * Checks hits and misses (damage button not displayed on misses)
  * Checks Firing into melee ("Friendly Fire" button displays when ally is near)
  * Calculates range penalty dunring attack roles


# Manual installation

Use Foundry's module installation dialog or paste the following link in the Install Module interface of your Foundry VTT instance:

https://github.com/sasquach45932/dcc-qol/releases/latest/download/module.json

This module extension of the following dcc system functions:

* rollCritical
* rollWeaponAttack
* rollToHit