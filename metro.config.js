const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { resolver } = config;

  config.resolver = {
    ...resolver,
    resolveRequest: (context, moduleName, platform) => {
      if (platform === 'web' && moduleName === 'react-native-maps') {
        // Redirect react-native-maps to our web stub file
        return {
          filePath: require.resolve('./src/components/MapViewWeb.tsx'),
          type: 'sourceFile',
        };
      }
      // Fallback to default resolver
      return context.resolveRequest(context, moduleName, platform);
    },
  };

  return config;
})();
