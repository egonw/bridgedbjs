/* @module EntityReference */

var _ = require('lodash');
var config = require('./config.js');
var highland = require('highland');
var httpErrors = require('./http-errors.js');
var request = require('request');
var csv = require('csv-streamify');
var csvOptions = {objectMode: true, delimiter: '\t'};
var Utilities = require('./utilities.js');

/**
 * Used internally to create a new EntityReference instance
 * @class
 * @protected
 * @alias entityReference
 * @memberof bridgedb
 * @param {object} instance
 */
var EntityReference = function(instance) {
  'use strict';

  /**
   * @private
   * Add an IRI (JSON-LD "@id") to semantically identify the provided entity
   * reference, replacing previous one, if present.
   *
   * @param {object} entityReference
   * @param {string} entityReference.preferredPrefix Example: "ncbigene"
   * @param {string} entityReference.identifier Example: "1234"
   * @return {object} entityReference
   * @return {string} entityReference['@id'] Example: "http://identifiers.org/ncbigene/1234".
   * @return {Array<string>} entityReference['owl:sameAs'] Only if a previous, non-identifiers.org IRI was present. Example: "http://bio2rdf.org/ncbigene/1234".
   */
  function addIdentifiersIri(entityReference) {
    if (!entityReference.preferredPrefix || !entityReference.identifier) {
      var message = 'Could not add an identifiers.org IRI,' +
        ' because the provided entity' +
        ' reference was missing preferredPrefix and/or identifier.';
      console.warn(message);
      console.log(entityReference);
      return entityReference;
    }

    if (!!entityReference['@id'] &&
        entityReference['@id'].indexOf('identifiers.org') === -1) {
      if (!entityReference['owl:sameAs']) {
        entityReference['owl:sameAs'] = [];
      }
      entityReference['owl:sameAs'].push(entityReference['@id']);
    }

    entityReference['@id'] = 'http://identifiers.org/' +
      entityReference.preferredPrefix + '/' +
      entityReference.identifier;
    return entityReference;
  }

  /**
   * Add BridgeDb URL for getting xrefs for provided entity reference.
   * If there is already an "xrefs" property, its value will be converted to
   * an array, if needed, and the BridgeDb Xrefs URL will be added as a new element,
   * keeping any existing xref elements.
   *
   * @private
   *
   * @param {object} entityReference
   * @param {string} entityReference.organism Organism name in Latin or English
   * @param {Array<string>} entityReference.alternatePrefix The first element must be the BridgeDb systemCode
   * @param {string} entityReference.identifier
   * @return {object} entityReference
   * @return {Array<string>} entityReference.xrefs URL for getting Xrefs from BridgeDb webservices.
   */
  var addBridgeDbXrefsUrl = function(entityReference) {
    if (!entityReference ||
        !entityReference.organism ||
        !entityReference.alternatePrefix ||
        !entityReference.identifier) {
      var message = 'Cannot add BridgeDb Xrefs URL.' +
        ' See bridgedb.entityReference.addBridgeDbXrefsUrl()' +
        ' method for required parameters';
      console.warn(message);
      return entityReference;
    }
    entityReference.xrefs = entityReference.xrefs || [];
    var xrefs = entityReference.xrefs;
    xrefs = _.isArray(xrefs) ? xrefs : [xrefs];
    var bridgedbXrefsUrl =
      instance.xref.getBridgeDbUrlByEntityReference(entityReference);
    xrefs.push(bridgedbXrefsUrl);
    return entityReference;
  };

  /**
   * Create a Node.js/Highland stream through which entity references
   * can be piped to enrich each one with data from BridgeDb.
   *
   * @param {object} [options]
   * @param {boolean} [options.organism=true] Enrich with organism name.
   * @param {boolean} [options.context=true] Enrich with JSON-LD @context.
   * @param {boolean} [options.dataSource=true] Enrich with database metadata
   *                         (metadata about biological databases from datasources.txt).
   * @param {boolean} [options.bridgedbXrefsUrl=true] Enrich with URL for BridgeDb webservices
   *                                        to enable getting xrefs for this entity reference.
   * @return {Stream} entityReferenceTransformationStream
   */
  var createEnrichmentStream = function(options) {
    return highland.pipeline(function(sourceStream) {
      options = options || {};
      var enrichWithProvidedOptions = highland.partial(
        highland.flip(enrich),
        options
      );
      return highland(sourceStream).flatMap(enrichWithProvidedOptions);
    });
  };

  /**
   * Enrich entity reference. Default is to enrich as much as possible as much as possible
   * with data from BridgeDb, with the exception of not getting xrefs, but the data included
   * for enrichment can be controlled by setting options.include.
   *
   * @param {(object|string|stream)} input Entity reference(s). Each one must have an identifier
   * (e.g. ENSG00000160791) and means for identifying the database.
   *
   *    Acceptable entityReference input arguments:
   *      1. BridgeDb xrefs URL or identifiers.org IRI as string
   *      2. Object with at least one of these properties:
   *        a. { '@id': identifiers.org IRI }
   *        b. { bridgedbXrefsUrl: BridgeDb xrefs URL }
   *        c. { xrefs: [
   *            BridgeDb xrefs URL
   *            ...
   *          ]
   *        }
   *      3. Object with both of these properties:
   *        {
   *          db: database name as specified in datasources.txt
   *          identifier: entity reference identifier, such as ChEBI:1234
   *        }
   *
   *    Example of BridgeDb xrefs URL: http://webservice.bridgedb.org/Human/xrefs/L/1234
   *    Example of identifiers.org IRI: http://identifiers.org/ncbigene/1234
   *
   * @param {object} [options]
   * @param {boolean} [options.organism=true] Enrich with organism name.
   * @param {boolean} [options.context=true] Enrich with JSON-LD @context.
   * @param {boolean} [options.dataSource=true] Enrich with database metadata
   *                         (metadata about biological databases from datasources.txt).
   * @param {boolean} [options.bridgedbXrefsUrl=true] Enrich with URL for BridgeDb webservices
   *                                        to enable getting xrefs for this entity reference.
   * @return {Stream<object>} entityReference Entity reference with as many as possible of
   *                                          the properties listed below.
   * @return {string} entityReference['@context'] JSON-LD context. You can ignore this if you
   *                                              don't care about semantics.
   * @return {string} entityReference['@id'] JSON-LD IRI. You can also ignore this.
   * @return {string} entityReference.displayName See {@link http://www.biopax.org/release/biopax-level3.owl#displayName|biopax:displayName}
   * @return {string} entityReference.standardName
   * @return {string} entityReference.db
   * @return {string} entityReference.preferredPrefix
   * @return {Array<string>} entityReference.alternatePrefix
   * @return {string} entityReference.identifier
   * @return {string} entityReference.gpmlType
   * @return {string} entityReference.biopaxType
   */
  var enrich = function(input, options) {
    var inputStream;
    if (_.isString(input) || _.isPlainObject(input)) {
      inputStream = highland([input]);
    } else if (_.isArray(input)) {
      inputStream = highland(input);
    } else if (highland.isStream(input)) {
      inputStream = input;
    }
    options = options || {};
    options = _.defaults(options, {
      organism: true,
      context: true,
      dataSource: true,
      bridgedbXrefsUrl: true
    });

    return inputStream.map(expand)
    .map(function(entityReference) {
      var entityReferenceKeys = _.keys(entityReference);

      // if any one of these are provided, we can get the identity of the specified database
      var propertiesThatCanIdentifyDatabase = [
        'db',
        'preferredPrefix',
        'alternatePrefix',
        'bridgedbSystemCode',
        'bridgedbXrefsUrl'
      ];
      var providedPropertiesThatCanIdentifyDatabase =
        _.intersection(propertiesThatCanIdentifyDatabase, entityReferenceKeys);

      if (_.isEmpty(providedPropertiesThatCanIdentifyDatabase) ||
        typeof entityReference.identifier === 'undefined') {
        var message = 'Not enough data provided to identify' +
          ' the specified entity reference: "' +
          JSON.stringify(entityReference) + '"';
        throw new Error(message);
      }

      return entityReference;
    })
    .flatMap(function(entityReference) {
      if (options.dataSource) {
        return highland([entityReference]).flatMap(enrichWithDatabaseMetadata);
      } else {
        return highland([entityReference]);
      }
    })
    .flatMap(function(entityReference) {
      // TODO add method to set organism, if it's specified, so we don't need to run this method below
      if (options.organism) {
        return highland([entityReference])
        .flatMap(instance.organism.getByEntityReference)
        .map(function(organism) {
          entityReference.organism = organism.latin;
          return entityReference;
        });
      } else {
        return highland([entityReference]);
      }
    })
    .map(function(entityReference) {
      if (options.bridgedbXrefsUrl) {
        return addBridgeDbXrefsUrl(entityReference);
      } else {
        return entityReference;
      }
    })
    .map(function(entityReference) {
      if (options.context) {
        return instance.addContext(entityReference);
      } else {
        return entityReference;
      }
    });
  };

  /**
   * @private
   *
   * Enrich provided entity reference using the metadata
   * for biological databases from datasources.txt.
   *
   * @param {object} entityReference
   * @return {Stream<object>} entityReference Entity reference enriched with database metadata
   * @return {string} entityReference.identifier
   * @return {string} entityReference.PLUS_ALL_OTHER_PROPERTIES_AVAILABLE
   */
  function enrichWithDatabaseMetadata(entityReference) {
    var databasesStream =
      instance.dataSource.getByEntityReference(entityReference);

    var propertiesToAdd = [
      'gpmlType',
      'biopaxType',
      'db',
      'isPrimary',
      'preferredPrefix',
      'alternatePrefix'
    ];

    return databasesStream.map(function(dataSource) {
      propertiesToAdd.forEach(function(propertyKey) {
        var propertyValue = dataSource[propertyKey];
        if (!!propertyValue) {
          entityReference[propertyKey] = propertyValue;
        }
      });
      entityReference.db = entityReference.db[0];
      return entityReference;
    })
    .map(addIdentifiersIri);
  }

  /**
   * Check whether an entity reference with the specified identifier is known by the specified database.
   *
   * @param {string} bridgedbSystemCode
   * @param {string} identifier
   * @param {string} organism In English or Latin
   * @return {Stream<boolean>} entityReferenceExists true/false
   */
  function exists(bridgedbSystemCode, identifier, organism) {
    var path = '/' + encodeURIComponent(organism) +
      '/xrefExists/' + bridgedbSystemCode + '/' + identifier;
    var source = instance.config.apiUrlStub + path;

    return highland(request({
      url: source,
      withCredentials: false
    })).map(function(str) {
      return str.toString() === 'true';
    });
  }

  /**
   * @private
   * Parse provided object or string to return a normalized entity reference in the form of a JS object.
   * Uses only provided input -- no external data lookups.
   * Any provided names/values will be retained as-is, even if doing so prevents
   * other methods in this library from being able to access the data they require,
   * bridgedb does not clean or transform the input.
   *
   * @param {object|string} entityReference @see bridgedb.entityReference.enrich() for details on what constitutes a usable entityReference
   * @return {Stream<object>} entityReference Entity reference converted to object, if required, and normalized
   * @return {string} entityReference.identifier
   * @return {string} entityReference.PLUS_ALL_OTHER_PROPERTIES_AVAILABLE
   */
  function expand(entityReference) {
    if (!_.isPlainObject(entityReference)) {
      if (typeof entityReference === 'string') {
        // Convert input from string to object
        entityReference = {entityReference: entityReference};
      } else {
        var message = 'Not enough data provided to identify' +
          ' the specified entity reference: "' +
          JSON.stringify(entityReference) + '"';
        throw new Error(message);
      }
    }

    // Check for existence of and attempt to parse identifiers.org IRI or BridgeDb Xref URL.
    // TODO this code might have duplication in looping (normalizing pairs),
    // which could be refactored to normalize just once to speed things up.

    _(iriParserPairs).map(function(iriParserPair) {
      var iriPattern = new RegExp(iriParserPair[0]);
      var iri = _.find(entityReference, function(value) {
        var valueNormalized = String(value).toLowerCase();
        return iriPattern.test(valueNormalized);
      });

      if (!_.isEmpty(iri)) {
        _.defaults(entityReference, iriParserPair[1](iri));
      }
    });

    return entityReference;
  }

  // We only support identifiers.org and BridgeDb IRIs in this library.
  var iriParsers = {
    'identifiers.org': function(iri) {
      var iriComponents = iri.split('identifiers.org');
      var iriPath = iriComponents[iriComponents.length - 1];

      var iriPathComponents = iriPath.split('/');
      var preferredPrefix = iriPathComponents[1];
      var identifier = iriPathComponents[2];

      return {
        preferredPrefix: preferredPrefix,
        identifier: identifier,
        '@id': iri
      };
    },
    /* this is an alternative. which is better?
    'identifiers.org': function(iri) {
      return {
        preferredPrefix: iri.match(/(identifiers.org\/)(.*)(?=\/.*)/)[2],
        identifier: iri.match(/(identifiers.org\/.*\/)(.*)$/)[2],
        '@id': iri
      };
    },
    //*/
    'bridgedb.org': function(iri) {
      return {
        organism: iri.match(/(bridgedb.org\/)(.*)(?=\/xrefs)/)[2],
        bridgedbSystemCode: iri.match(/(bridgedb.org\/.*\/xrefs\/)(\w+)(?=\/.*)/)[2],
        identifier: iri.match(/(bridgedb.org\/.*\/xrefs\/\w+\/)(.*)$/)[2],
        bridgedbXrefsUrl: iri
      };
    }
  };
  var iriParserPairs = _.pairs(iriParsers);

  /**
   * @param {object} args
   * @param {string} args.targetPreferredPrefix The Miriam namespace / identifiers.org preferredPrefix.
   * @param {string|object} args.sourceEntityReference @see bridgedb.entityReference.enrich()
   *                        method for what constitutes a usable entityReference
   * @return {Stream<array>} entityReferences One or more entity references with the target preferredPrefix.
   * @return {object[]} entityReference
   * @return {string} entityReference.identifier
   * @return {string} entityReference.PLUS_ALL_OTHER_PROPERTIES_AVAILABLE
   */
  function map(args) {
    var targetPreferredPrefix = args.targetPreferredPrefix;
    if (!targetPreferredPrefix) {
      throw new Error('targetPreferredPrefix missing');
    }

    return instance.xref.get(args.sourceEntityReference)
    .filter(function(entityReferenceXref) {
      return entityReferenceXref.preferredPrefix === targetPreferredPrefix;
    });
  }

  /**
   * Normalize object properties
   *
   * @param {string|object} entityReference
   * @return {Stream<object>} entityReference Normalized entity reference
   * @return {string} entityReference.identifier
   * @return {string} entityReference.PLUS_ALL_OTHER_PROPERTIES_AVAILABLE
   */
  function normalize(entityReference) {
    entityReference = expand(entityReference);

    var organism = entityReference.organism;
    if (!!organism) {
      return highland([entityReference])
      .flatMap(function(entityReference) {
        return instance.organism.normalize(organism)
        .map(function(organism) {
          entityReference.organism = organism;
          return entityReference;
        });
      });
    } else {
      return highland([entityReference]);
    }
    // TODO normalize db, identifier, etc.
  }

  /**
   * Get potential matches for a desired entity reference when provided a name as a search term.
   *
   * @example
   * myBridgeDbInstance.entityReference.searchByAttribute({
   *   attribute: 'Nfkb1',
   *   organism: 'Mouse'
   * }).each(function(searchResult) {
   *   console.log('Result for Nfkb1');
   *   console.log(searchResult);
   * });
   *
   * @param {object} args
   * @param {string} args.attribute - Attribute value to be used as search term
   * @param {string} args.organism - Organism name. Currently only accepting Latin and English.
   * @param {string} [args.type] - Entity reference type, such as Protein, Dna, SmallMolecule, etc.
   *                               Not currently being used, but we might use it in the future to
   *                               help narrow down the search results.
   * @param {string} [args.db] - Desired database name, such as Ensembl or Uniprot
   * @return {Stream<object>} entityReference Entity reference, enriched with database metadata and organism
   * @return {string} entityReference.identifier
   * @return {string} entityReference.PLUS_ALL_OTHER_PROPERTIES_AVAILABLE
   */
  function searchByAttribute(args) {
    var attributeValue = args.attribute;
    var type = args.type;
    var organism = args.organism;

    if (!organism) {
      throw new Error('Missing argument "organism"');
    }

    return highland([organism])//.flatMap(instance.organism.normalize)
    // get the BridgeDb path
    .map(function(organism) {
      instance.organism.set(organism);
      var path = '/' + encodeURIComponent(organism) +
        '/attributeSearch/' +
        encodeURIComponent(attributeValue);
      return instance.config.apiUrlStub + path;
    })
    .flatMap(function(source) {
      return highland(request({
        url: source,
        withCredentials: false
      })
      .pipe(csv(csvOptions)));
    })
    .map(function(array) {
      return array;
    })
    .errors(function(err, push) {
      console.log(err);
      console.log('in entityReference.searchByAttribute()');
    })
    .map(function(array) {
      return {
        identifier: array[0],
        db: array[1],
        displayName: array[2]
      };
    })
    .map(function(searchResult) {

      // remove empty properties

      searchResult = _.omit(searchResult, function(value) {
        // Note: I intentionally used 'null' as
        // a string, not a native value, because
        // BridgeDb returns the string value
        return value === 'null';
      });

      return searchResult;
    })
    .flatMap(enrichWithDatabaseMetadata)
    .map(instance.addContext);
  }

  return {
    createEnrichmentStream:createEnrichmentStream,
    enrich:enrich,
    exists:exists,
    expand:expand,
    map:map,
    normalize:normalize,
    searchByAttribute:searchByAttribute
  };
};

exports = module.exports = EntityReference;