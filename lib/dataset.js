/* @module Dataset */

var _ = require('lodash');
var csv = require('csv-streamify');
var csvOptions = {objectMode: true, delimiter: '\t'};
var highland = require('highland');
var httpErrors = require('./http-errors.js');
var hyperquest = require('hyperquest');
var internalContext = require('./context.json');
var Rx = require('rx');
var RxNode = require('rx-node');
var URI = require('URIjs');
var Utils = require('./utils.js');

/**
 * Used internally to create a new Dataset instance. See related
 * {@link http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.html|DataSource}
 * from BridgeDb-Java.
 * @class
 * @memberof BridgeDb
 * @param {Object} instance
 */
var Dataset = function(instance) {
  'use strict';

  var jsonldRx = instance.jsonldRx;

  /**
   * See {@link http://rdfs.org/ns/void#Dataset|void:Dataset}
   * @typedef {Object} Dataset Dataset with as many as possible of the properties listed below.
   * @property {JsonldContext} @context JSON-LD context.
   * @property {Iri} id Preferred IRI for identifying a dataset.
   * @property {String[]} owl:sameAs Alternate IRI for identifying a dataset.
   *                    See {@link http://www.w3.org/TR/owl-ref/#sameAs-def|owl:sameAs}.
   * @property {String} name Official, standardized name for the data set.
   *  See {@link http://schema.org/name|schema:name}.
   * @property {String} webPage See
   *  {@link http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.html#getMainUrl()|
   *    Java documentation} and {@link http://www.w3.org/2001/XMLSchema#anyURI|xsd:anyURI}.
   * @property {String} uriRegexPattern See
   *  {@link http://rdfs.org/ns/void#uriRegexPattern|void:uriRegexPattern}.
   * @property {Iri} exampleResource See
   *  {@link http://rdfs.org/ns/void#exampleResource|void:exampleResource}.
   * @property {String} exampleIdentifier See
   *  {@link http://identifiers.org/idot/exampleIdentifier|idot:exampleIdentifier}.
   * @property {String} organism Provided only if the dataset is for a single organism. See
   *  {@link http://www.biopax.org/release/biopax-level3.owl#organism|biopax:organism}.
   * @property {String} _bridgeDbType Biological type, as used at BridgeDb. See
   *  {@link
   *  http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.Builder.html#type(java.lang.String)|
   *  Java documentation}.
   * @property {JsonldType} type {@link http://rdfs.org/ns/void#Dataset|void:Dataset}
   * @property {String|String[]} subject Subject of the database, such as the biological type of
   *  its contained entity references. Biological type as used in GPML at WikiPathways and in
   *  PathVisio-Java:
   *  {@link http://vocabularies.wikipathways.org/gpml#Type|gpml:Type}.
   *  Biological type as used in Biopax: see the domain for
   *  {@link
   *  http://www.biopax.org/release/biopax-level3.owl#entityReference|biopax:entityReference}.
   * @property {Boolean} _isPrimary See Java documentation for
   *  {@link http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.html#isPrimary()|"isPrimary"}
   *  and for
   *  {@link http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.Builder.html#primary(boolean)|
   *  "primary" method}.
   * @property {String} identifierPattern Regular expression for the identifiers from this dataset.
   *  See {@link http://identifiers.org/idot/identifierPattern|idot:identifierPattern}.
   * @property {String} preferredPrefix Abbreviation as used by identifiers.org to identify a
   *  dataset. See {@link http://identifiers.org/idot/preferredPrefix|idot:preferredPrefix}.
   *  @example: 'ncbigene'
   * @property {String[]} alternatePrefix Abbreviation as used elsewhere to identify a dataset,
   *  such as at BridgeDb (bridgeDbSystemCode located both here and on its own).
   *  See {@link http://identifiers.org/idot/alternatePrefix|idot:alternatePrefix}.
   * @property {String} bridgeDbSystemCode See
   *  {@link http://bridgedb.org/apidoc/2.0/org/bridgedb/DataSource.html#getSystemCode()|
   *    Java documentation}.
   * @property {String} bridgeDbDatasourceName Name for the data set as used in the
   *  BridgeDb project.
   */

  /**
   * At least one of the following properties must be provided.
   * @typedef {Object} DatasetArgs
   * @property {Iri} [id]
   * @property {String} [preferredPrefix]
   * @property {String|String[]} [bridgeDbSystemCode]
   * @property {String|String[]} [name]
   * @property {String} [identifier] The identifier of the entity reference. This property
   *                                   will only be used if no other properties return results,
   *                                   because many different datasets have overlapping
   *                                   identifierPatterns.
   */

  /**
   * @private
   *
   * Get all biological datasets supported by BridgeDb, with all
   * available metadata, largely as specified in
   * {@link
   * https://github.com/bridgedb/BridgeDb/blob/master/org.bridgedb.bio/
   * resources/org/bridgedb/bio/datasources.txt|
   * datasources.txt}.
   *
   * @return {Stream<Dataset>} datasetStream
   */
  function _getAll() {
    function init() {

      /*
      return RxNode.fromReadableStream(
        hyperquest(instance.config.datasetsMetadataIri, {
          withCredentials: false
        })
        .pipe(csv(csvOptions))
      )
      //*/

      return highland(
        hyperquest(instance.config.datasetsMetadataIri, {
          withCredentials: false
        })
        .pipe(csv(csvOptions))
      )
      .map(function(array) {
        return {
          '@context': internalContext,
          bridgeDbDatasourceName: array[0],
          bridgeDbSystemCode: array[1],
          webPage: array[2],
          _iriPattern: array[3],
          exampleIdentifier: array[4],
          _bridgeDbType: array[5],
          // TODO this is returning organism as a string
          // when elsewhere we are using organism as an
          // object. Will that cause problems?
          organism: array[6],
          _isPrimary: array[7] === '1',
          _miriamRootUrn: array[8],
          identifierPattern: array[9],
          name: array[10]
        };
      })
      .map(function(dataset) {

        // remove empty properties

        return _.omit(dataset, function(value) {
          return value === '' ||
            _.isNaN(value) ||
          _.isNull(value) ||
          _.isUndefined(value);
        });
      })
      .map(function(dataset) {
        var iriPattern = dataset._iriPattern;
        var identifierPattern = dataset.identifierPattern;
        if (!!iriPattern) {
          dataset.uriRegexPattern = iriPattern.replace(
            '$id',
            _getIdentifierPatternWithoutBeginEndRestriction(identifierPattern)
          );

          // if '$id' is at the end of the iriPattern
          var indexOfSid = iriPattern.length - 3;
          if (iriPattern.indexOf('$id') === indexOfSid) {
            dataset['owl:sameAs'] = dataset['owl:sameAs'] || [];
            dataset['owl:sameAs'].push(iriPattern.substr(0, indexOfSid));
          }
        }

        dataset.type = 'Dataset';

        return dataset;
      })
      .map(function(dataset) {
        if (!!dataset._miriamRootUrn &&
            dataset._miriamRootUrn.indexOf('urn:miriam:') > -1) {

          dataset.preferredPrefix =
            dataset._miriamRootUrn.substring(11,
              dataset._miriamRootUrn.length);
          dataset.id =
            'http://identifiers.org/' + dataset.preferredPrefix + '/';
          dataset['owl:sameAs'] = dataset['owl:sameAs'] || [];
          dataset['owl:sameAs'].push(dataset._miriamRootUrn);
        }
        delete dataset._miriamRootUrn;
        return dataset;
      })
      .map(function(dataset) {
        if (!!dataset._bridgeDbType) {
          dataset.subject = [];
          /* Example of using 'subject' (from the VOID docs <http://www.w3.org/TR/void/#subject>):
              :Bio2RDF a void:Dataset;
                  dcterms:subject <http://purl.uniprot.org/core/Gene>;
                  .

          The closest concepts from the GPML, BioPAX and MESH vocabularies are included below.

          Note that in BioPAX, 'ProteinReference' is to 'Protein' as
              'Class' is to 'Instance' or
              'platonic ideal of http://identifiers.org/uniprot/P78527' is to
                    'one specific example of http://identifiers.org/uniprot/P78527'
          with the same logic applying for Dna, Rna and SmallMolecule. As such, it appears the
          subject of Uniprot is best described in BioPAX terms as biopax:ProteinReference instead
          of biopax:Protein.

          It is unclear whether the subject of Entrez Gene is biopax:DnaReference or biopax:Gene,
          but I'm going with biopax:DnaReference for now because it appears to be analogous to
          ProteinReference and SmallMoleculeReference.
          //*/
          if (dataset._bridgeDbType === 'gene' ||
              // TODO should the following two conditions be removed?
              dataset._bridgeDbType === 'probe' ||
              dataset.preferredPrefix === 'go') {
            dataset.subject.push('gpml:GeneProduct');
            dataset.subject.push('biopax:DnaReference');
          } else if (dataset._bridgeDbType === 'probe') {
            dataset.subject.push('probe');
          } else if (dataset._bridgeDbType === 'rna') {
            dataset.subject.push('gpml:Rna');
            dataset.subject.push('biopax:RnaReference');
          } else if (dataset._bridgeDbType === 'protein') {
            dataset.subject.push('gpml:Protein');
            dataset.subject.push('biopax:ProteinReference');
          } else if (dataset._bridgeDbType === 'metabolite') {
            dataset.subject.push('gpml:Metabolite');
            dataset.subject.push('biopax:SmallMoleculeReference');
          } else if (dataset._bridgeDbType === 'pathway') {
            // BioPAX does not have a term for pathways that is analogous to
            // biopax:ProteinReference for proteins.
            dataset.subject.push('gpml:Pathway');
            dataset.subject.push('biopax:Pathway');
          } else if (dataset._bridgeDbType === 'ontology') {
            dataset.subject.push('owl:Ontology');
          } else if (dataset._bridgeDbType === 'interaction') {
            dataset.subject.push('biopax:Interaction');
          }
        }

        dataset.alternatePrefix = [
          dataset.bridgeDbSystemCode
        ];

        return dataset;
      });
    }

    return Utils._runOnceGlobal('dataset', init);
  }

  function _getIdentifierPatternWithoutBeginEndRestriction(identifierPattern) {
    identifierPattern = identifierPattern || '.*';
    var identifierPatternWithoutBeginEndRestriction =
      '(' + identifierPattern.replace(/(^\^|\$$)/g, '') + ')';
    return identifierPatternWithoutBeginEndRestriction;
  }

  /**
   * Get one dataset, which will be the first dataset that matches
   * at least one of the provided argument(s).
   *
   * @param {DatasetArgs} args
   * @return {Stream<Dataset>} datasetsStream
   */
  function get(args) {
    return query(args).head();
  }

  /**
   * Get all datasets, or find the datasets that match at least one of the provided argument(s).
   *
   * @param {DatasetArgs} [args] If no args specified, will return all datasets.
   * @return {Stream<Dataset>} datasetsStream
   */
  function query(args) {
    if (_.isEmpty(args)) {
      return _getAll()
      .map(jsonldRx._matcher._removeNormalizedProperties);
    }

    // preferred keys for identifying a dataset
    var keysThatIdentifyDatasets = [
      'id',
      'preferredPrefix',
      'bridgeDbDatasourceName',
      'alternatePrefix',
      'name'
    ];

    var alternateFilters =  [];
    if (!!args.exampleResource) {
      alternateFilters.push(
        highland.curry(function(exampleResource, referenceDataset) {
          var uriRegexPatternRegExp =
              new RegExp(referenceDataset.uriRegexPattern);
          return !!exampleResource &&
            !!referenceDataset.uriRegexPattern &&
            uriRegexPatternRegExp.test(exampleResource);
        }, args.exampleResource)
      );
    }
    if (!!args.exampleIdentifier) {
      alternateFilters.push(
        highland.curry(function(exampleIdentifier, referenceDataset) {
          var identifierPatternRegExp =
              new RegExp(referenceDataset.identifierPattern);
          return !!exampleIdentifier &&
            !!referenceDataset.identifierPattern &&
            identifierPatternRegExp.test(exampleIdentifier);
        }, args.exampleIdentifier)
      );
    }

    return _getAll()
      /*
      .filter(function(dataset) {
        // TODO Make it optional whether to apply this filter.

        // Dataset subjects that indicate the dataset should not be used for identifying
        // a BioPAX Entity Reference for a gpml:DataNode.
        var nonApplicableSubjects = [
          'interaction',
          'ontology',
          'probe',
          'experiment',
          'publication',
          'model',
          'organism'
        ];
        return dataset._isPrimary &&
            !!dataset.id &&
            nonApplicableSubjects.indexOf(dataset._bridgeDbType) === -1;
      })
      //*/
      .collect()
      .flatMap(function(datasets) {
        //*
        var wpPreferredDatasets = [
          'ensembl',
          'ncbigene',
          'chebi',
          'cas',
          'hmdb',
          'uniprot',
          'kegg.compound'
        ];

        datasets.sort(function(dataset1, dataset2) {
          var preferredPrefix1 = dataset1.preferredPrefix;
          var preferredPrefix2 = dataset2.preferredPrefix;
          var preferenceIndex1 = wpPreferredDatasets.indexOf(preferredPrefix1);
          var preferenceIndex2 = wpPreferredDatasets.indexOf(preferredPrefix2);
          var preferred1 = preferenceIndex1 > -1;
          var preferred2 = preferenceIndex2 > -2;
          if (preferred1 && !preferred2) {
            return -1;
          } else if (!preferred1 && preferred2) {
            return 1;
          } else if (preferred1 && preferred2) {
            return preferred1 > preferred2;
          }

          var isPrimary1 = dataset1._isPrimary;
          var isPrimary2 = dataset2._isPrimary;
          if (isPrimary1 && !isPrimary2) {
            return -1;
          } else if (!isPrimary1 && isPrimary2) {
            return 1;
          }

          // does it have a preferredPrefix?
          if (preferredPrefix1 && !preferredPrefix2) {
            return -1;
          } else if (!preferredPrefix1 && preferredPrefix2) {
            return 1;
          }

          return preferredPrefix1 > preferredPrefix2;
        });
        //*/
        /*
        // TODO We should distinguish between exact and fuzzy matches.
        // For fuzzy matches, we should allow for setting priorities.
        // input:
        {exact: [
          'id', // a string indicates usage of pluck syntax
          'preferredPrefix',
          function(candidate, argument) {
            // TODO below will not actually work
            return uriRegexPatternRegExp.test(exampleResource);
          }.bind(null, exampleResource),
          'bridgeDbDatasourceName'
        ],
        fuzzy: [
          'name',
          function(candidate, argument) {
            // TODO below will not actually work
            return identifierPatternRegExp.test(exampleIdentifier);
          }.bind(null, exampleIdentifier),
          function(candidate, entityType) {
            var entityTypes = jsonldRx.arrayifyClean(entityType);
            var datasetSubjects = jsonldRx.arrayifyClean(candidate.subject);
            return !_.isEmpty(_.intersection(entityReferenceTypes, datasetSubjects));
          }.bind(null, entityType),
          '_isPrimary'
        ]}

        // output
        {
          match: {},
          score: 0 // 0: exact match. 3: we found a match with the third fuzzy filter.
        }
        //*/
        return jsonldRx.tieredFind(
          args,
          highland(datasets),
          'datasetsFormattedForComparison',
          keysThatIdentifyDatasets,
          alternateFilters
        );
      });
  }

  function convertPreferredPrefixToSystemCode(preferredPrefix) {
    return getByPreferredPrefix(preferredPrefix)
      .map(function(dataset) {
      if (!dataset) {
        var message = 'No BridgeDb-supported dataset available for ' +
           'preferredPrefix + "' + preferredPrefix + '"';
        return new Error(message);
      }
      return dataset.bridgeDbSystemCode;
    });
  }

  return {
    convertPreferredPrefixToSystemCode:
      convertPreferredPrefixToSystemCode,
    get:get,
    _getIdentifierPatternWithoutBeginEndRestriction:
      _getIdentifierPatternWithoutBeginEndRestriction,
    query:query
  };
};

module.exports = Dataset;
