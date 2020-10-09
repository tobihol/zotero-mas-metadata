// Only create main object once
if (!Zotero.MASMetaData) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader);
	let scripts = ["masmetadata", "progressWindow"]
	scripts.forEach(s => loader.loadSubScript("chrome://masmetadata/content/" + s + ".js"));
}

window.addEventListener('load', function (e) {
    Zotero.MASMetaData.init();
}, false);