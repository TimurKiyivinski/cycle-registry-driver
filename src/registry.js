/* global fetch, Headers */

function Registry (url) {
  // TODO: Use Auth
  this.url = url

  this.callbacks = {}

  this.fetchImageTags = image => fetch(`${this.url}/v2/${image}/tags/list`)

  this.fetchImageManifest = (image, tag) => {
    const headers = {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json'
    }
    const fetchProperties = {
      method: 'GET',
      headers: new Headers(headers)
    }
    return fetch(`${this.url}/v2/${image}/manifests/${tag}`, fetchProperties)
  }

  this.fetchImageManifests = image => {
    return new Promise((resolve, reject) => {
      this.fetchImageTags(image)
        .then(res => res.json())
        .then(repository => {
          const promises = repository.tags
            .map(tag => ({ name: repository.name, tag: tag, promise: this.fetchImageManifest(repository.name, tag) }))
          Promise.all(promises.map(repository => repository.promise)).then(data => {
            Promise.all(data.map(res => res.json())).then(manifests => {
              const repositories = manifests.map((manifest, i) => Object.assign({ name: promises[i].name, tag: promises[i].tag }, manifest))
              resolve(repositories)
            }).catch(e => reject(e))
          }).catch(e => reject(e))
        })
    })
  }

  this.getCatalog = callback => {
    fetch(`${this.url}/v2/_catalog`)
      .then(res => res.json())
      .then(callback)
  }

  this.getCatalogWithTags = callback => {
    this.getCatalog(data => {
      const promises = data.repositories.map(repository => this.fetchImageTags(repository))
      Promise.all(promises)
        .then(data => data.map(res => res.json()))
        .then(data => Promise.all(data).then(repositories => callback({ repositories: repositories })))
    })
  }

  this.getCatalogWithManifests = callback => {
    this.getCatalog(data => {
      const promises = data.repositories.map(repository => this.fetchImageManifests(repository))
      Promise.all(promises)
        .then(data => Promise.all(data).then(repositories => callback({ repositories: repositories.reduce((a, b) => a.concat(b)) })))
    })
  }

  // Main function handler
  this.call = (category, request) => {
    if (request === 'catalog') {
      this.getCatalog(this.callbacks[category])
    } else if (request === 'catalog::tags') {
      this.getCatalogWithTags(this.callbacks[category])
    } else if (request === 'catalog::manifests') {
      this.getCatalogWithManifests(this.callbacks[category])
    } else {
      const requestSplit = request.split('::')
      if (requestSplit.length !== 2) {
        throw new Error('Invalid repository action')
      }
    }
  }

  // Set callback function
  this.onReceive = (category, callback) => {
    this.callbacks[category] = callback
  }
}

export default Registry
