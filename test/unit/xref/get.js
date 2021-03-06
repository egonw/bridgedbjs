var BridgeDb = require('../../../index.js');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var colors = require('colors');
var expect = chai.expect;
var fs = require('fs');
var highland = require('highland');
var http    =  require('http');
var mockserver  =  require('mockserver');
var run = require('gulp-run');
var sinon      = require('sinon');
var testUtils = require('../../test-utils.js');
var wd = require('wd');

var desired = {'browserName': 'phantomjs'};
desired.name = 'example with ' + desired.browserName;
desired.tags = ['dev-test'];

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

describe('BridgeDb.Xref.get', function() {
  var allPassed = true;
  var that = this;
  var update;
  var lkgDataPath;
  var lkgDataString;
  var standardBridgeDbApiUrlStub = 'http://webservice.bridgedb.org/';

  before(function(done) {
    // Find whether user requested to update the expected JSON result
    update = testUtils.getUpdateState(that.title);
    done();
  });

  beforeEach(function(done) {
    done();
  });

  afterEach(function(done) {
    allPassed = allPassed && (this.currentTest.state === 'passed');
    done();
  });

  after(function(done) {
    done();
  });

  //*
  it('should get xrefs (input: plain object with identifiers IRI)',
      function(done) {
    var lkgDataPath = __dirname +
          '/ncbigene-4292-xrefs.jsonld';
    lkgDataString = testUtils.getLkgDataString(lkgDataPath);

    var bridgeDbInstance = BridgeDb({
      //baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
      baseIri: 'http://localhost:' + process.env.MOCKSERVER_PORT + '/',
      datasetsMetadataIri:
        //'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
        'http://localhost:' + process.env.MOCKSERVER_PORT + '/datasources.txt'
    });

    var xrefStream = bridgeDbInstance.xref.get({
      '@id': 'http://identifiers.org/ncbigene/4292'
      //bridgeDbXrefsIri: 'http://webservice.bridgedb.org/Homo sapiens' +
        //                  '/xrefs/L/4292'
      //bridgeDbXrefsIri: 'http://webservice.bridgedb.org/Human/xrefs/L/4292'
    })
    .map(function(xrefs) {
      return xrefs;
    })
    .collect()
    .map(function(currentXrefs) {
      return JSON.stringify(currentXrefs)
        .replace(
          new RegExp(bridgeDbInstance.config.baseIri, 'g'),
          standardBridgeDbApiUrlStub
        );
    })
    .pipe(highland.pipeline(function(s) {
      if (update) {
        s.fork()
        .map(function(dataString) {
          lkgDataString = dataString;
          return dataString;
        })
        .pipe(fs.createWriteStream(lkgDataPath));
      }

      return s.fork();
    }))
    .map(function(dataString) {
      return testUtils.compareJson(dataString, lkgDataString);
    })
    .map(function(passed) {
      return expect(passed).to.be.true;
    })
    .last()
    .each(function() {
      return done();
    });
  });
  //*/

  //*
  it('should get xrefs (input: stream)', function(done) {
    var lkgDataPath = __dirname +
          '/ncbigene-1234-4292-xrefs.jsonld';
    lkgDataString = testUtils.getLkgDataString(lkgDataPath);

    var bridgeDbInstance = BridgeDb({
      //baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
      baseIri: 'http://localhost:' + process.env.MOCKSERVER_PORT + '/',
      datasetsMetadataIri:
        //'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
        'http://localhost:' + process.env.MOCKSERVER_PORT + '/datasources.txt'
    });

    highland([
      {
        '@id': 'http://identifiers.org/ncbigene/4292'
      },
      {
        bridgeDbXrefsIri: 'http://webservice.bridgedb.org/Human/xrefs/L/1234'
      }
    ])
    .pipe(bridgeDbInstance.xref.createStream())
    .map(function(xrefs) {
      return xrefs;
    })
    .collect()
    .map(function(currentXrefs) {
      return JSON.stringify(currentXrefs)
        .replace(
          new RegExp(bridgeDbInstance.config.baseIri, 'g'),
          standardBridgeDbApiUrlStub
        );
    })
    .pipe(highland.pipeline(function(s) {
      if (update) {
        s.fork()
        .map(function(dataString) {
          lkgDataString = dataString;
          return dataString;
        })
        .pipe(fs.createWriteStream(lkgDataPath));
      }

      return s.fork();
    }))
    .map(function(dataString) {
      return testUtils.compareJson(dataString, lkgDataString);
    })
    .map(function(passed) {
      return expect(passed).to.be.true;
    })
    .last()
    .each(function() {
      return done();
    });
  });
  //*/

  //*
  it('should get xrefs (input: array)', function(done) {
    var lkgDataPath = __dirname +
          '/ncbigene-1234-4292-xrefs.jsonld';
    lkgDataString = testUtils.getLkgDataString(lkgDataPath);

    var bridgeDbInstance = BridgeDb({
      //baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
      baseIri: 'http://localhost:' + process.env.MOCKSERVER_PORT + '/',
      datasetsMetadataIri:
        //'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
        'http://localhost:' + process.env.MOCKSERVER_PORT + '/datasources.txt'
    });

    bridgeDbInstance.xref.get([
      {
        '@id': 'http://identifiers.org/ncbigene/4292'
      },
      {
        bridgeDbXrefsIri: 'http://webservice.bridgedb.org/Human/xrefs/L/1234'
      }
    ])
    .map(function(xrefs) {
      return xrefs;
    })
    .collect()
    .map(function(currentXrefs) {
      return JSON.stringify(currentXrefs)
        .replace(
          new RegExp(bridgeDbInstance.config.baseIri, 'g'),
          standardBridgeDbApiUrlStub
        );
    })
    .pipe(highland.pipeline(function(s) {
      if (update) {
        s.fork()
        .map(function(dataString) {
          lkgDataString = dataString;
          return dataString;
        })
        .pipe(fs.createWriteStream(lkgDataPath));
      }

      return s.fork();
    }))
    .map(function(dataString) {
      return testUtils.compareJson(dataString, lkgDataString);
    })
    .map(function(passed) {
      return expect(passed).to.be.true;
    })
    .last()
    .each(function() {
      return done();
    });
  });
  //*/

});
