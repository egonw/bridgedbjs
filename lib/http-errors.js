var config = require('./config.js');

var httpErrors = function(args) {
  var error = args.error
    , response = args.response
    , body = args.body
    , stream = args.stream
    , source = args.source
    ;

  // request doesn't throw an error for responses like 404, 500, etc.,
  // but we want to treat them like errors.
  if (!!response && !!response.statusCode) {
    var statusCode = response.statusCode;
    var statusCodeFirstCharacter = statusCode.toString()[0];
    if (statusCodeFirstCharacter === '4' || statusCodeFirstCharacter === '5') {
      error = error || new Error('HTTP status code ' + statusCode);
    }
  }

  console.log('Checking for errors: ' + source);
  // if there is no error
  if (!error) {
    return;
  }

  // if there is an error

  //stream.pause();

  console.log('Error getting ' + source);
  console.log(error);

  setTimeout(function() {
    //stream.resume();
  }, config.http.retryDelay);
};

module.exports = httpErrors;