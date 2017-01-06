/* global fetch, Headers */

function Registry (url) {
  // TODO: Use Auth
  this.url = url

  // Used to store the callbacks for all listeners
  this.callbacks = {}

  // Gets tags from an image
  this.fetchImageTags = image => fetch(`${this.url}/v2/${image}/tags/list`)

  // Get the manifest of a single image based on the tag
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

  // Get the manifest for every tag of an image
  this.fetchImageManifests = image => {
    return new Promise((resolve, reject) => {
      this.fetchImageTags(image)
        .then(res => res.json())
        .then(repository => {
          const promises = repository.tags
            .map(tag => ({ name: repository.name, tag: tag, promise: this.fetchImageManifest(repository.name, tag) }))
          Promise.all(promises.map(repository => repository.promise)).then(data => {
            Promise.all(data.map(res => res.json())).then(manifests => {
              // Merge the original promises object with the returned data since the docker manifest API
              // does not return the image name or tag, unlike other API endpoints
              const repositories = manifests.map((manifest, i) => Object.assign({ name: promises[i].name, tag: promises[i].tag }, manifest))
              resolve(repositories)
            }).catch(e => reject(e))
          }).catch(e => reject(e))
        })
    })
  }

  // Get the registry repository catalog
  this.getCatalog = callback => {
    fetch(`${this.url}/v2/_catalog`)
      .then(res => res.json())
      .then(callback)
  }

  // Get the registry repository catalog with image tags
  this.getCatalogWithTags = callback => {
    this.getCatalog(data => {
      const promises = data.repositories.map(repository => this.fetchImageTags(repository))
      Promise.all(promises)
        .then(data => data.map(res => res.json()))
        .then(data => Promise.all(data).then(repositories => callback({ repositories: repositories })))
    })
  }

  // Get the registry repository catalog with image manifests
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
      // Fallback to repository actions
      const requestSplit = request.split('::')
      if (requestSplit.length !== 2) {
        throw new Error('Invalid registry driver request')
      }
      let image = requestSplit[0]
      const action = requestSplit[1]
      if (action === 'tags') {
        this.fetchImageTags(image)
          .then(res => res.json())
          .then(data => {
            this.callbacks[category](data)
          })
      } else if (action === 'manifest') {
        const imageSplit = image.split(':')
        if (imageSplit.length !== 2) {
          throw new Error('No image tag specified')
        }
        image = imageSplit[0]
        const imageTag = imageSplit[1]
        this.fetchImageManifest(image, imageTag)
          .then(res => res.json())
          .then(data => {
            this.callbacks[category](data)
          })
      } else {
        throw new Error(`Invalid repository action ${action}`)
      }
    }
  }

  // Set callback function
  this.onReceive = (category, callback) => {
    this.callbacks[category] = callback
  }
}

export default Registry
