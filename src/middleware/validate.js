const { httpError } = require('../utils/http');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(httpError(400, 'Validation failed', result.error.issues.map((issue) => ({
        field: issue.path.join('.'), message: issue.message,
      }))));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
