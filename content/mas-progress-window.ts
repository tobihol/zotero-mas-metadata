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
            headline = 'Getting citations counts'
            break
        case 'remove':
            headline = 'Removing citation counts'
            break
        default:
            break
    }
    this.progressWin.changeHeadline(headline, icon)
  }

  private updateText() {
    this.progressWin.progress.setText(`${this.capitalizeFirstLetter(this.operation)} Item ${this.nDone} of ${this.nAll}`)
  }

  private endWindow(outcome: string) {
    let headline = 'Default headline'
    let icon = ''
    let text = 'Default text'
    switch (outcome) {
      case 'error':
        headline = 'Error'
        icon = 'chrome://zotero/skin/cross.png'
        text = 'Something went wrong.'
        break
      case 'update':
        headline = 'Finished'
        icon = 'chrome://zotero/skin/tick.png'
        text = `${this.nDone - this.nFail} of ${this.nAll} citation count(s) updated.`
        break
      case 'remove':
        headline = 'Finished'
        icon = 'chrome://zotero/skin/tick.png'
        text = `${this.nDone - this.nFail} citation count(s) removed.`
        break
      case 'abort':
        headline = 'Aborted'
        icon = 'chrome://zotero/skin/cross.png'
        text = `${this.nDone - this.nFail} of ${this.nAll} citation count(s) updated.`
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
