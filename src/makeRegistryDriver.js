import xs from 'xstream'
import Registry from './registry'

export function makeRegistryDriver (url) {
  const registry = new Registry(url)

  function registryDriver (outgoing$) {
    outgoing$.addListener({
      next: outgoing => {
        // Use the sink data to call the registry instance
        registry.call(outgoing.category, outgoing.request)
      },
      error: () => {
      },
      complete: () => {
      }
    })

    // Used by sources.registry.select('category') to assign a listener
    // to the `registry` instance by assigning it a callback
    return {
      select: function (category) {
        return xs.create({
          start: listener => {
            // The registry instance will create a callbacks[category]
            // instance, assinging it the listener
            registry.onReceive(category, data => listener.next(data))
          },
          stop: () => {
          }
        })
      }
    }
  }

  return registryDriver
}

export default makeRegistryDriver
