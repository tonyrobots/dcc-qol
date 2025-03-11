# Changelog

## 0.1.28 - 2024-12-06

#### DCC-QOL is incompatible with the (very cool) new DCC system update

The 0.5 version of the DCC system brings a number of exciting changes, but unfortunately will require an extensive rework to dcc-qol to make it compatible. This small dcc-qol update specifies a max compatible DCC system version of 0.49; anyone running a DCC system version > 0.49 will have dcc-qol automatically disabled. We're hoping this will help users avoid some unnecessary confusion when updating to the new system version.

Also hoping to have a compatible release in the coming weeks, but holidays might throw a bit of a wrench into that. In the meantime, please let me know what feature(s) you miss most and would most like to see prioritized for a compatible version on the [github issues board](https://github.com/tonyrobots/dcc-qol/issues).

Note: for the small group of you who want to keep using dcc-qol, and are therefore sticking to DCC system version 0.49, and happen to be Brazilian --  thanks to contributor unnamed-gw, dcc-qol now includes a Brazilian Portuguese (PT-BR) translation. (You are on your own getting it to work, though -- will require another module since PT-BR isn't selectable in the vanilla language dropdown.)

Thank you!

### What's Changed

* Added pt-br translation file by @unnamed-gw in https://github.com/tonyrobots/dcc-qol/pull/5

### New Contributors

* @unnamed-gw made their first contribution in https://github.com/tonyrobots/dcc-qol/pull/5

**Full Changelog**: https://github.com/tonyrobots/dcc-qol/compare/0.1.27...0.1.28

## 0.1.27 - 2024-09-06

Fast follow fix for a bug introduced in the update earlier today, as well as one for a persnickety little bug that's been haunting me.

### Fixed

- Fixed bug with some attacks for characters that don't use the Deed Die introduced in v0.1.25
- Fixed bug where damage was being rolled using base actor's weapons rather than token actors, causing all sorts of nasty hi-jinx.

As always, if you see any issues or have any feature requests, please submit them to the [Issues board](https://github.com/tonyrobots/dcc-qol/issues)

## 0.1.26 - 2024-09-05

Just a version bump to fix a publishing error. Blerg. See notes for v0.1.25 for the latest changes.

## 0.1.25 - 2024-09-05

### Added

- Added automated deed dice support for Rangers and Halfling Champions. (Thanks to clayworks on the Goodman Games discord for the suggestion.)
- Other classes can also enable automated deed dice (in case people are using non-standard variants, etc)... You just need to  a)  turn on "Attack Bonus Mode: Manual Roll" in the sheet configuration, and b) manually roll the deed die at least once (from the equipment tab on the sheet)
- Added support for alt/house rules for Lucky Weapon attack modifier. (n.b. you still need to enable "Automate Lucky Weapon" in the DCC system settings first)

### Changed

- Moved some system-wide configuration stuff to a config.js file to clean things up
- Changed version numbering scheme to better conform to semantic versioning standards... (hooray for v0.1.x!!)

## 0.0.24 - 2024-08-16

**Deed Die Damage Fix**
This is a quick fix to automated Deed Die handling. It addresses an issue whereby the deed die would be automatically rolled with the attack roll, but it wasn't updating on the attacker's character sheet, and therefore wasn't being applied correctly when rolling damage.

## 0.0.23 - 2024-07-07

Small update to add compatibility for Foundry v12/DCC system v0.42

Note: DCC support for v12 is still new, and this update hasn't been comprehensively tested, so there here may still be some bugs. Proceed with caution!

**Full Changelog**: https://github.com/tonyrobots/dcc-qol/compare/0.0.22...0.0.23

## v0.0.22 - 2024-04-22

Quick follow-up to yesterday's release -- this release fixes the bug in the way the distance between two tokens was being determined, as used in all of the range-specific functionality. Previously, it wasn't working for tokens bigger than 1x1 grid square -- the distance was being calculated based on the top left tile, instead of taking into account the full size of the token/actor.

Full list of changes:

### Fixed

- fixed distance calculation function to account for tokens larger than 1x1
- clarified the copy for the range checking option to better reflect what it actually does
- clarified the messaging for "out of range" warnings for both melee and ranged attacks
- adjusted range checking for melee and ranged attacks so it only happens if the relevant option is enabled

### Removed

- removed option that prevented backstabs from weapons that don't have bonus backstab damage, as it was based on incorrect interpretation of the rules

### Added

- added CI function to automatically publish new versions to Foundry website

## v0.0.21 - 2024-04-21

Hi all! A relatively small update, but my first of any substance since taking over the module. Mostly focused on the "Friendly Fire" functionality, which handles the determination of whether to apply an attack roll penalty for ranged attacks into a melee, and the chance those attacks might accidentally strike an ally. Also just started to tidy up some options, and other text for clarity. Specifically:

### Fixed

- Fixed Friendly Fire determination bug, that caused false positives if any token was adjacent to your target (not just friendlies)
- Cleaned up some of the language for clarity

### Added

- Added separate option for enabling/disabling the -1 penalty for ranged weapon attacks fired into melee

### Removed

- Remove setting for "manual damage" reminder for users who have auto-damage turned off. (Reminder is just present by default.)

### Changed

- Module will notify if melee attack is from beyond melee range, but will no longer prevent the attack roll from happening. (This is a workaround for a bug I spotted in range determination for targets that are larger than 1 grid square; to be fixed on a subsequent release.)

## v0.0.20 - 2024-04-06

### Changed

- Transition of maintenance from sasquach to tonyrobots. Hello, dungeon crawlers!
