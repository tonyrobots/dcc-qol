/* global Actor, ChatMessage, CONFIG, game, Ray, Roll, renderTemplate, ui */

class DCCQOL extends Actor {
  /** @override */
  prepareBaseData () {
    super.prepareBaseData()
  }

  /** @override */
  prepareDerivedData () {
    super.prepareDerivedData()
  }

  /**
   * Roll a Critical Hit
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollCriticalQOL (options = {}, targettoken, actor) {
    /* Collecting modifiers to console logging */
    let debuginfo

    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: this.system.attributes.critical.die
      }
    ]

    if (
      this.type === 'NPC' &&
      game.settings.get('dcc-qol', 'automateMonsterCritLuck')
    ) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: parseInt(this.system.abilities.lck.mod || '0')
      })
      const index = terms.findIndex((element) => element.type === 'Modifier')
      if (targettoken) {
        const targetactor = game.actors.get(targettoken.actorId)
        const luckModifier = targetactor.system.abilities.lck.mod
        terms[index].formula = luckModifier * -1
        debuginfo =
          'Crit roll: ' + this.name + ` [TargetLuckModifier:${luckModifier}]`
        if (game.settings.get('dcc-qol', 'log') && game.user.isGM) { console.warn('DCC-QOL |', debuginfo) }
      } else {
        terms.splice(index, 1)
      }
    }

    if (
      this.type === 'Player'
    ) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: parseInt(actor.system.abilities.lck.mod || '0')
      })
        const luckModifier = actor.system.abilities.lck.mod
        debuginfo =
          'Crit roll: ' + this.name + ` [LuckModifier:${luckModifier}]`
        if (game.settings.get('dcc-qol', 'log') && game.user.isGM) { console.warn('DCC-QOL |', debuginfo) }
    }    

    // Roll object for the crit die
    let roll = await game.dcc.DCCRoll.createRoll(
      terms,
      this.getRollData(),
      {} // Ignore options for crits
    )

    // Lookup the crit table if available
    let critResult = null
    for (const criticalHitPackName of CONFIG.DCC.criticalHitPacks.packs) {
      if (criticalHitPackName) {
        const pack = game.packs.get(criticalHitPackName)
        if (pack) {
          await pack.getIndex() // Load the compendium index
          const critTableFilter = `Crit Table ${this.system.attributes.critical.table}`
          const entry = pack.index.find((entity) =>
            entity.name.startsWith(critTableFilter)
          )
          if (entry) {
            const table = await pack.getDocument(entry._id)
            critResult = await table.draw({
              roll,
              displayChat: true
            })
          }
        }
      }
    }

    // Either roll the die or grab the roll from the table lookup
    if (!critResult) {
      await roll.evaluate({ async: true })
    } else {
      roll = critResult.roll
    }

    // Create the roll emote
    // const rollData = escape(JSON.stringify(roll))
    // const rollTotal = roll.total

    // Generate flags for the roll
    const flags = {
      'dcc.RollType': 'CriticalHit',
      'dcc.ItemId': options.weaponId
    }
    if (options.naturalCrit) {
      game.dcc.FleetingLuck.updateFlagsForCrit(flags)
    }

    // Display crit result or just a notification of the crit
    if (!critResult) {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize('DCC.CriticalHit')}!`,
        flags
      })
    }
  }

  async getWeaponProperties (weapon, options) {
    const properties = []

    if (weapon.system.melee) {
      properties.push('Melee')
    } else {
      properties.push('Ranged')
      properties.push(weapon.system.range + ' ft.')
    }
    if (weapon.system.equipped) {
      properties.push('Equipped')
    } else {
      properties.push('Not Equipped')
    }
    if (weapon.system.trained) {
      properties.push('Trained')
    } else {
      properties.push('Not Trained')
    }
    if (weapon.system.twoHanded) {
      properties.push('Two handed')
    }
    if (options.backstab) {
      properties.push('Backstab')
    }
    return properties
  }

  /*
   * Measure distance between 2 tokens
   * @param {Object} token1    The token "from"
   * @param {Object} token2    The token "to"
   */
  async measureTokenDistance (token1, token2) {
    const gs = game.canvas.dimensions.size
    const ray = new Ray(token1, token2)

    const nx = Math.ceil(Math.abs(ray.dx / gs))
    const ny = Math.ceil(Math.abs(ray.dy / gs))

    // Get the number of straight and diagonal moves
    const nDiagonal = Math.min(nx, ny)
    const nStraight = Math.abs(ny - nx)

    // Diagonals in DDC calculated as 1.0 times a straight
    const distance = Math.floor(nDiagonal * 1.0 + nStraight)
    const distanceOnGrid = distance * game.canvas.dimensions.distance
    return distanceOnGrid
  }

  async checkFiringIntoMelee (targetTokenDocument) {
    let firingIntoMelee = false

    for (const token of game.canvas.tokens.placeables) {
      if (!(token.document === targetTokenDocument)) {
        if (
          (await this.measureTokenDistance(targetTokenDocument, token)) <= 5
        ) {
          firingIntoMelee = true
        }
      }
    }
    return firingIntoMelee
  }

  async rollWeaponAttackQOL (weaponId, options = {}, tokenD = {}) {
    const DCCActor = new game.dcc.DCCActor(this)

    // First try and find the item by name or id
    let weapon = this.items.find(
      (i) => i.name === weaponId || i.id === weaponId
    )

    // If not found try finding it by slot
    if (!weapon) {
      try {
        // Verify this is a valid slot name
        const result = weaponId.match(/^([mr])(\d+)$/)
        if (!result) {
          throw new Error('Invalid slot name')
        }
        const isMelee = weaponId[0] === 'm' // 'm' or 'r'
        const weaponIndex = parseInt(weaponId.slice(1)) - 1 // 1 based indexing
        let weapons = this.itemTypes.weapon
        if (this.system.config.sortInventory) {
          // ToDo: Move inventory classification and sorting into the actor so this isn't duplicating code in the sheet
          weapons = [...weapons].sort((a, b) => a.name.localeCompare(b.name))
        }
        weapon = weapons.filter((i) => !!i.system.melee === isMelee)[
          weaponIndex
        ]
      } catch (err) {}
    }

    // If all lookups fail, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(
        game.i18n.format('DCC.WeaponNotFound', {
          id: weaponId
        })
      )
    }

    if (options.weaponId === undefined) {
      options.weaponId = weapon.id
    }

    if (DCCActor.rollAttackBonusWithAttack) {
      options.rollWeaponAttack = true
      await DCCActor.rollAttackBonus(
        Object.assign(
          {
            rollWeaponAttack: true
          },
          options
        )
      )
    }

    if (
      !weapon.system.equipped &&
      game.settings.get('dcc', 'checkWeaponEquipment')
    ) {
      return ui.notifications.warn(
        game.i18n.localize('DCC.WeaponWarningUnequipped')
      )
    }
    if (
      !weapon.system.backstab &&
      game.settings.get('dcc-qol', 'checkWeaponBackstab') &&
      options.backstab
    ) {
      return ui.notifications.warn(
        game.i18n.localize('DCC-QOL.WeaponWarningNonBackstabBonus')
      )
    }

    const targets = Array.from(game.user.targets)

    let hitsTarget = false
    let friendlyFire = false
    let lastDeedRoll = 0
    let deedDieHTML

    const attackRollResult = await this.rollToHitQOL(weapon, options, tokenD)
    if (attackRollResult.naturalCrit) {
      options.naturalCrit = true
    }

    if (
      (DCCActor.system.details.sheetClass === 'Warrior' ||
        DCCActor.system.details.sheetClass === 'Dwarf') &&
      game.settings.get('dcc-qol', 'automateDeedDieRoll')
    ) {
      const deedDieFace = Number(
        this.system.details.attackBonus.replace(/\+1?d/, '')
      )
      if (weapon.system.toHit.includes('+@ab')) {
        lastDeedRoll = attackRollResult.roll.terms.find(
          (element) => element.faces === deedDieFace
        ).results[0].result
        const preDeedDieHTML = `<div class="chat-details"> <div class="roll-result">${game.i18n.localize(
          'DCC.DeedRollValue'
        )}</div> </div>`
        if (lastDeedRoll >= 3) {
          deedDieHTML =
            preDeedDieHTML +
            `<div class="dice-roll"> <div class="dice-result"> <h4 class="dice-total"><span style="color:green">${lastDeedRoll}</span> </h4> </div> </div>`
        } else {
          deedDieHTML =
            preDeedDieHTML +
            `<div class="dice-roll"> <div class="dice-result"> <h4 class="dice-total"><span style="color:black">${lastDeedRoll}</span> </h4> </div> </div>`
        }
      } else {
        console.warn(
          'DCC-QOL | Missing "+@ab" in toHit. Dice So Nice cannot display deed die roll.: ' + weapon.system.toHit 
        )
      }
    }

    if (
      (DCCActor.system.details.sheetClass === 'Warrior' ||
        DCCActor.system.details.sheetClass === 'Dwarf') &&
      !game.settings.get('dcc-qol', 'automateDeedDieRoll')
    ) {
      lastDeedRoll = this.system.details.lastRolledAttackBonus
      const preDeedDieHTML = `<div class="chat-details"> <div class="roll-result">${game.i18n.localize(
        'DCC.DeedRollValue'
      )}</div> </div>`
      if (lastDeedRoll >= 3) {
        deedDieHTML =
          preDeedDieHTML +
          `<div class="dice-roll"> <div class="dice-result"> <h4 class="dice-total"><span style="color:green">${lastDeedRoll}</span> </h4> </div> </div>`
      } else {
        deedDieHTML =
          preDeedDieHTML +
          `<div class="dice-roll"> <div class="dice-result"> <h4 class="dice-total"><span style="color:black">${lastDeedRoll}</span> </h4> </div> </div>`
      }
    }

    const diceHTML = await attackRollResult.roll.render()

    if (targets.length > 1) { return ui.notifications.warn(game.i18n.localize('DCC-QOL.TargetOneToken')) }

    // Check if the target is within range, if there is a token defined
    if (tokenD !== undefined) {
      // determine token distance
      if (targets.length !== 0) {
        const tokenDistance = await this.measureTokenDistance(
          tokenD,
          game.user.targets.first()
        )
        // warn if melee attack and target is out of melee range
        if (
          weapon.system.melee &&
          tokenDistance / game.canvas.scene.grid.distance > 1
        ) {
          return ui.notifications.warn(
            game.i18n.localize('DCC-QOL.WeaponMeleeWarn')
          )
        }

        const range = weapon.system.range
        const rangeArray = range.split('/')
        // warn if ranged attack target is too far for weapon
        if (tokenDistance > rangeArray[2]) {
          return ui.notifications.warn(
            game.i18n.localize('DCC-QOL.WeaponRangedWarn')
          )
        }

        // check for friendly fire
        hitsTarget =
          game.user.targets.first().actor.system.attributes.ac.value <=
            attackRollResult.hitsAc || attackRollResult.crit

        if (
          !hitsTarget &&
          game.settings.get('dcc-qol', 'automateFriendlyFire') &&
          !weapon.system.melee
        ) {
          let Allies = 0
          for (const token of game.canvas.tokens.placeables) {
            if (
              token.document.disposition === 1 &&
              !(token.document === tokenD)
            ) { Allies++ }
          }
          if (Allies >= 1 && attackRollResult.firingIntoMelee) { friendlyFire = true }
        }
      }
    }

    let headerText

    if (options.backstab) {
      headerText = game.i18n.format('DCC-QOL.BackstabsWith', {
        weapon: weapon.name
      })
    } else {
      headerText = game.i18n.format('DCC-QOL.AttacksWith', {
        weapon: weapon.name
      })
    }

    // if backstab hits, add crit flag
    if (options.backstab && hitsTarget) {
      attackRollResult.crit = true
    }

    // Render the chat card template
    const templateData = {
      canDelete: game.user.isGM,
      actor: DCCActor,
      properties: await this.getWeaponProperties(weapon, options),
      tokenId: tokenD?.uuid || null,
      target: game.user.targets.first()
        ? game.user.targets.first().actor.name
        : null,
      targettokenId: game.user.targets.first()
        ? game.user.targets.first().document.uuid
        : null,
      weapon,
      options: JSON.stringify(options),
      diceHTML,
      headerText,
      isBackStab: options.backstab,
      isFumble: attackRollResult.fumble,
      isCrit: attackRollResult.crit,
      deedDieHTML: deedDieHTML,
      isDisplayHitMiss: game.settings.get('dcc-qol', 'DisplayHitMiss'),
      hitsAc: game.i18n.format('DCC-QOL.AttackRollHitsAC', {
        AC: attackRollResult.hitsAc
      }),
      hitsTarget,
      friendlyFire
    }
    const html = await renderTemplate(
      'modules/dcc-qol/templates/attackroll-card.html',
      templateData
    )

    // ChatMessage.create(chatData)
    const msg = await attackRollResult.roll.toMessage({
      speaker: {
        alias: DCCActor.name
      },
      content: html,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: {
        'dcc.RollType': 'ToHit',
        'dcc.ItemId': options.weaponId
      }
    })

    /* Update AttackBonus only after Dice So Nice animation finished */
    if (
      (DCCActor.system.details.sheetClass === 'Warrior' ||
        DCCActor.system.details.sheetClass === 'Dwarf') &&
      game.settings.get('dcc-qol', 'automateDeedDieRoll')
    ) {
      if (game.modules.get('dice-so-nice')?.active) {
        game.dice3d.waitFor3DAnimationByMessageID(msg.id).then(() =>
          this.update({
            'data.details.lastRolledAttackBonus': lastDeedRoll
          })
        )
      } else {
        this.update({
          'data.details.lastRolledAttackBonus': lastDeedRoll
        })
      }
    }
  }

  async rollToHitQOL (weapon, options = {}, tokenD) {
    const DCCActor = new game.dcc.DCCActor(this)

    /* Grab the To Hit modifier */
    const toHit = weapon.system.toHit ? weapon.system.toHit : '0'

    /* Determine crit range */
    let die = weapon.system.actionDie || DCCActor.getActionDice()[0].formula

    /* Collecting modifiers to console logging */
    let debuginfo = 'Attack roll: ' + this.name + '/' + weapon.name + ' '

    let firingIntoMelee

    /* Determine using untrained weapon */
    const automateUntrainedAttack = game.settings.get(
      'dcc',
      'automateUntrainedAttack'
    )
    if (!weapon.system.trained && automateUntrainedAttack) {
      die = game.dcc.DiceChain.bumpDie(die, '-1')
      debuginfo = debuginfo + '[Untrained:-1D]'
    }

    let critRange = parseInt(
      weapon.system.critRange || DCCActor.system.details.critRange || 20
    )

    /* If we don't have a valid formula, bail out here */
    if (!(await Roll.validate(toHit))) {
      return {
        rolled: false,
        formula: weapon.system.toHit
      }
    }

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: DCCActor.getActionDice({
          includeUntrained: !automateUntrainedAttack
        })
      }
    ]

    /* Remove empty toHit value from RollFormula */
    if (Number(toHit) !== 0 || options.showModifierDialog) {
      const newToHit = toHit.replace('+@ab', '')
      if (newToHit.length !== 0) debuginfo = debuginfo + `[ToHit:${newToHit}]`
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.DeedDie'),
        modifierLabel: game.i18n.localize('DCC.ToHit'),
        formula: toHit
      })
    }

    /* Replace Deed roll value with Deed die */
    if (
      (DCCActor.system.details.sheetClass === 'Warrior' ||
        DCCActor.system.details.sheetClass === 'Dwarf') &&
      game.settings.get('dcc-qol', 'automateDeedDieRoll')
    ) {
      const index = terms.findIndex((element) => element.type === 'Compound')
      if (index !== -1) {
        const deedDie = this.system.details.attackBonus.replace(/\+1?/i, '') // previously was replacing with 1
        terms[index].formula = terms[index].formula.replace('+@ab', deedDie)
      }
    }

    // Add backstab bonus if required
    if (options.backstab) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.Backstab'),
        formula: parseInt(DCCActor.system.class.backstab)
      })
      debuginfo = debuginfo + '[Backstab]'
    }

    /* Check weapon range and apply penalty */
    if (
      game.settings.get('dcc-qol', 'checkWeaponRange') &&
      game.user.targets.first()
    ) {
      // if tokenD is not defined, warn the user to control a token and continue
      if (tokenD === undefined) {
        ui.notifications.warn(game.i18n.localize('DCC-QOL.ControlAToken'))
      } else {
        const tokenDistance = await this.measureTokenDistance(
          tokenD,
          game.user.targets.first()
        )
        const range = weapon.system.range
        const rangeArray = range.split('/')
        if (tokenDistance > rangeArray[1] && tokenDistance <= rangeArray[2]) {
          terms[0].formula = game.dcc.DiceChain.bumpDie(die, '-1')
          debuginfo = debuginfo + '[LongRange:-1D]'
        }

        if (tokenDistance > rangeArray[0] && tokenDistance <= rangeArray[1]) {
          terms.push({
            type: 'Modifier',
            label: game.i18n.localize('DCC-QOL.WeaponRangePenalty'),
            formula: '-2'
          })
          debuginfo = debuginfo + '[MediumRange:-2]'
        }
      }
    }

    // Add Strength or Agility modifier to attack rolls
    let modifier
    let modifierLabel
    if (
      game.settings.get('dcc', 'automateCombatModifier') &&
      (DCCActor.system.abilities.agl.mod !== 0 ||
        DCCActor.system.abilities.str.mod !== 0)
    ) {
      if (weapon.system.melee) {
        modifier = DCCActor.system.abilities.str.mod
        modifierLabel = 'DCC.AbilityStr'
      } else {
        modifier = DCCActor.system.abilities.agl.mod
        modifierLabel = 'DCC.AbilityAgl'
      }

      terms.push({
        type: 'Modifier',
        label:
          game.i18n.localize(modifierLabel) +
          ' ' +
          game.i18n.localize('DCC.Modifier'),
        formula: modifier
      })
      debuginfo = debuginfo + `[AbilityMod:${modifier}]`
    }

    /* Check firing into melee and apply penalty */
    if (
      game.settings.get('dcc-qol', 'automateFriendlyFire') &&
      game.user.targets.first() &&
      !weapon.system.melee
    ) {
      firingIntoMelee = await this.checkFiringIntoMelee(
        game.user.targets.first().document
      )
      if (firingIntoMelee) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize('DCC-QOL.WeaponMissileToMelee'),
          formula: '-1'
        })
        debuginfo = debuginfo + '[MissileToMelee:-1]'
      }
    }

    if (
      DCCActor.system.details.sheetClass === 'Warrior' ||
      DCCActor.system.details.sheetClass === 'Dwarf'
    ) {
      if (
        weapon.name
          .toLowerCase()
          .includes(DCCActor.system.class.luckyWeapon.toLowerCase()) &&
        game.settings.get('dcc', 'automateLuckyWeaponAttack') &&
        DCCActor.system.class.luckyWeapon !== ''
      ) {
        terms.push({
          type: 'Modifier',
          label:
            game.i18n.localize('DCC.AbilityLck') +
            ' ' +
            game.i18n.localize('DCC.Modifier'),
          formula: DCCActor.system.abilities.lck.mod
        })
        debuginfo = debuginfo + `[Luck:${DCCActor.system.abilities.lck.mod}]`
      }
    }

    /* Roll the Attack */
    const rollOptions = Object.assign(
      {
        title: game.i18n.localize('DCC.ToHit')
      },
      options
    )
    const attackRoll = await game.dcc.DCCRoll.createRoll(
      terms,
      Object.assign(
        {
          critical: critRange
        },
        DCCActor.getRollData()
      ),
      rollOptions
    )
    await attackRoll.evaluate({
      async: true
    })

    // Adjust crit range if the die size was adjusted
    critRange += parseInt(
      game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula)
    )

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = {
      upperThreshold: critRange
    }

    /* Check for crit or fumble */
    const fumble = d20RollResult === 1
    const naturalCrit = d20RollResult >= critRange
    const crit = !fumble && (naturalCrit) // is this still needed?


    if (game.settings.get('dcc-qol', 'log') && game.user.isGM) { console.warn('DCC-QOL |', debuginfo) }

    return {
      rolled: true,
      roll: attackRoll,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      hitsAc: attackRoll.total,
      d20Roll: d20RollResult,
      crit,
      naturalCrit,
      fumble,
      firingIntoMelee
    }
  }
}

export default DCCQOL
