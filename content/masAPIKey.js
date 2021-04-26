Zotero.MASMetaData.APIKey = new function () {
    const _loginManagerHost = 'chrome://zotero';
    const _loginManagerRealm = 'Microsoft Academic Search API';

    this.setAPIKey = function (apiKey) {
		let loginManager = Components.classes["@mozilla.org/login-manager;1"]
			.getService(Components.interfaces.nsILoginManager);
		
		let oldLoginInfo = _getAPIKeyLoginInfo();

		if ((!apiKey || apiKey === "")) {
			if (oldLoginInfo) {
				Zotero.debug("[mas-metadata]: Clearing old MAS API key");
				loginManager.removeLogin(oldLoginInfo);
			}
			return;
		}
		
		let nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
		let loginInfo = new nsLoginInfo(
			_loginManagerHost,
			null,
			_loginManagerRealm,
			'API Key',
			apiKey,
			'',
			''
		);
		if (!oldLoginInfo) {
			Zotero.debug("[mas-metadata]: Setting MAS API key");
			loginManager.addLogin(loginInfo);
		}
		else {
			Zotero.debug("[mas-metadata]: Replacing MAS API key");
			loginManager.modifyLogin(oldLoginInfo, loginInfo);
		}
		Zotero.Notifier.trigger('modify', 'api-key', []);
    };
    
    this.getAPIKey = function () {
		let login = _getAPIKeyLoginInfo();
		return login ? login.password : "";
    };
    
    function _getAPIKeyLoginInfo() {
		try {
			// Get Login Manager 
			let loginManager = Components.classes["@mozilla.org/login-manager;1"].
				getService(Components.interfaces.nsILoginManager);
			  
			// Find users for the given parameters
			let logins = loginManager.findLogins(
				{},
				_loginManagerHost,
				null,
				_loginManagerRealm
			);
			// Get API from returned array of nsILoginInfo objects
			return logins.length ? logins[0] : false;
		}
		catch(ex) {
			// This will only happen if there is no nsILoginManager component class
			Zotero.logError(ex);
			return false;
		}
	};
}