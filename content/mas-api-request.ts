declare const Zotero: any

const baseUrl = 'https://api.labs.cognitive.microsoft.com/academic/v1.0/'
const requestType = {
  INTERPRET: 'interpret?',
  EVALUATE: 'evaluate?',
}

function makeRequest(opts) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let params = opts.params
    if (params && typeof params === 'object') {
      params = Object.keys(params).map(
        key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&')
    }
    const url = opts.url + params
    Zotero.debug(`[mas-metadata]: mas api request: ${url}`)
    xhr.open(opts.method, url)
    xhr.onload = function() {
      // tslint:disable-next-line:no-magic-numbers
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response)
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        })
      }
    }
    xhr.onerror = function() {
      reject({
        status: this.status,
        statusText: xhr.statusText,
      })
    }
    if (opts.headers) {
      Object.keys(opts.headers).forEach(key => {
        xhr.setRequestHeader(key, opts.headers[key])
      })
    }
    xhr.responseType = 'json'
    xhr.send()
  })
}

function makeMASRequest(reqType, params) {
  return makeRequest({
    method: 'GET',
    url: baseUrl + reqType,
    headers: { 'Ocp-Apim-Subscription-Key': Zotero.MASMetaData.APIKey.getAPIKey() },
    params,
  })
}

function iterpretQuery(query) {
  return makeMASRequest(requestType.INTERPRET, {
    query,
    complete: '0',
    count: '10',
    // 'offset': '{number}',
    // 'timeout': '{number}',
    model: 'latest',
  })
}

function evaluateExpr(expr, attributes) {
  return makeMASRequest(requestType.EVALUATE, {
    // Request parameters
    expr,
    attributes,
    model: 'latest',
    count: '10',
    offset: '0',
    // 'orderby': '{string}',
  })
}

export function requestChain(item, attributes) {
  return new Promise((resolve, reject) => {
    const title = item.getField('title')
    const year = item.getField('year')
    // try fast evaluation
    new Promise((fastResolve, fastReject) => {
      if (!(title && year)) {
        fastReject()
      } else {
        const fastEvalTitle = title.replace(/\W/g, ' ').replace(/\s+/g, ' ').toLowerCase()
        const expr = `And(Ty='0',Y=${year},Ti='${fastEvalTitle}')`
        evaluateExpr(expr, attributes)
          .then((response: any) => {
            const entities = response.entities
            // accept fast evaluation only if just one response
            if (entities.length === 1) {
              resolve({
                logprob: 0,
                entity: entities[0],
              })
            } else {
              fastReject()
            }
          })
          .catch(fastReject)
      }
    })
      .catch(error => {
        // long evaluation if fast doesnt work
        const delimiter = ', '
        let query = ''
        const interpretTitle = title.replace(/\W/g, ' ').replace(/\s+/g, ' ')
        query += interpretTitle
        if (year) query += delimiter + year
        iterpretQuery(query)
          .then((interpretResponse: any) => {
            const intp = interpretResponse.interpretations[0]
            const expr = intp.rules[0].output.value
            evaluateExpr(expr, attributes)
              .then((evalResponse: any) => {
                const entities = evalResponse.entities
                // get the entity with highest cite count of the entities with the highest logprob
                const entity = entities.reduce((bestEntity, currEntity) => {
                  if (currEntity.logprob >= bestEntity.logprob && currEntity.ECC > bestEntity.ECC) {
                    return currEntity
                  } else {
                    return bestEntity
                  }
                }, entities[0])
                resolve({
                  logprob: intp.logprob,
                  entity,
                })
              })
              .catch(reject)
          })
          .catch(reject)
      })
  })
}
