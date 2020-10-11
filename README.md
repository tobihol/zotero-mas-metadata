# Zotero MAS MetaData

MAS MetaData is a [Zotero](https://github.com/zotero/zotero.git) plugin that uses Microsoft Academic Search API (MAS) to add more metadata to Zotero. Currently it only adds citation counts to the extra field of items in Zotero. This will be extended upon in future versions.

You need to generate an api key for the Microsoft Academic Search (MAS) API to use this plugin. The MAS API is provided by the Project Academic Knowledge from Microsoft. 
Docs: 
https://msr-apis.portal.azure-api.net/docs/services/academic-search-api/, https://docs.microsoft.com/en-us/academic-services/project-academic-knowledge/

This plugin is based in part on [Zotero Google Scholar Citations](https://github.com/MaxKuehn/zotero-scholar-citations.git) and [Zotero DOI Manager](https://github.com/bwiernik/zotero-shortdoi).

## Installation

1. Download the [latest version](https://github.com/TobiHol/zotero-mas-metadata/releases/latest) of Zotero MAS MetaData
2. Start Zotero and go to `Tools -> Add-ons -> Tools for all Add-ons (wheel in the top right corner) -> Install Add-on From File` select the downloaded .xpi file and restart
3. Generate your api key at https://msr-apis.portal.azure-api.net/products/project-academic-knowledge
4. Add the key ([primary or secondary](https://docs.microsoft.com/en-us/archive/blogs/mast/why-does-an-azure-storage-account-have-two-access-keys)) to `Tools -> MASMetaData Preferences... -> MAS API Key`

## Microsoft Academic Search API

### Rate Limits

The free api has a rate limit of 10,000 transactions per month, 3 per second for interpret, 1 per second for evaluate, 6 per minute for calcHistogram.

The plugin currently uses one interpret request and one evaluate request per item. Thus you can update metadata for 5,000 items per month (per subscription) for free.

### Citation Count

The plugin adds citation counts to the extra field of items in Zotero. The citation count used is the estimated citation count (`ECC`) from Microsoft , which is calculated using the Microsoft Academic Graph data to get a more accurate citation count for each publication (at least thats what Microsoft says https://academic.microsoft.com/faq?target=ranking1).

### Logprob

Successfully query responses from the MAS API come with a probability (`prob`) value between 0 and 1. This value determines how likely the response is to be correct (higher - more likely to be correct).

In the setting `Tools -> MASMetaData Preferences... -> Advanced Settings` you can edit a cutoff probability. Responses with lower probability than the cutoff are excluded. The setting uses the logarithm of the probability (`logprob`) for ease of use.