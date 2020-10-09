all: Makefile.in

-include Makefile.in

RELEASE:=$(shell grep em:version install.rdf | head -n 1 | sed -e 's/ *<em:version>//' -e 's/<\/em:version>//')

mas-metadata.xpi: FORCE
	rm -rf $@
	zip -r $@ chrome chrome.manifest defaults install.rdf -x \*.DS_Store

mas-metadata-%-fx.xpi: mas-metadata.xpi
	mv $< $@

Makefile.in: install.rdf
	echo "all: mas-metadata-${RELEASE}-fx.xpi" > Makefile.in

FORCE:
