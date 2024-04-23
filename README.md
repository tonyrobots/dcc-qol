# DCC Quality of Life Improvements
<img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/tonyrobots/dcc-qol?style=flat-square"> <img alt="GitHub" src="https://img.shields.io/github/license/tonyrobots/dcc-qol?style=flat-square"> <img alt="GitHub Releases" src="https://img.shields.io/github/downloads/tonyrobots/dcc-qol/total?style=flat-square">  <img alt="GitHub Releases" src="https://img.shields.io/github/downloads/tonyrobots/dcc-qol/latest/total?style=flat-square">  

(Originally based on https://github.com/sasquach45932/dcc-qol)

The DCC-QoL module aims to bring some convenience & automation functions that are not present in the core Dungeon Crawl Classics system. 

Some highlights:
* Separates attack/damage/crit and fumble rolls for weapon attacks
* Displays on attack chat-card information about the weapon/actor (type, equipped, range, (un)trained, two-handed)
* Displays weapon description (weapon.system.description.value)
* Automates deed die roll for warriors/dwarves (in manual roll mode)
* Subtracts PC's Luck score from monsters' crit roll
* Checks the weapon range (requires token targeting)
  * Checks hits and misses
  * Checks for friendly fire when firing into melee ("Friendly Fire" button displays when ally is near)
* Calculates range penalty during attack rolls
* Auto-applies damage (targeting can be done before attack roll or before damage roll)
  
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/de00db42-eab4-491f-afca-244f742be62a)
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/786a457a-31a2-4733-b3e7-ba2d75e1c2f9)

Auto roll deed die:

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/46296610-6d7d-45e5-b7ad-52a167b64f3f)

Applying Luck score on monsters' crit roll

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/2b8601cd-c823-4f22-b9ab-e7ecdbfb2af6)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/e1475ec2-f5d3-467d-a02a-dcac9e565d70)


Range penalty applying:

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/e7961451-b345-4942-ba20-c310cac1a0f5)
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/a1fc425b-f3b5-4868-8804-6a80675ef583)

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/d2a8fd9b-416a-4d9d-a76e-2bff4710d926)
![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/29d17718-d728-4f5f-be8c-dd95567edf43)

Friendly fire check results:

![image](https://github.com/sasquach45932/dcc-qol/assets/92884040/3e1afbc4-5274-4fa6-b43f-2ac7c6269d50)



# Manual installation

- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper)
- Requires [socketlib](https://foundryvtt.com/packages/socketlib)
- Requires [Dungeon Crawl Classics](https://foundryvtt.com/packages/dcc)


Paste the following link in the Install Module interface of your Foundry VTT instance:

`https://github.com/tonyrobots/dcc-qol/releases/latest/download/module.json`

This module replaces the following dcc system functions:

* `applyDamage`
* `rollCritical`
* `rollWeaponAttack`
* `rollToHit`
