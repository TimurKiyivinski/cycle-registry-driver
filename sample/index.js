const xs = require('xstream').default
const makeRegistryDriver = require('../src/makeRegistryDriver')
const Cycle = require('@cycle/xstream-run')

function makeLogDriver () {
  function logDriver (outgoing$) {
    outgoing$.addListener({
      next: log => console.log(log)
    })
  }

  return logDriver
}

function main (sources) {
  const catalog$ = xs.of({
    category: 'catalog',
    request: 'catalog'
  })

  const catalogTags$ = xs.of({
    category: 'catalogTags',
    request: 'catalog::tags'
  })

  const catalogManifests$ = xs.of({
    category: 'catalogManifests',
    request: 'catalog::manifests'
  })

  const getCatalog$ = sources.registry.select('catalog')

  const getCatalogTags$ = sources.registry.select('catalogTags')

  const getCatalogManifests$ = sources.registry.select('catalogManifests')

  const registry$ = xs.merge(catalog$, catalogTags$, catalogManifests$)
  const log$ = xs.merge(getCatalog$, getCatalogTags$, getCatalogManifests$)

  return {
    registry: registry$,
    log: log$
  }
}

const drivers = {
  registry: makeRegistryDriver('http://localhost:5000'),
  log: makeLogDriver()
}

Cycle.run(main, drivers)
