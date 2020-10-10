all: Makefile.in

-include Makefile.in

RELEASE:=$(shell grep em:version install.rdf | head -n 1 | sed -e 's/ *<em:version>//' -e 's/<\/em:version>//')

zotero-mas-metadata.xpi: FORCE
	rm -rf $@
	zip -r $@ chrome chrome.manifest defaults install.rdf -x \*.DS_Store

zotero-mas-metadata-%-fx.xpi: zotero-mas-metadata.xpi
	mv $< $@

Makefile.in: install.rdf
	echo "all: zotero-mas-metadata-${RELEASE}-fx.xpi" > Makefile.in

FORCE:
