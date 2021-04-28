declare const Zotero: any

const closeTimer = 4000

export class MASProgressWindow{
  private progressWin: any
  private nAll: number = 0
  private nDone: number = 0
  private nFail: number = 0
  private operation: string

  constructor(operation: string, nAll: number) {
    this.progressWin = new Zotero.ProgressWindow({closeOnClick: false})
    this.progressWin.progress = new this.progressWin.ItemProgress()
    this.operation = operation
    this.nAll = nAll
    this.nDone = 0
    this.updateHeadline()
    this.updateText()
    this.progressWin.show()
  }

  public next(fail=false) {
    if (fail) this.nFail++
    this.nDone++
    const percent = Math.round((this.nDone / this.nAll) * 100) // tslint:disable-line:no-magic-numbers
    this.progressWin.progress.setProgress(percent)
    this.updateText()
    if (this.isFinished()) {
      try {
        this.progressWin.close()
        this.endWindow(this.operation)
      } catch (error) {
        Zotero.logError(error)
      }
    }
  }

  public isFinished() {
    return (this.nDone >= this.nAll)
  }

  private updateHeadline() {
    const icon = `chrome://zotero/skin/toolbar-advanced-search${Zotero.hiDPI ? '@2x' : ''}.png`
    let headline = 'Default headline'
    switch (this.operation) {
        case 'update':
            headline = Zotero.MASMetaData.getString('MASProgressWindow.headline.update')
            break
        case 'remove':
            headline = Zotero.MASMetaData.getString('MASProgressWindow.headline.remove')
            break
        default:
            break
    }
    this.progressWin.changeHeadline(headline, icon)
  }

  private updateText() {
    let text = 'Default text'
    switch (this.operation) {
      case 'update':
        text = Zotero.MASMetaData.getString('MASProgressWindow.text.update', {
          nDone: this.nDone,
          nAll: this.nAll,
        })
        break
      case 'remove':
        text = Zotero.MASMetaData.getString('MASProgressWindow.text.remove', {
          nDone: this.nDone,
          nAll: this.nAll,
        })
        break
      default:
        break
    }
    this.progressWin.progress.setText(text)
  }

  private endWindow(outcome: string) {
    let headline = 'Default headline'
    let icon = ''
    let text = 'Default text'
    switch (outcome) {
      case 'error':
        headline = Zotero.MASMetaData.getString('MASProgressWindow.end.headline.error')
        icon = 'chrome://zotero/skin/cross.png'
        text = Zotero.MASMetaData.getString('MASProgressWindow.end.text.error')
        break
      case 'update':
        headline = Zotero.MASMetaData.getString('MASProgressWindow.end.headline.update')
        icon = 'chrome://zotero/skin/tick.png'
        text = Zotero.MASMetaData.getString('MASProgressWindow.end.text.update', {
          nSuccess: this.nDone - this.nFail,
          nAll: this.nAll,
        })
        break
      case 'remove':
        headline = Zotero.MASMetaData.getString('MASProgressWindow.end.headline.remove')
        icon = 'chrome://zotero/skin/tick.png'
        text = Zotero.MASMetaData.getString('MASProgressWindow.end.text.remove', {
          nSuccess: this.nDone - this.nFail,
          nAll: this.nAll,
        })
        break
      case 'abort':
        headline = Zotero.MASMetaData.getString('MASProgressWindow.end.headline.abort')
        icon = 'chrome://zotero/skin/cross.png'
        text = Zotero.MASMetaData.getString('MASProgressWindow.end.text.abort', {
          nSuccess: this.nDone - this.nFail,
          nAll: this.nAll,
        })
        break
      default:
        break
    }
    const endWindow = new Zotero.ProgressWindow()
    endWindow.changeHeadline(headline)
    endWindow.progress = new endWindow.ItemProgress(icon, text)
    if (outcome === 'error') {
      endWindow.progress.setError()
    } else {
      endWindow.progress.setProgress(100) // tslint:disable-line:no-magic-numbers
    }
    endWindow.show()
    endWindow.startCloseTimer(closeTimer)
  }

  private capitalizeFirstLetter(word) {
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
}
