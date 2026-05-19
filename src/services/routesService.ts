// Google Routes API (New) v2 service for CrisisAI
// Fully replaces the legacy Directions API to support newer GCP projects

// Google polyline decoder
const decodePolyline = (encoded: string) => {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : result >> 1;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
};

export const getRealRoutes = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<{ latitude: number; longitude: number }[]> => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[Routes API] No EXPO_PUBLIC_GOOGLE_MAPS_API_KEY set in .env');
    return [];
  }

  // Pass key in query param to be robust and bypass preflight CORS issues
  const url = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`;

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'en-US',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`🔴 [Routes API Error] Non-JSON Response (Status ${response.status}):`, responseText);
      return [];
    }

    if (!response.ok || data.error) {
      console.error(
        `🔴 [Routes API Error] Status: ${response.status} | Message: ${data.error?.message ?? responseText}`
      );
      return [];
    }

    const points = data.routes?.[0]?.polyline?.encodedPolyline;
    if (!points) return [];

    return decodePolyline(points);
  } catch (err: any) {
    console.error('🔴 [Routes API Network Error]:', err.message);
    return [];
  }
};

export const getAlternateRoutes = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[Routes API] No EXPO_PUBLIC_GOOGLE_MAPS_API_KEY set in .env');
    return { route1: [], route2: [] };
  }

  const url = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`;

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: true,
    languageCode: 'en-US',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`🔴 [Routes API Error] Non-JSON Response (Status ${response.status}):`, responseText);
      return { route1: [], route2: [] };
    }

    if (!response.ok || data.error) {
      console.error(
        `🔴 [Routes API Error] Alternatives Status: ${response.status} | Message: ${data.error?.message ?? responseText}`
      );
      return { route1: [], route2: [] };
    }

    const routes = data.routes ?? [];
    
    const getDurationLabel = (r: any, fallback: string) => {
      if (!r?.duration) return fallback;
      const secs = parseInt(r.duration.replace('s', ''));
      if (isNaN(secs)) return fallback;
      return `Via Alternative Road (${Math.round(secs / 60)} mins)`;
    };

    return {
      route1: routes[0]?.polyline?.encodedPolyline ? decodePolyline(routes[0].polyline.encodedPolyline) : [],
      route2: routes[1]?.polyline?.encodedPolyline ? decodePolyline(routes[1].polyline.encodedPolyline) : [],
      route1Name: getDurationLabel(routes[0], 'Alternate Route 1'),
      route2Name: getDurationLabel(routes[1], 'Alternate Route 2'),
    };
  } catch (err: any) {
    console.error('🔴 [Routes API Network Error] Alternatives:', err.message);
    return { route1: [], route2: [] };
  }
};

export const testGoogleDirectionsApi = async (): Promise<{
  ok: boolean;
  status: string;
  message: string;
}> => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 'MISSING', message: 'No EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env' };
  }

  const url = `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`;

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: 33.6844,
          longitude: 73.0479,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: 33.6944,
          longitude: 73.0579,
        },
      },
    },
    travelMode: 'DRIVE',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      return { ok: false, status: `ERROR_${response.status}`, message: `Non-JSON Response: ${responseText}` };
    }

    if (response.ok && !data.error) {
      return { ok: true, status: 'OK', message: 'Google Routes API (New) is working.' };
    }
    
    return {
      ok: false,
      status: data.error?.status ?? `ERROR_${response.status}`,
      message: data.error?.message ?? responseText,
    };
  } catch (e) {
    return { ok: false, status: 'NETWORK_ERROR', message: (e as Error).message };
  }
};
