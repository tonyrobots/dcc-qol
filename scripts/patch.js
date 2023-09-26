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
  async rollCritical (options = {}, targettoken) {
    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: this.system.attributes.critical.die
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: parseInt(this.system.abilities.lck.mod || '0')
      }
    ]

    if ((this.type === 'NPC') && game.settings.get('dcc-qol', 'automateMonsterCritLuck')) {
      const index = terms.findIndex(element => element.type === 'Modifier')
      if (targettoken) {
        const targetactor = game.actors.get(targettoken.actorId)
        const luckModifier = targetactor.system.abilities.lck.mod
        terms[index].formula = luckModifier * -1
      } else {
        terms.splice(index, 1)
      }
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
          const entry = pack.index.find((entity) => entity.name.startsWith(critTableFilter))
          if (entry) {
            const table = await pack.getDocument(entry._id)
            critResult = await table.draw({ roll, displayChat: options.displayStandardCards })
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

    if (!options.displayStandardCards) {
      // Create the roll emote
      const rollData = escape(JSON.stringify(roll))
      const rollTotal = roll.total
      const rollHTML = `<a class="inline-roll inline-result" data-roll="${rollData}" data-damage="${rollTotal}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${rollTotal}</a>`

      // Display crit result or just a notification of the crit
      if (critResult) {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}<br/>${critResult.results[0].getChatText()}`
      } else {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}`
      }
    } else if (!critResult) {
      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'CriticalHit',
        'dcc.ItemId': options.weaponId
      }
      game.dcc.FleetingLuck.updateFlagsForCrit(flags)

      // Display the raw crit roll
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
        if (await this.measureTokenDistance(targetTokenDocument, token) <= 5) {
          firingIntoMelee = true
        }
      }
    }
    return firingIntoMelee
  }

  async rollWeaponAttack (weaponId, options = {}, tokenD = {}) {
    const DCCActor = new game.dcc.DCCActor(this)

    // First try and find the item by name or id
    let weapon = DCCActor.items.find(i => i.name === weaponId || i.id === weaponId)

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
        let weapons = DCCActor.itemTypes.weapon
        if (DCCActor.system.config.sortInventory) {
          // ToDo: Move inventory classification and sorting into the actor so this isn't duplicating code in the sheet
          weapons = [...weapons].sort((a, b) => a.name.localeCompare(b.name))
        }
        weapon = weapons.filter(i => !!i.system.melee === isMelee)[weaponIndex]
      } catch (err) {}
    }

    // If all lookups fail, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', {
        id: weaponId
      }))
    }

    if (options.weaponId === undefined) {
      options.weaponId = weapon.id
    }

    let attackBonusRollResult = 0
    if (DCCActor.rollAttackBonusWithAttack) {
      options.rollWeaponAttack = true
      attackBonusRollResult = await DCCActor.rollAttackBonus(Object.assign({
        rollWeaponAttack: true
      },
      options
      ))
    }

    if (!weapon.system.equipped && game.settings.get('dcc', 'checkWeaponEquipment')) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))
    if (!weapon.system.backstab && game.settings.get('dcc-qol', 'checkWeaponBackstab') && options.backstab) return ui.notifications.warn(game.i18n.localize('DCC-QOL.WeaponWarningNonBackstabBonus'))

    const targets = Array.from(game.user.targets)

    let hitsTarget = false
    let friendlyFire = false

    const attackRollResult = await this.rollToHit(weapon, options, tokenD)

    if ((DCCActor.system.details.sheetClass === 'Warrior' || DCCActor.system.details.sheetClass === 'Dwarf') && game.settings.get('dcc-qol', 'automateDeedDieRoll')) {
      const deedDiceFace = Number(this.system.details.attackBonus.replace('+d', ''))
      const lastRoll = attackRollResult.roll.terms.find(element => element.faces === deedDiceFace).results[0].result
      await this.update({
        'data.details.lastRolledAttackBonus': lastRoll
      })
    }

    const diceHTML = await attackRollResult.roll.render()

    if (targets.length > 1) return ui.notifications.warn(game.i18n.localize('DCC-QOL.TargetOneToken'))

    if (targets.length !== 0) {
      const tokenDistance = await this.measureTokenDistance(tokenD, game.user.targets.first())

      if (weapon.system.melee && ((tokenDistance / game.canvas.scene.grid.distance) > 1)) return ui.notifications.warn(game.i18n.localize('DCC-QOL.WeaponMeleeWarn'))

      const range = weapon.system.range
      const rangeArray = range.split('/')

      if (tokenDistance > rangeArray[2]) return ui.notifications.warn(game.i18n.localize('DCC-QOL.WeaponRangedWarn'))

      hitsTarget = ((game.user.targets.first().actor.system.attributes.ac.value <= attackRollResult.hitsAc) || (attackRollResult.crit))

      if ((!hitsTarget) && (game.settings.get('dcc-qol', 'automateFriendlyFire')) && (!weapon.system.melee)) {
        let Allies = 0
        for (const token of game.canvas.tokens.placeables) {
          if ((token.document.disposition === 1) && !(token.document === tokenD)) Allies++
        }
        if (Allies >= 1) friendlyFire = true
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

    // Render the chat card template
    const templateData = {
      canDelete: game.user.isGM,
      actor: tokenD.actor,
      properties: await this.getWeaponProperties(weapon, options),
      tokenId: tokenD?.uuid || null,
      target: game.user.targets.first() ? game.user.targets.first().actor.name : null,
      targettokenId: game.user.targets.first() ? game.user.targets.first().document.uuid : null,
      weapon,
      options: JSON.stringify(options),
      diceHTML,
      headerText,
      isBackStab: options.backstab,
      isFumble: attackRollResult.fumble,
      isCrit: attackRollResult.crit,
      hitsAc: game.i18n.format('DCC-QOL.AttackRollHitsAC', {
        AC: attackRollResult.hitsAc
      }),
      hitsTarget,
      friendlyFire
    }
    const html = await renderTemplate('modules/dcc-qol/templates/attackroll-card.html', templateData)

    // ChatMessage.create(chatData)
    attackRollResult.roll.toMessage({
      speaker: {
        alias: tokenD.actor.name
      },
      content: html,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: {
        'dcc.RollType': 'ToHit',
        'dcc.ItemId': options.weaponId
      }
    })
  }

  async rollToHit (weapon, options = {}, tokenD) {
    const DCCActor = new game.dcc.DCCActor(this)

    /* Grab the To Hit modifier */
    const toHit = weapon.system.toHit

    /* Determine crit range */
    let die = weapon.system.actionDie || DCCActor.getActionDice()[0].formula

    /* Collecting modifiers to console logging */
    let debuginfo = 'Attack roll: ' + this.name + '/' + weapon.name

    /* Determine using untrained weapon */
    const automateUntrainedAttack = game.settings.get('dcc', 'automateUntrainedAttack')
    if (!weapon.system.trained && automateUntrainedAttack) {
      die = game.dcc.DiceChain.bumpDie(die, '-1')
      debuginfo = debuginfo + '[Untrained:-1D]'
    }

    let critRange = parseInt(weapon.system.critRange || DCCActor.system.details.critRange || 20)

    /* If we don't have a valid formula, bail out here */
    if (!await Roll.validate(toHit)) {
      return {
        rolled: false,
        formula: weapon.system.toHit
      }
    }

    // Collate terms for the roll
    const terms = [{
      type: 'Die',
      label: game.i18n.localize('DCC.ActionDie'),
      formula: die,
      presets: DCCActor.getActionDice({
        includeUntrained: !automateUntrainedAttack
      })
    },
    {
      type: 'Compound',
      dieLabel: game.i18n.localize('DCC.DeedDie'),
      modifierLabel: game.i18n.localize('DCC.ToHit'),
      formula: toHit
    }
    ]

    if (Number(toHit) !== 0) debuginfo = debuginfo + `[ToHit:${toHit}]`

    if ((DCCActor.system.details.sheetClass === 'Warrior' || DCCActor.system.details.sheetClass === 'Dwarf') && game.settings.get('dcc-qol', 'automateDeedDieRoll')) {
      const index = terms.findIndex(element => element.type === 'Compound')
      const deedDice = this.system.details.attackBonus.replace('+', '1')
      terms[index].formula = terms[index].formula.replace('+@ab', deedDice)
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

    if (game.settings.get('dcc-qol', 'checkWeaponRange') && game.user.targets.first()) {
      const tokenDistance = await this.measureTokenDistance(tokenD, game.user.targets.first())
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

    // Add Strength or Agility modifier to attack rolls
    let modifier
    let modifierLabel
    if ((game.settings.get('dcc', 'automateCombatModifier')) && ((DCCActor.system.abilities.agl.mod !== 0) || (DCCActor.system.abilities.str.mod !== 0))) {
      if (weapon.system.melee) {
        modifier = DCCActor.system.abilities.str.mod
        modifierLabel = 'DCC.AbilityStr'
      } else {
        modifier = DCCActor.system.abilities.agl.mod
        modifierLabel = 'DCC.AbilityAgl'
      }

      terms.push({
        type: 'Modifier',
        label: game.i18n.localize(modifierLabel) + ' ' + game.i18n.localize('DCC.Modifier'),
        formula: modifier
      })
      debuginfo = debuginfo + `[AbilityMod:${modifier}]`
    }

    if (game.settings.get('dcc-qol', 'automateFriendlyFire') && game.user.targets.first() && !weapon.system.melee) {
      const firingIntoMelee = await this.checkFiringIntoMelee(game.user.targets.first().document)
      if (firingIntoMelee) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize('DCC-QOL.WeaponMissileToMelee'),
          formula: '-1'
        })
        debuginfo = debuginfo + '[MissileToMelee:-1]'
      }
    }
    if (DCCActor.system.details.sheetClass === 'Warrior' || DCCActor.system.details.sheetClass === 'Dwarf') {
      if (weapon.name.toLowerCase().includes(DCCActor.system.class.luckyWeapon.toLowerCase()) && game.settings.get('dcc', 'automateLuckyWeaponAttack')) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize('DCC.AbilityLck') + ' ' + game.i18n.localize('DCC.Modifier'),
          formula: DCCActor.system.abilities.lck.mod
        })
        debuginfo = debuginfo + `[Luck:${DCCActor.system.abilities.lck.mod}]`
      }
    }

    /* Roll the Attack */
    const rollOptions = Object.assign({
      title: game.i18n.localize('DCC.ToHit')
    },
    options
    )
    const attackRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({
      critical: critRange
    }, DCCActor.getRollData()), rollOptions)
    await attackRoll.evaluate({
      async: true
    })

    // Adjust crit range if the die size was adjusted
    critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = {
      upperThreshold: critRange
    }

    /* Check for crit or fumble */
    const crit = (d20RollResult > 1 && (d20RollResult >= critRange || options.backstab))
    const fumble = (d20RollResult === 1)

    console.warn('DCC-QOL |', debuginfo)

    return {
      rolled: true,
      roll: attackRoll,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      hitsAc: attackRoll.total,
      d20Roll: d20RollResult,
      crit,
      fumble
    }
  }
}

export default DCCQOL