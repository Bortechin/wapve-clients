const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withLocalReleaseSigning(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') return result;
    let source = result.modResults.contents;
    source = source.replace(/\s*def wapveReleaseStorePath = System\.getenv\("WAPVE_RELEASE_STORE_FILE"\)\s*/u, '\n');
    if (!source.includes('def wapveReleaseStorePath')) {
      source = source.replace(
        /android\s*\{/u,
        'android {\n    def wapveReleaseStorePath = System.getenv("WAPVE_RELEASE_STORE_FILE")',
      );
    }
    if (!source.includes('storePassword System.getenv("WAPVE_RELEASE_STORE_PASSWORD")')) {
      source = source.replace(
        /signingConfigs\s*\{\s*debug\s*\{/u,
        `signingConfigs {
        release {
            if (wapveReleaseStorePath) {
                storeFile file(wapveReleaseStorePath)
                storePassword System.getenv("WAPVE_RELEASE_STORE_PASSWORD")
                keyAlias System.getenv("WAPVE_RELEASE_KEY_ALIAS")
                keyPassword System.getenv("WAPVE_RELEASE_KEY_PASSWORD")
            }
        }
        debug {`,
      );
    }
    source = source.replace(
      /(buildTypes\s*\{\s*debug\s*\{\s*)signingConfig wapveReleaseStorePath \? signingConfigs\.release : signingConfigs\.debug/u,
      '$1signingConfig signingConfigs.debug',
    );
    source = source.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/u,
      '$1if (wapveReleaseStorePath) signingConfig signingConfigs.release',
    );
    result.modResults.contents = source;
    return result;
  });
};
