Zotero.MASMetaData = new function () {
    const _citeCountStrLength = 7;
    const _extraPrefix = 'ECC: ';
    const _extraEntrySep = ' \n';
    const _noData = 'No Data';
    const _extraRegex = new RegExp('^(?!' + _extraPrefix + '(\\d{' + _citeCountStrLength + '}|' + _noData + ')).*$', 'gm');
    const _this = this;

    // Startup - initialize plugin

    this.init = function () {
        this.resetState('initial');

        // Register callbacks in Zotero as item observers
        if (this.notifierID == null)
            this.notifierID = Zotero.Notifier.registerObserver(this.notifierCallback, ['item']);
        // Unregister callback when the window closes (important to avoid a memory leak)
        window.addEventListener('unload', function (e) {
            Zotero.Notifier.unregisterObserver(_this.notifierID);
            _this.notifierID = null;
        }, false);

    };

    this.notifierCallback = {
        notify: function (event, type, ids, extraData) {
            if (type == 'item' && event == 'add' && getPref('autoretrieve')) {
                _this.updateItems(Zotero.Items.get(ids), 'update');
            };
        }
    };

    /**
     * Open masmetadata preference window
     */
    this.openPreferenceWindow = function (paneID, action) {
        let io = { pane: paneID, action: action };
        window.openDialog('chrome://masmetadata/content/options.xul',
            'masmetadata-pref',
            'chrome,titlebar,toolbar,centerscreen' + Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal', io
        );
    };

    this.setPrefToDefault = function (pref) {
        clearPref(pref);
    };

    /** Update logic */

    this.resetState = function (operation) {
        if (this.progressWin) {
            this.progressWin.close();
        };
        switch (operation) {
            case 'error':
                icon = 'chrome://zotero/skin/cross.png';
                resetWindow = new this.ProgressWindow();
                resetWindow.changeHeadline('Error');
                resetWindow.progress = new resetWindow.ItemProgress(icon, 'Something went wrong.');
                resetWindow.progress.setError();
                resetWindow.show();
                resetWindow.startCloseTimer(4000);
                break;
            case 'update':
                icon = 'chrome://zotero/skin/tick.png';
                resetWindow = new this.ProgressWindow();
                resetWindow.changeHeadline('Finished');
                resetWindow.progress = new resetWindow.ItemProgress(icon);
                resetWindow.progress.setProgress(100);
                resetWindow.progress.setText(this.numberOfUpdatedItems + ' of ' + this.numberOfItemsToUpdate + ' citation count(s) updated.');
                resetWindow.show();
                resetWindow.startCloseTimer(4000);
                break;
            case 'remove':
                icon = 'chrome://zotero/skin/tick.png';
                resetWindow = new this.ProgressWindow();
                resetWindow.changeHeadline('Finished');
                resetWindow.progress = new resetWindow.ItemProgress(icon);
                resetWindow.progress.setProgress(100);
                resetWindow.progress.setText(this.numberOfUpdatedItems + ' citation count(s) removed.');
                resetWindow.show();
                resetWindow.startCloseTimer(4000);
                break;
            case 'abort':
                icon = 'chrome://zotero/skin/cross.png';
                resetWindow = new this.ProgressWindow();
                resetWindow.changeHeadline('Aborted');
                resetWindow.progress = new resetWindow.ItemProgress(icon);
                resetWindow.progress.setProgress(100);
                resetWindow.progress.setText(this.numberOfUpdatedItems + ' of ' + this.numberOfItemsToUpdate + ' citation count(s) updated.');
                resetWindow.show();
                resetWindow.startCloseTimer(4000);
                break;
            default:
                break;
        };
        this.numberOfItemsToUpdate = 0;
        this.itemsToUpdate = null;
        this.currentItemIndex = 0;
        this.numberOfUpdatedItems = 0;
    };

    this.updateSelectedItems = function (operation) {
        this.updateItems(ZoteroPane.getSelectedItems(), operation);
    };

    function itemHasField(item, field) {
        return Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID(field), item.itemTypeID);
    }

    this.updateItems = function (items, operation) {
        // TODO: is this enough filter?
        // items = items.filter(item => item.itemTypeID != Zotero.ItemTypes.getID('attachment'));
        // items = items.filter(item => item.isTopLevelItem());
        items = items.filter(item => item.getField('title'));
        items = items.filter(item => itemHasField(item, 'extra'));

        if (items.length === 0 ||
            this.currentItemIndex < this.numberOfItemsToUpdate) {
            return;
        };

        this.resetState('initial');
        this.numberOfItemsToUpdate = items.length;
        this.itemsToUpdate = items;

        // Progress Windows
        this.progressWin = new this.ProgressWindow({ callOnClick: [] });
        let icon = 'chrome://zotero/skin/toolbar-advanced-search' + (Zotero.hiDPI ? '@2x' : '') + '.png';
        let headline = '';
        switch (operation) {
            case 'update':
                headline = 'Getting citations counts';
                break;
            case 'remove':
                headline = 'Removing citation counts';
                break;
            default:
                headline = 'Default headline';
                break;
        }
        this.progressWin.changeHeadline(headline, icon);
        this.progressWin.progress = new this.progressWin.ItemProgress();
        this.progressWin.show();

        this.updateNextItem(operation);
    };

    this.updateNextItem = function (operation) {
        this.currentItemIndex++;

        if (this.currentItemIndex > this.numberOfItemsToUpdate) {
            this.resetState(operation);
            return;
        };

        // Progress Windows
        let percent = Math.round(((this.currentItemIndex - 1) / this.numberOfItemsToUpdate) * 100);
        this.progressWin.progress.setProgress(percent);
        this.progressWin.progress.setText('Update Item ' + this.currentItemIndex + ' of ' + this.numberOfItemsToUpdate + ' (click to abort)');

        this.updateItem(
            this.itemsToUpdate[this.currentItemIndex - 1], operation);
    };

    this.updateItem = function (item, operation) {
        switch (operation) {
            case 'update':
                this.fastEvaluateExpr(item, operation);
                break;
            case 'remove':
                this.removeMetaData(item, operation);
                break;
            default:
                break;
        };
    };

    this.removeMetaData = function (item, operation) {
        this.removeCitation(item);
        this.updateNextItem(operation);
    };

    /** Make API Requests */
    this.fastEvaluateExpr = function (item, operation) {
        request_type = 'evaluate';
        let title = item.getField('title');
        let year = item.getField('year');
        if (!(title && year)) {
            this.interpretQuery(item, operation);
            return;
        }
        title = title.replace(/\W/g, ' ').replace(/\s+/g, ' ').toLowerCase();
        let expr = "And(Y=" + year + ",Ti='" + title + "')";

        let params = {
            // Request parameters
            'expr': expr,
            'model': 'latest',
            'count': '10',
            'offset': '0',
            // 'orderby': '{string}',
            'attributes': 'CC,ECC',
        };
        req = new MasAPIQuery(request_type, params);
        req.send()
            .then(function (res) {
                let entities = res.entities;
                if (entities.length == 1) {
                    let ecc = entities[0].ECC;
                    // get entry with highest cite count
                    // let highest_logprob = entities[0].logprob;
                    // let entity;
                    // for (entity of entities) {
                    //     if (entity.logprob >= highest_logprob) {
                    //         ecc = Math.max(ecc, entity.ECC);
                    //     } else {
                    //         break;
                    //     };
                    // };
                    _this.updateCitation(item, ecc);
                    _this.updateNextItem(operation);
                } else {
                    _this.interpretQuery(item, operation);
                }
            })
            .catch(function (err) {
                _this.resetState(err.action);
            });
        this.progressWin.getProgressWindow().addEventListener('mouseup', function () {
            req.abort();
        }, false);
    };

    this.interpretQuery = function (item, operation) {
        let request_type = 'interpret';
        let title = item.getField('title');
        let year = item.getField('year');
        let creators = item.getCreators();
        let delimiter = ', '
        let query = '';

        title = title.replace(/\W/g, ' ').replace(/\s+/g, ' ')
        query += title
        if (year) query += delimiter + year;
        // if (creators && creators.length > 0) {
        //     creator = creators[0]
        //     // only get initial of first first name
        //     let firstName = creator.firstName.toLowerCase()
        //     firstName = firstName.trim().charAt(0)
        //     // remove all non word characters
        //     let lastName = creator.lastName.toLowerCase()
        //     lastName = lastName.replace(/\W/g, '')
        //     query += firstName + ' ' + lastName + delimiter
        // }
        // replace non word character with spaces

        let params = {
            // Request parameters
            'query': query,
            'complete': '0',
            'count': '10',
            // 'offset': '{number}',
            // 'timeout': '{number}',
            'model': 'latest',
        };

        req = new MasAPIQuery(request_type, params);
        req.send()
            .then(function (res) {
                let intp = res.interpretations[0];
                Zotero.debug('[mas-metadata]: The logprob for MAS query: ' + intp.logprob);
                if (intp.logprob > getPref('logprob')) {
                    let expr = intp.rules[0].output.value;
                    _this.evaluateExpr(item, expr, operation);
                } else {
                    _this.updateCitation(item, intp.logprob);
                    _this.updateNextItem(operation);
                }
            })
            .catch(function (err) {
                _this.resetState(err.action);
            });
        this.progressWin.getProgressWindow().addEventListener('mouseup', function () {
            req.abort();
        }, false);
    };

    this.evaluateExpr = function (item, expr, operation) {
        request_type = 'evaluate';
        let params = {
            // Request parameters
            'expr': expr,
            'model': 'latest',
            'count': '10',
            'offset': '0',
            // 'orderby': '{string}',
            'attributes': 'CC,ECC',
        };
        req = new MasAPIQuery(request_type, params);
        req.send()
            .then(function (res) {
                let entities = res.entities;
                // get entry with highest cite count
                let ecc = entities[0].ECC;
                let highest_logprob = entities[0].logprob;
                let entity;
                for (entity of entities) {
                    if (entity.logprob >= highest_logprob) {
                        ecc = Math.max(ecc, entity.ECC);
                    } else {
                        break;
                    };
                }
                _this.updateCitation(item, ecc);
                _this.updateNextItem(operation);
            })
            .catch(function (err) {
                _this.resetState(err.action);
            });
        this.progressWin.getProgressWindow().addEventListener('mouseup', function () {
            req.abort();
        }, false);
    };

    /** Change Extra Field */

    // this.removeCitation = function (item) {
    //     let curExtra = item.getField('extra');
    //     let matches = curExtra.match(_extraRegex);
    //     let newExtra = matches[3];

    //     if (curExtra != newExtra) {
    //         this.numberOfUpdatedItems++;
    //     }

    //     item.setField('extra', newExtra);

    //     try { item.saveTx(); } catch (e) {
    //         Zotero.logError(e);
    //     }
    // };

    // this.updateCitation = function (item, citeCount) {
    //     let curExtra = item.getField('extra');
    //     let matches = curExtra.match(_extraRegex);
    //     let newExtra = '';
    //     newExtra += this.buildCiteCountString(citeCount);
    //     this.numberOfUpdatedItems++;

    //     if (/^\s\n/.test(matches[3]) || matches[3] === '') {
    //         // do nothing, since the separator is already correct or not needed at all
    //     } else if (/^\n/.test(matches[3])) {
    //         newExtra += ' ';
    //     } else {
    //         newExtra += _extraEntrySep;
    //     }
    //     newExtra += matches[3];

    //     item.setField('extra', newExtra);

    //     try { item.saveTx(); } catch (e) {
    //         Zotero.logError(e);
    //     }
    // };

    this.removeCitation = function (item) {
        let curExtra = item.getField('extra');
        let newExtra = ''
        let matches = curExtra.match(_extraRegex)
        if (matches != null) {
            newExtra = curExtra.match(_extraRegex).join('\n')
        }
        if (newExtra != curExtra) {
            this.numberOfUpdatedItems++;
        }
        item.setField('extra', newExtra);
        try { item.saveTx(); } catch (e) {
            Zotero.logError(e);
        }
    };

    this.updateCitation = function (item, citeCount) {
        let curExtra = item.getField('extra');
        let newExtra = this.buildCiteCountString(citeCount);
        let matches = curExtra.match(_extraRegex)
        if (matches != null) {
            newExtra += curExtra.match(_extraRegex).join('\n')
        }
        this.numberOfUpdatedItems++;
        item.setField('extra', newExtra);
        try { item.saveTx(); } catch (e) {
            Zotero.logError(e);
        }
    }

    this.buildCiteCountString = function (citeCount) {
        if (citeCount < 0)
            return _extraPrefix + _noData + ' (logprob: ' + citeCount.toString() + ')' + _extraEntrySep;
        else
            return _extraPrefix + this.padLeftWithZeroes(citeCount.toString()) + _extraEntrySep;
    };

    this.padLeftWithZeroes = function (numStr) {
        let output = '';
        let cnt = _citeCountStrLength - numStr.length;
        for (let i = 0; i < cnt; i++) { output += '0'; };
        output += numStr;
        return output;
    };

    /** Functions */

    // Preference managers
    function getPref(pref) {
        return Zotero.Prefs.get('extensions.masmetadata.' + pref, true);
    };

    function setPref(pref, value) {
        return Zotero.Prefs.set('extensions.masmetadata.' + pref, value, true);
    };

    function clearPref(pref) {
        return Zotero.Prefs.clear('extensions.masmetadata.' + pref, true);
    };
};