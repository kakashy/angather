import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

/* Dynamically resolve allowed paths for worktree setups */
function getAllowedPaths() {
	const paths = [process.cwd()];
	
	try {
		/* Get all worktree paths from git worktree list */
		const worktreeList = execSync('git worktree list --porcelain', { encoding: 'utf8' });
		const worktreePaths = worktreeList
			.split('\n')
			.filter(line => line.startsWith('worktree '))
			.map(line => line.replace('worktree ', '').trim())
			.filter(p => p && !paths.includes(p));
		
		paths.push(...worktreePaths);
	} catch {
		/* If git command fails, just use cwd */
	}
	
	return paths;
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: getAllowedPaths()
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
