import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.VITE_GITHUB_REPOSITORY_NAME || "minhag-kosher-web";
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  base: isGitHubPages ? `/${repositoryName}/` : '/',
})
