var config = {
  proxy: {
    host: 'pointer.ucsf.edu',
    path: '/d3/r/data-sources/bridgedb.php'
  },
  http: {
    retryLimit: 2,
    retryDelay: 3000
  }
};

module.exports = config;