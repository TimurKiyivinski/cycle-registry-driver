const xs = require('xstream').default
const makeHTTPDriver = require('@cycle/http').makeHTTPDriver
const Cycle = require('@cycle/xstream-run')

const pipe = data => {
  console.dir(data)
  return data
}

function makeRegistryDriver (url) {
  function registryDriver (outgoing$) {
    const callbacks = {}

    function main (sources) {
      const ougoingCatalogs$ = outgoing$
        .filter(outgoing => outgoing.request.startsWith('catalog'))

      const outgoingCatalog$ = ougoingCatalogs$
        .filter(catalog => catalog.request === 'catalog')

      const outgoingCatalogTags$ = ougoingCatalogs$
        .filter(catalog => catalog.request === 'catalog::tags')

      const outgoingCatalogManifests$ = ougoingCatalogs$
        .filter(catalog => catalog.request === 'catalog::manifests')

      const catalog$ = outgoingCatalog$
        .mapTo({
          category: 'catalogs',
          url: `${url}/v2/_catalog`
        })

      const getCatalogs$ = sources.HTTP.select('catalogs')
        .flatten()
        .map(res => res.body)

      const catalogTagsEvent$ = xs.combine(outgoingCatalogTags$, getCatalogs$)
        .map(([outgoing, result]) => {
          const category = `${outgoing.category}::${outgoing.request}`

          const http = result.repositories
            .map(repository => {
              console.log(`output for ${repository}`)
              return xs.of({
                category: category,
                url: `${url}/v2/${repository}/tags/list`
              })
            })

          return {
            sink: xs.merge(...http),
            source: sources.HTTP.select(category)
          }
        })

      const catalogTags$ = catalogTagsEvent$
        .map(catalogTags => catalogTags.sink)
        .flatten()

      // const getCatalogTags$ = catalogTagsEvent$
        //   .map(catalogTags => catalogTags.source)
        //   .flatten()

      const getCatalogTags$ = sources.HTTP.select('catalogTags::catalog::tags')
        .flatten()
        .map(res => res.body)

      const resultCatalog$ = xs.combine(outgoingCatalog$, getCatalogs$)
        .map(([outgoing, result]) => ({
          category: outgoing.category,
          content: result
        }))

      const resultCatalogTags$ = xs.combine(outgoingCatalogTags$, getCatalogTags$)
        .map(([outgoing, result]) => ({
          category: outgoing.category,
          content: result
        }))

      const http$ = xs.merge(
        catalog$,
        catalogTags$
      )
        .map(pipe)

      const result$ = xs.merge(
        resultCatalog$,
        resultCatalogTags$
      )

      return {
        HTTP: http$,
        proxy: result$
      }
    }

    const drivers = {
      HTTP: makeHTTPDriver(),
      proxy: proxy$ => {
        proxy$.addListener({
          next: result => {
            callbacks[result.category](result.content)
          }
        })
      }
    }

    Cycle.run(main, drivers)

    return {
      select: category => xs.create({
        start: listener => {
          callbacks[category] = result => listener.next(result)
        },
        stop: () => {
        }
      })
    }
  }

  return registryDriver
}

module.exports = makeRegistryDriver
