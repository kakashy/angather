<script lang="ts">
	import { CloudRain, Sun, Moon, Cloud, CloudSnow, CloudLightning, Wind } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { fly } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';
	import Cookies from 'js-cookie';
	import { onMount } from 'svelte';
	import { format } from 'timeago.js';

	// Nairobi coordinates for comparison
	const NAIROBI_LAT = -1.286389;
	const NAIROBI_LON = 36.817223;
	const COORD_COOKIE_NAME = 'encrypted_coords';

	// Simple base64 encoding/decoding for coordinates
	function encodeCoords(lat: number, lon: number): string {
		return btoa(`${lat},${lon}`);
	}

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

	export let data: PageData;
	$: weather = data.weather;
	let bgToUse = '/rain_afternoon.jpg'; // Default background
	console.log('Weather data:', weather);

	// Client-side geolocation
	if (browser && navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				console.log(position);

				const { latitude, longitude } = position.coords;

				// Check if current location is Nairobi
				const isNairobi =
					Math.abs(latitude - NAIROBI_LAT) < 0.01 && Math.abs(longitude - NAIROBI_LON) < 0.01;

				const encodedCoordsInCookie = Cookies.get(COORD_COOKIE_NAME);
				const decodedCoordsInCookie = encodedCoordsInCookie
					? decodeCoords(encodedCoordsInCookie)
					: null;

				let shouldFetch = true;

				if (decodedCoordsInCookie) {
					// If client-side coordinates match the ones in the cookie, do nothing (don't re-set cookie)
					if (
						Math.abs(latitude - decodedCoordsInCookie.lat) < 0.01 &&
						Math.abs(longitude - decodedCoordsInCookie.lon) < 0.01
					) {
						console.log('Client-side coordinates match cookie. Doing nothing.');
						shouldFetch = true; // Still fetch weather for current location
					} else {
						// If different location, encrypt and place in cookie
						const newEncodedCoords = encodeCoords(latitude, longitude);
						Cookies.set(COORD_COOKIE_NAME, newEncodedCoords, { expires: 7 }); // Cookie expires in 7 days
						console.log('New location detected. Encrypted coordinates placed in cookie.');
					}
				} else if (!isNairobi) {
					// If no cookie and not Nairobi, set the cookie
					const newEncodedCoords = encodeCoords(latitude, longitude);
					Cookies.set(COORD_COOKIE_NAME, newEncodedCoords, { expires: 7 });
					console.log('No cookie found and not Nairobi. Encrypted coordinates placed in cookie.');
				}

				if (shouldFetch) {
					// Send latitude and longitude to the server to fetch weather
					const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);

					if (res.ok) {
						console.log(res);
						const newData = await res.json();
						weather = newData.weather;
					}
				}
			},
			(error) => {
				console.error('Geolocation error:', error);
				// Fallback to default location if geolocation fails
				const encodedCoordsInCookie = Cookies.get(COORD_COOKIE_NAME);
				if (encodedCoordsInCookie) {
					const decoded = decodeCoords(encodedCoordsInCookie);
					if (decoded) {
						console.log('Using coordinates from cookie due to geolocation error.');
						fetch(`/api/weather?lat=${decoded.lat}&lon=${decoded.lon}`)
							.then((res) => res.json())
							.then((newData) => {
								weather = newData.weather;
							})
							.catch((err) => console.error('Failed to fetch weather with cookie coords:', err));
					}
				}
			}
		);
	} else if (browser) {
		console.log('Geolocation is not supported by this browser.');
		// Fallback to default location if geolocation is not supported
		const encodedCoordsInCookie = Cookies.get(COORD_COOKIE_NAME);
		if (encodedCoordsInCookie) {
			const decoded = decodeCoords(encodedCoordsInCookie);
			if (decoded) {
				console.log('Using coordinates from cookie because geolocation is not supported.');
				fetch(`/api/weather?lat=${decoded.lat}&lon=${decoded.lon}`)
					.then((res) => res.json())
					.then((newData) => {
						weather = newData.weather;
					})
					.catch((err) => console.error('Failed to fetch weather with cookie coords:', err));
			}
		}
	}

	const temperature = tweened(0, {
		duration: 800,
		easing: cubicOut
	});

	$: if (weather) {
		temperature.set(weather.main.temp);
	}

	// Reactive Date formatting
	$: date = weather ? new Date(weather.dt * 1000) : new Date();
	$: time = date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	$: day = date.toLocaleDateString('en-US', { weekday: 'long' });
	$: fullDate = date.toLocaleDateString('en-US', {
		day: '2-digit',
		month: 'short',
		year: '2-digit'
	});

	$: isNight = date.getHours() >= 18 || date.getHours() < 6;

	// Weather icon mapping
	const weatherIcons = {
		Thunderstorm: CloudLightning,
		Drizzle: CloudRain,
		Rain: CloudRain,
		Snow: CloudSnow,
		Mist: Cloud,
		Smoke: Cloud,
		Haze: Cloud,
		Dust: Cloud,
		Fog: Cloud,
		Sand: Cloud,
		Ash: Cloud,
		Squall: Wind,
		Tornado: Wind,
		Clear: Sun,
		Clouds: Cloud
	};
	$: weatherCondition = weather ? weather.weather[0].main : 'Clear';
	$: WeatherIcon = weather
		? weatherCondition === 'Clear' && isNight
			? Moon
			: weatherIcons[weatherCondition as keyof typeof weatherIcons] || Cloud
		: Cloud;

	$: if (weather) {
		const condition = weather.weather[0].main.toLowerCase();
		let newBg: string;
		if (condition === 'clear') {
			newBg = isNight ? '/clear_night.jpg' : '/clear_day.jpeg';
		} else if (condition === 'clouds') {
			newBg = !isNight ? '/clouds_day.jpg' : '/rain_night.jpg';
		} else if (['rain', 'drizzle', 'thunderstorm'].includes(condition)) {
			newBg = isNight ? '/rain_night.jpg' : '/rain_afternoon.jpg';
		} else {
			newBg = isNight ? '/rain_night.jpg' : '/rain_afternoon.jpg';
		}
		bgToUse = newBg;
	}

	onMount(() => {
		console.log(weather);
	});
</script>

<main
	class="p-5e flex min-h-screen flex-col items-center gap-5"
	style="background-image: url({bgToUse}); background-size: cover; background-position: center;"
>
	<div
		class="relative flex min-h-screen w-full flex-col bg-[#00000010] p-6 backdrop-blur-xl sm:flex-row sm:backdrop-blur-lg"
	>
		<div class="mx-auto my-3 flex w-full flex-col justify-start sm:justify-between">
			<h1 class="font-bold">Angather</h1>
			{#if weather}
				<aside class="mt-6 flex items-center gap-6 sm:mt-0">
					<h2 class="text-xl sm:text-7xl">{Math.round($temperature)}° C</h2>
					<article class="flex h-full flex-col items-center justify-between">
						<h3 class="text-2xl sm:text-5xl">{weather.name}</h3>
						<div class="flex items-center gap-1 text-xs">
							<p>
								{new Date().toLocaleTimeString('en-US', {
									hour: '2-digit',
									minute: '2-digit',
									hour12: false
								})}
							</p>
							<p>{day}</p>
							<p>{fullDate}</p>
						</div>
					</article>
					<article class="flex flex-col items-center gap-1">
						<svelte:component this={WeatherIcon} class="opacity-60" />
						<p in:fly={{ duration: 300, delay: 300 }} class="text-base opacity-80 sm:text-xl">
							{weatherCondition}
						</p>
					</article>
				</aside>
			{:else}
				<p>Loading weather data...</p>
			{/if}
		</div>
		<aside
			class="my-auto h-full w-full rounded-xl border border-[#171717] bg-[#171717aa] p-6 text-white shadow-lg sm:w-2/3"
		>
			<input
				type="text"
				class="mb-6 w-full rounded border-b border-cyan-500/50 bg-transparent pb-2 opacity-60 transition outline-none placeholder:italic placeholder:opacity-50 focus:opacity-90"
				placeholder="Search for a different place..."
			/>
			<h3 class="mb-4 text-xl font-bold sm:text-3xl">Details</h3>
			{#if weather}
				<ul class="ml-1 flex flex-col gap-2 opacity-80">
					<li class="flex items-center gap-4">
						<span class="font-semibold">Feels Like:</span>
						<p>{weather.main.feels_like}° C</p>
					</li>
					<li class="flex items-center gap-4">
						<span class="font-semibold">Humidity:</span>
						<p>{weather.main.humidity} %</p>
					</li>
					<li class="flex items-center gap-4">
						<span class="font-semibold">Pressure:</span>
						<p>{weather.main.pressure} hPa</p>
					</li>
					<li class="flex items-center gap-4">
						<span class="font-semibold">Wind Speed:</span>
						<p>{weather.wind.speed} m/s</p>
					</li>
				</ul>
				<p class="mt-6 ml-auto w-fit text-right text-xs opacity-30">Last updated {format(time)}</p>
			{:else}
				<p class="opacity-70">Missing weather details</p>
			{/if}
		</aside>
	</div>
</main>
