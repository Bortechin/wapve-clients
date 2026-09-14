const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const buildMaxWorkers = Number.parseInt(process.env.WAPVE_MOBILE_BUILD_MAX_WORKERS ?? '', 10);

config.resolver.unstable_enablePackageExports = true;
config.transformer.unstable_workerThreads = false;
if (Number.isFinite(buildMaxWorkers) && buildMaxWorkers > 0) {
  config.maxWorkers = buildMaxWorkers;
  config.stickyWorkers = false;
}
module.exports = config;
