# cycle-registry-driver
Read-Only Docker Registry driver for Cycle.js.

## features
* Get Registry catalog
* Get Registry catalog with repository tags
* Get Registry catalog with repository manifests
* Get image repository with tags
* Get image repository with manifest for specific tag

## installation
Install with NPM
```
npm install --save cycle-registry-driver
```

## usage
Import into your ES6 code:
```javascript
import makeRegistryDriver from 'cycle-registry-driver'
```
Register the driver:
```javascript
const drivers = {
  ...
  registry: makeRegistryDriver('http://my.registry.localhost:5000')
}
```
Request format for `registry` sink:
```javascript
{
  category: 'catalog',
  request: 'catalog::tags'
}
```
Just like the HTTP driver, you can use `category` to filter streams:
```javascript
const repo$ = sources.registry.select('catalog')
```

### requests
Registry Catalog, `catalog`:
```
{"repositories":["alpine","tomcat"]}
```
Registry catalog with tags, `catalog::tags`:
```
{"repositories":[{"name":"alpine","tags":["latest"]},{"name":"tomcat","tags":["latest", "7"]}]}
```
Registry with manifests, `catalog::manifests`:
```javascript
{
    "repositories": [
        {
            "name": "alpine",
            "tag": "latest",
            "schemaVersion": 2,
            "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
            "config": {
                "mediaType": "...",
                "size": "...",
                "digest": "sha256:..." // Image ID
            },
            "layers": []
        }
    ]
}
```
The same can be done for individual images/repositories using `$repo::tags` or `$repo:$tag::manifests`. For example, `alpine:latest::manifest`.

## drawbacks
**DOES NOT SUPPORT AUTHENTICATION** This driver only works with insecure registries. You can however use a reverse proxy to acheive something like `https://user:password@registry` if you wish to secure your registry.
