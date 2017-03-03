import xs from 'xstream'
import { makeHTTPDriver } from '@cycle/http'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

export function makeRegistryDriver (url) {
  const HTTPDriver = makeHTTPDriver()

  return function (outgoing$) {
    const http$ = xs.create()
    const source = HTTPDriver(http$)

    const outgoingCatalogs$ = outgoing$
      .filter(outgoing => outgoing.request.startsWith('catalog'))

    const outgoingCatalog$ = outgoingCatalogs$
      .filter(catalog => catalog.request === 'catalog')

    const outgoingCatalogTags$ = outgoingCatalogs$
      .filter(catalog => catalog.request === 'catalog::tags')

    const outgoingCatalogManifests$ = outgoingCatalogs$
      .filter(catalog => catalog.request === 'catalog::manifests')

    const catalog$ = outgoingCatalog$
      .mapTo({
        category: 'catalogs',
        url: `${url}/v2/_catalog`
      })

    const getCatalogs$ = source.select('catalogs')
      .flatten()
      .map(res => res.body)

    const catalogTags$ = xs.combine(outgoingCatalogTags$, getCatalogs$)
      .map(([outgoing, result]) => {
        const http = result.repositories
          .map(repository => ({
            category: 'catalogTags',
            url: `${url}/v2/${repository}/tags/list`
          }))

        return xs.fromArray(http)
      })
      .flatten()

    const getCatalogTags$ = source.select('catalogTags')
      .compose(flattenConcurrently)
      .map(res => res.body)
      .fold((tags, res) => [...tags, res], [])

    const getAllCatalogTags$ = xs.combine(getCatalogs$, getCatalogTags$)
      .filter(([res, tags]) => res.repositories.length === tags.length)
      .map(([res, repositories]) => ({repositories}))

    const catalogManifestsList$ = xs.combine(outgoingCatalogTags$, getAllCatalogTags$)
      .map(([outgoing, result]) => {
        const http = result.repositories
          .map(repository => repository.tags.map(tag => ({
            category: 'catalogManifests',
            url: `${url}/v2/${repository.name}/manifests/${tag}`,
            headers: {
              Accept: 'application/vnd.docker.distribution.manifest.v2+json'
            }
          })))
          .reduce((https, reqs) => [...https, ...reqs], [])

        return http
      })

    const catalogManifests$ = catalogManifestsList$
      .map(http => xs.fromArray(http))
      .flatten()

    const getCatalogManifests$ = source.select('catalogManifests')
      .compose(flattenConcurrently)
      .map(res => res.body)
      .fold((tags, res) => [...tags, res], [])

    const getAllCatalogManifests$ = xs.combine(catalogManifestsList$, getCatalogManifests$)
      .filter(([list, manifests]) => list.length === manifests.length)
      .map(([list, repositories]) => ({repositories}))

    const resultCatalog$ = xs.combine(outgoingCatalog$, getCatalogs$)
      .map(([outgoing, result]) => ({
        category: outgoing.category,
        content: result
      }))

    const resultCatalogTags$ = xs.combine(outgoingCatalogTags$, getAllCatalogTags$)
      .filter(([outgoing, result]) => outgoing)
      .map(([outgoing, result]) => ({
        category: outgoing.category,
        content: result
      }))

    const resultCatalogManifests$ = xs.combine(outgoingCatalogManifests$, getAllCatalogManifests$)
      .filter(([outgoing, result]) => outgoing)
      .map(([outgoing, result]) => ({
        category: outgoing.category,
        content: result
      }))

    const sink$ = xs.merge(
      catalog$,
      catalogTags$,
      catalogManifests$
    )
    http$.imitate(sink$)

    const result$ = xs.merge(
      resultCatalog$,
      resultCatalogTags$,
      resultCatalogManifests$
    )

    return {
      select: category => result$.filter(result => result.category === category)
    }
  }
}

export default makeRegistryDriver
