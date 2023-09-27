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

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/0e1838b8-d132-4d10-81ad-29268941c0b1)
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/e16b0af7-5b0e-450d-9553-5cc90a50db10)
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/98f61f2e-7771-42c3-8423-6920f14c1208)


![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/aad94bd1-9ab4-44c9-aaca-dff026d3153c)


![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/b1f07fd0-8dc3-442b-a822-040127a39fe8)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/ab28bfc8-c43a-40b7-a2e8-9ad45397253b)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/62ad98bf-6e69-4a1d-ae69-2f97b6ca7bb4)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/b5e1d6c6-2785-4102-b490-c363f10f0e59)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/3fc1382d-9dca-429b-b25d-aef4876da841)






# Manual installation

- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper)
- Requires [Dungeon Crawl Classics](https://foundryvtt.com/packages/dcc)

Paste the following link in the Install Module interface of your Foundry VTT instance:

`https://github.com/sasquach45932/dcc-qol/releases/latest/download/module.json`

This module extension of the following dcc system functions:

* `rollCritical`
* `rollWeaponAttack`
* `rollToHit`
