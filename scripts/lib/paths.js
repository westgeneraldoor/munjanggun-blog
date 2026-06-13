const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function fromRoot(...segments) {
  return path.join(ROOT_DIR, ...segments);
}

const paths = {
  root: (...segments) => fromRoot(...segments),
  config: (name) => fromRoot('config', name),
  dataRaw: (name) => fromRoot('data', 'raw', name),
  dataProcessed: (name) => fromRoot('data', 'processed', name),
  outputReport: (name) => fromRoot('outputs', 'reports', name),
  outputDashboard: (name) => fromRoot('outputs', 'dashboards', name),
  docsStrategy: (name) => fromRoot('docs', 'strategy', name),
};

module.exports = {
  ROOT_DIR,
  paths,
};
