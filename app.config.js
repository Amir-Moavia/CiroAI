// Loads GOOGLE_MAPS_API_KEY from .env for native map tiles (Android/iOS builds).
const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'CrisisAI',
    slug: 'crisisai',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.crisisai.app',
      config: {
        googleMapsApiKey: mapsApiKey,
      },
    },
    android: {
      package: 'com.crisisai.app',
      config: {
        googleMaps: {
          apiKey: mapsApiKey,
        },
      },
    },
    plugins: [],
    extra: {
      googleMapsApiKey: mapsApiKey,
    },
  },
};
