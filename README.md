# DCC Quality of Life Improvements

This module extends the functionality of the Dungeon Crawl Classics module. Any update on DCC might break this module!

* Separated attack/damage/crit and fumble roles for weapon attacks
* On the bottom of the attack chat card show information about the weapon/actor (type, equipped, range, (un)trained, two-handed)
* Displays weapon description (`weapon.system.description.value`)
* Automated deed die roll for warriors/dwarves
* Substracting PC's Luck score during monsters' crit roll
* Checks the weapon range (requires token targeting)
  * Checks hits and misses (damage button not displayed on misses)
  * Checks Firing into melee ("Friendly Fire" button displays when ally is near)
 * Calculates range penalty during attack rolls

# Manual installation

- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper)
- Requires [Dungeon Crawl Classics](https://foundryvtt.com/packages/dcc)

Paste the following link in the Install Module interface of your Foundry VTT instance:

`https://github.com/sasquach45932/dcc-qol/releases/latest/download/module.json`

This module extension of the following dcc system functions:

* `rollCritical`
* `rollWeaponAttack`
* `rollToHit`
