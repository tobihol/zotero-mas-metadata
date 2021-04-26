declare const Zotero: any
declare const ZoteroItemPane: any
declare const Components: any
declare const window: any

import { MasAPIQuery } from './masAPIQuery'
import { getMASMetaData, setMASMetaData, removeMASMetaData, getPref, clearPref } from './utils'
import { patch as $patch$ } from './monkey-patch'
import { attributes } from './attributes'

const MASMetaData = Zotero.MASMetaData || new class { // tslint:disable-line:variable-name
  private initialized: boolean = false
  private attributesToDisplay: object = {}
  private attributesForRequests: string = ''
  private observer: number = null

  constructor() {
    window.addEventListener('load', event => {
      this.load().catch(err => Zotero.logError(err))
    }, false)
    window.addEventListener('unload', event => {
      this.unload().catch(err => Zotero.logError(err))
    })
  }

  public openPreferenceWindow = (paneID, action) => {
    const io = { pane: paneID, action }
    window.openDialog('chrome://zotero-mas-metadata/content/options.xul',
      'mas-metadata-pref',
      'chrome,titlebar,toolbar,centerscreen' + Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal', io
    )
  }

  public setPrefToDefault = pref => {
    clearPref(pref)
  }

  public updateSelectedItems = operation => {
    const items = Zotero.getActiveZoteroPane().getSelectedItems()
    this.updateItems(items, operation)
  }

  protected async notify(event, type, ids, extraData) {
    if (!(type === 'item' && event === 'add' && getPref('autoretrieve'))) return
    this.updateItems(Zotero.Items.get(ids), 'update')
  }

  private async load() {
    if (this.initialized) return
    this.initialized = true
    this.observer = Zotero.Notifier.registerObserver(this, ['item'], 'MASMetaData')
    Zotero.initializationPromise.then(() => {
      this.attributesToDisplay = attributes.display
      this.attributesForRequests = Object.values(attributes.request).join(',')
      this.patchXUL(this.attributesToDisplay)
      this.patchFunctions(this.attributesToDisplay)
    })
  }

  private async unload() {
    Zotero.Notifier.unregisterObserver(this.observer)
  }

  private patchXUL(attributesToDisplay) {
    const xul = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
    const attributeKeyList = Object.keys(attributesToDisplay)
    // patch for tab
    const tabsContainer = document.getElementById('mas-metadata-fields')
    attributeKeyList.forEach(attr => {
      const newRow = document.createElementNS(xul, 'row')
      newRow.setAttribute('class', 'zotero-item-first-row')
      const newLabel = document.createElement('label')
      newLabel.setAttribute('id', `mas-metadata-tab-${attr}-label`)
      newLabel.setAttribute('value', `${attr}:`)
      const newTestbox = document.createElement('textbox')
      newTestbox.setAttribute('id', `mas-metadata-tab-${attr}-display`)
      newTestbox.setAttribute('class', 'plain')
      newTestbox.setAttribute('readonly', 'true')
      newTestbox.setAttribute('value', 'undefined')
      newRow.appendChild(newLabel)
      newRow.appendChild(newTestbox)
      tabsContainer.appendChild(newRow)
    })

    // patch for columns
    const columnsContainer = document.getElementById('zotero-items-columns-header')
    attributeKeyList.forEach(attr => {
      const newTreecol = document.createElementNS(xul, 'treecol')
      newTreecol.setAttribute('id', `zotero-items-column-mas-metadata-${attr}`)
      newTreecol.setAttribute('mas-metadata-menu', 'true')
      newTreecol.setAttribute('label', `${attr}`)
      newTreecol.setAttribute('flex', '1')
      newTreecol.setAttribute('insertafter', 'zotero-items-column-title')
      newTreecol.setAttribute('zotero-persist', 'width ordinal hidden sortActive sortDirection')
      columnsContainer.appendChild(newTreecol)
    })
  }

  private patchFunctions(attributesToDisplay) {
    /**
     * patches for tab
     */

    $patch$(ZoteroItemPane, 'viewItem', original => async function(item, _mode, _index) {
      await original.apply(this, arguments)
      if (!item.isNote() && !item.isAttachment()) {
        const masData = getMASMetaData(item)
        Object.keys(attributesToDisplay).forEach(attr => {
          const masAttr = attributesToDisplay[attr]
          document.getElementById(`mas-metadata-tab-${attr}-display`).setAttribute('value', masData[masAttr])
        })
      }
    })

    /**
     * patches for columns 
     */

    $patch$(Zotero.Item.prototype, 'getField', original => function(field, unformatted, includeBaseMapped) {
      if (typeof field === 'string') {
        const match = field.match(/^mas-metadata-/)
        if (match) {
          const attr = field.slice(match[0].length)
          const masAttr = attributesToDisplay[attr]
          return getMASMetaData(this)[masAttr]
        }
      }
      return original.apply(this, arguments)
    })

    $patch$(Zotero.ItemTreeView.prototype, 'getCellText', original => function(row, col) {
      // if (col.id !== 'zotero-items-column-mas-metadata-ecc') return original.apply(this, arguments)
      const match = col.id.match(/^zotero-items-column-mas-metadata-/)
      if (!match) return original.apply(this, arguments)
      const item = this.getRow(row).ref
      if (item.isNote() || item.isAttachment()) return ''
      const attr = col.id.slice(match[0].length)
      const masAttr = attributesToDisplay[attr]
      return getMASMetaData(item)[masAttr]
    })

    /**
     * patches for columns submenu
     */

    $patch$(Zotero.ItemTreeView.prototype, 'onColumnPickerShowing', original => function(event) {
      const menupopup = event.originalTarget

      const ns = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
      const prefix = 'zotero-column-header-'
      const doc = menupopup.ownerDocument

      const anonid = menupopup.getAttribute('anonid')
      if (anonid.indexOf(prefix) === 0) {
        return
      }

      const lastChild = menupopup.lastChild

      try {
        // More Columns menu
        const id = prefix + 'mas-metadata-menu'

        const masMenu = doc.createElementNS(ns, 'menu')
        // masMenu.setAttribute('label', Zotero.getString('pane.items.columnChooser.moreColumns'))
        masMenu.setAttribute('label', 'MASMetaData')
        masMenu.setAttribute('anonid', id)

        const masMenuPopup = doc.createElementNS(ns, 'menupopup')
        masMenuPopup.setAttribute('anonid', id + '-popup')

        const treecols = menupopup.parentNode.parentNode
        const subs = Array.from(treecols.getElementsByAttribute('mas-metadata-menu', 'true')).map((x: any) => x.getAttribute('label'))
        const masItems = []

        for (const elem of menupopup.childNodes) {
          if (elem.localName === 'menuseparator') {
            break
          }
          if (elem.localName === 'menuitem' && subs.indexOf(elem.getAttribute('label')) !== -1) {
            masItems.push(elem)
          }
        }
        // Disable certain fields for feeds
        const labels = Array.from(treecols.getElementsByAttribute('disabled-in', '*'))
          .filter((e: any) => e.getAttribute('disabled-in').split(' ').indexOf(this.collectionTreeRow.type) !== -1)
          .map((e: any) => e.getAttribute('label'))
        for (const elem of menupopup.childNodes) {
          elem.setAttribute('disabled', labels.indexOf(elem.getAttribute('label')) !== -1)
        }
        // Sort fields and move to submenu
        const collation = Zotero.getLocaleCollation()
        masItems.sort((a, b) => {
          return collation.compareString(1, a.getAttribute('label'), b.getAttribute('label'))
        })
        masItems.forEach(elem => {
          masMenuPopup.appendChild(menupopup.removeChild(elem))
        })

        masMenu.appendChild(masMenuPopup)
        menupopup.insertBefore(masMenu, lastChild)
      } catch (e) {
        Components.utils.reportError(e)
        Zotero.debug(e, 1)
      }
      original.apply(this, arguments)
    })
  }

  private updateItems(items, operation) {
    items = items.filter(item => item.isTopLevelItem())
    items = items.filter(item => item.getField('title'))
    switch (operation) {
      case 'update':
        items.forEach(item => {
          this.fastEvaluateExpr(item)
        })
        break
      case 'remove':
        items.forEach(item => {
          removeMASMetaData(item)
        })
        break
      default:
        break
    }
  }

  private fastEvaluateExpr(item) {
    const request_type = 'evaluate'
    let title = item.getField('title')
    const year = item.getField('year')
    if (!(title && year)) {
      this.interpretQuery(item)
      return
    }
    title = title.replace(/\W/g, ' ').replace(/\s+/g, ' ').toLowerCase()
    const expr = `And(Y=${year},Ti='${title}')`

    const params = {
      // Request parameters
      expr,
      model: 'latest',
      count: '10',
      offset: '0',
      // 'orderby': '{string}',
      attributes: this.attributesForRequests,
    }
    const req = new MasAPIQuery(request_type, params)
    req.send()
      .then(res => {
        const entities = res.entities
        if (entities.length === 1) {
          this.updateMASFile(item, entities[0])
        } else {
          this.interpretQuery(item)
        }
      })
      .catch(err => {
        Zotero.alert(null, 'MASMetaData', err)
      })
  }

  private interpretQuery(item) {
    const request_type = 'interpret'
    let title = item.getField('title')
    const year = item.getField('year')
    const creators = item.getCreators()
    const delimiter = ', '
    let query = ''

    title = title.replace(/\W/g, ' ').replace(/\s+/g, ' ')
    query += title
    if (year) query += delimiter + year

    const params = {
      // Request parameters
      query,
      complete: '0',
      count: '10',
      // 'offset': '{number}',
      // 'timeout': '{number}',
      model: 'latest',
    }

    const req = new MasAPIQuery(request_type, params)
    req.send()
      .then(res => {
        const intp = res.interpretations[0]
        Zotero.debug('[mas-metadata]: The logprob for MAS query: ' + intp.logprob)
        if (intp.logprob > getPref('logprob')) {
          const expr = intp.rules[0].output.value
          this.evaluateExpr(item, expr)
        } else {
          this.updateMASFile(item, intp)
        }
      })
      .catch(err => {
        Zotero.alert(null, 'MASMetaData', err)
      })
  }

  private evaluateExpr(item, expr) {
    const request_type = 'evaluate'
    const params = {
      // Request parameters
      expr,
      model: 'latest',
      count: '10',
      offset: '0',
      // 'orderby': '{string}',
      attributes: this.attributesForRequests,
    }
    const req = new MasAPIQuery(request_type, params)
    req.send()
      .then(res => {
        const entities = res.entities
        // get entry with highest cite count
        const highest_logprob = entities[0].logprob
        let bestEntity = entities[0]
        entities.forEach(entity => {
          if (entity.logprob >= highest_logprob && entity.ECC > bestEntity.ECC) {
            bestEntity = entity
          }
        })
        this.updateMASFile(item, bestEntity)
      })
      .catch(err => {
        Zotero.alert(null, 'MASMetaData', err)
      })
  }

  private updateMASFile(item, data) {
    setMASMetaData(item, data)
  }
}

export = MASMetaData

// otherwise this entry point won't be reloaded: https://github.com/webpack/webpack/issues/156
delete require.cache[module.id]
