var Bridgedb = require('../index.js');
var _ = require('lodash');
var bridgedb1 = Bridgedb({
  apiUrlStub: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php',
  datasourcesUrl: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
var bridgedb2 = Bridgedb();

//*
bridgedb1.organism.getByIdentifier('http://identifiers.org/ncbigene/4292', function(err, organism) {
  console.log('organism by identifier1');
  console.log(JSON.stringify(organism, null, '\t'));
});
//*/

//*
bridgedb2.organism.getByIdentifier('http://identifiers.org/ncbigene/174034', function(err, organism) {
  console.log('organism by identifier2 should be c. elegans');
  console.log(JSON.stringify(organism, null, '\t'));
});
//*/

//*
bridgedb1.organism.getByIdentifier('http://identifiers.org/ncbigene/103', function(err, organism) {
  console.log('organism by identifier3 should be Homo sapiens');
  console.log(JSON.stringify(organism, null, '\t'));
  console.log('bridgedb1');
  console.log(bridgedb1);
  console.log('bridgedb2');
  console.log(bridgedb2);
});
//*/

// C. elegans result
//http://identifiers.org/ncbigene/174034
//http://webservice.bridgedb.org/Caenorhabditis elegans/xrefs/L/174034

/*
bridgedb2.getOrganismByIdentifier('http://identifiers.org/ncbigene/103', function(err, organism) {
  console.log('organism by identifier2');
  //console.log(JSON.stringify(organism, null, '\t'));
});
//*/