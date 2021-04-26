export class MasAPIQuery {
    constructor(request_type, params) {
        this._baseUrl = 'https://api.labs.cognitive.microsoft.com/academic/v1.0/';
        this.req = new XMLHttpRequest();
        this.request_type = request_type;
        this.params = params;
        this.key = Zotero.MASMetaData.APIKey.getAPIKey();
    }

    send() {
        const url = this._baseUrl + this.request_type + this._formatParams(this.params);
        Zotero.debug('[mas-metadata]: The url for MAS query: ' + url);
        this.req.open('GET', url, true);
        this.req.setRequestHeader('Ocp-Apim-Subscription-Key', this.key);
        this.req.responseType = 'json';

        const _this = this;
        return new Promise(function (resolve, reject) {
            _this.req.onload = function () {
                let res = _this.req.response;
                if (this.status === 200) {
                    resolve(res);
                } else {
                    reject({
                        action: 'error'
                    });
                    if (res.error) {
                        let error = res.error;
                        Zotero.alert(null, 'MASMetaData', 'ERROR: ' + this.status + '\n'
                            + 'Code: ' + error.code + '\n'
                            + 'Message: ' + error.message);
                    } else {
                        Zotero.alert(null, 'MASMetaData', JSON.stringify(res));
                    }
                }
            };
            _this.req.onerror = function () {
                reject({
                    action: 'error'
                });
                Zotero.alert(null, 'MASMetaData', this);
            };
            _this.req.onabort = function () {
                reject({
                    action: 'abort',
                });
            };
            _this.req.onloadend = function () {

            }
            _this.req.send();
        });
    };

    abort() {
        this.req.abort();
    }

    _formatParams(params) {
        return '?' + Object
            .keys(params)
            .map(function (key) {
                return key + '=' + params[key]
            })
            .join('&');
    };
}
