import test from 'ava'
import xs from 'xstream'
import { run } from '@cycle/run'
import makeRegistryDriver from './src/makeRegistryDriver'

function request (request) {
  const sinks = {
    registry: makeRegistryDriver('http://localhost:5000'),
    swallow: () => false
  }

  return new Promise((resolve, reject) => {
    function main ({ registry }) {
      const in$ = xs.of({category: 't', request})
      const out$ = registry.select('t')
        .map(result => resolve(result))

      return {
        registry: in$,
        swallow: out$
      }
    }

    run(main, sinks)
  })
}

test('catalog', t => {
  t.plan(3)

  return request('catalog')
    .then(({repositories}) => {
      t.truthy(repositories)
      repositories
        .map(repository => t.is(typeof (repository), 'string'))
    })
})

test.todo('catalog::tags')
test.todo('catalog::manifests')
