bridgedb-5.0.0
===================

JS client for the [BridgeDb](http://bridgedb.org) ID mapping framework [webservice](http://bridgedb.org/wiki/BridgeWebservice/).
Not all the functionality of the BridgeDb webservice are exposed by this library yet. Pull requests are welcome!

##[API Documentation](https://bridgedb.github.io/bridgedbjs/docs/)

## Installation

**Browser**
```html
<script src="https://bridgedb.github.io/bridgedbjs/dist/bridgedb-5.0.0.min.js"></script>
```

**Node.js**
```
npm install bridgedb
```

**Java/JVM**

Use BridgeDb-Java instead. If you really want to use this, you can try [Nashorn (Java 8+)](http://openjdk.java.net/projects/nashorn/), [Rhino (Java <8)](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Rhino) or [DynJS](http://dynjs.org/).

Nashorn tutorials:
* [Oracle introduction](http://www.oracle.com/technetwork/articles/java/jf14-nashorn-2126515.html)
* [Winterbe tutorial](http://winterbe.com/posts/2014/04/05/java8-nashorn-tutorial/)
* [Video](https://www.youtube.com/watch?v=Cxyg22C5gcw)

## Example
```js
BridgeDb = require('bridgedb'); // Omit this line unless you're using Node.js

var myBridgeDbInstance = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
myBridgeDbInstance.entityReference.freeSearch({
  attribute: 'Nfkb1',
  organism: 'Mouse'
}).each(function(searchResult) {
  console.log('Result for Nfkb1');
  console.log(searchResult);
});
```

Most methods return [Node.js streams](http://nodejs.org/api/stream.html). Anywhere the return type is listed as a Stream, you can use ```each``` as shown above.
You can also ```pipe``` the stream through another stream or use any of the other functionality from the [Highland stream library](http://highlandjs.org/).

For more examples, see the [test directory](https://github.com/bridgedb/bridgedbjs/tree/master/test).

## How To Get Involved

1. Install [Node.js](https://nodejs.org/)
2. Fork this repo
3. Try running the tests. If you need help, check out the [test documentation](./test/README.md).
4. Make your changes, including adding new tests for your changes if they are not already covered by the existing tests.
5. Make sure the tests all pass.
6. Then you can get us to rebuild bridgedb and update the github repo with this process:

  a) Commit your changes to the master branch of your local repo.

  b) Build:
    ```
    gulp build
    ```

  c) Send us a pull request from your local repo to the master branch of this repo.

  d) Then we can create a new release and update the github pages:
    ```
    gulp publish
    ```
