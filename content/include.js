// Only create main object once
if (!Zotero.MASMetaData) {
	let loader = Components.classes['@mozilla.org/moz/jssubscript-loader;1']
					.getService(Components.interfaces.mozIJSSubScriptLoader);
	let scripts = ['webpack','MASMetaData', 'masAPIKey'];
	scripts.forEach(s => loader.loadSubScript('chrome://zotero-mas-metadata/content/' + s + '.js'));
};
