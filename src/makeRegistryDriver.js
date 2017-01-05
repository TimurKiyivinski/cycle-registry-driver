import xs from 'xstream'
import Registry from './registry'

export function makeRegistryDriver (url) {
  const registry = new Registry(url)

  function registryDriver (outgoing$) {
    outgoing$.addListener({
      next: outgoing => {
        registry.call(outgoing)
      },
      error: () => {
      },
      complete: () => {
      }
    })

    // TODO: Select streams
    return xs.create({
      start: listener => {
        registry.onReceive(data => listener.next(data))
      },
      stop: () => {
      }
    })
  }

  return registryDriver
}

export default makeRegistryDriver
