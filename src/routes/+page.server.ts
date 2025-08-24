import { OPENWEATHER_API_KEY } from '$env/static/private';
import type { PageServerLoad } from './$types';
import { parse } from 'cookie';

interface WeatherData {
	dt: number;
	main: {
		temp: number;
	};
	name: string;
	weather: {
		main: string;
	}[];
}

// Simple base64 decoding for coordinates (replicated for server-side use)
function decodeCoords(encoded: string): { lat: number; lon: number } | null {
	try {
		const decoded = atob(encoded);
		const [lat, lon] = decoded.split(',').map(Number);
		if (!isNaN(lat) && !isNaN(lon)) {
			return { lat, lon };
		}
	} catch (e) {
		console.error('Failed to decode coordinates from cookie:', e);
	}
	return null;
}

export const load: PageServerLoad = async ({ setHeaders, url, request }) => {
	let lat = url.searchParams.get('lat');
	let lon = url.searchParams.get('lon');

	// If no coordinates in URL, try to get them from the cookie
	if (!lat || !lon) {
		const cookies = parse(request.headers.get('cookie') || '');
		const encodedCoordsInCookie = cookies['encrypted_coords'];
		if (encodedCoordsInCookie) {
			const decoded = decodeCoords(encodedCoordsInCookie);
			if (decoded) {
				lat = String(decoded.lat);
				lon = String(decoded.lon);
				console.log('Using coordinates from cookie in +page.server.ts:', lat, lon);
			}
		}
	}

	let apiUrl = `https://api.openweathermap.org/data/2.5/weather?appid=${OPENWEATHER_API_KEY}&units=metric`;

	if (lat && lon) {
		apiUrl += `&lat=${lat}&lon=${lon}`;
	} else {
		apiUrl += `&q=Nairobi`; // Default to Nairobi if no coordinates are provided
		console.log('No coordinates found in +page.server.ts, defaulting to Nairobi.');
	}

	const fetchWeather = async (): Promise<WeatherData> => {
		const res = await fetch(apiUrl);
		if (!res.ok) {
			throw new Error(`HTTP error! status: ${res.status}`);
		}
		return await res.json();
	};

	setHeaders({
		'cache-control': 'public, max-age=3600' // 1 hour
	});

	return {
		weather: await fetchWeather()
	};
};
