/**
 * @param {string[]} hostnames
 * @returns {protocol: string, hostname: string}[]
 */
const buildRemotePatterns = (hostnames) => {
    return hostnames.map((hostname) => {
        return {
            protocol: 'https',
            hostname,
        };
    });
};

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true, // TODO: Fix ESLint errors on build and delete this
    },
    images: {
        domains: ['utfs.io'],
        remotePatterns: buildRemotePatterns([
            'picsum.photos',
            'utfs.io',
            'assets.coingecko.com',
            'coin-images.coingecko.com',
            'ethereum-optimism.github.io',
            'arbitrum.foundation',
            'raw.githubusercontent.com',
            's2.coinmarketcap.com',
            'basescan.org',
            'dynamic-assets.coinbase.com',
        ]),
    },
    webpack: (config) => {
        // Optional: Any custom webpack configuration

        // Note: Next.js may have typechecking issues with .sol imports.
        // If you encounter type errors, consider the following option:
        return config;
    },
    typescript: {
        // Typechecking will only be available after the LSP is migrated to volar
        // Until then typechecking will work in editor but not during a next.js build
        // If you absolutely need typechecking before then there is a way to generate .ts files via a ts-plugin cli command
        // To do that run `npx evmts-gen` in the root of your project
        ignoreBuildErrors: true,
    },
};

module.exports = nextConfig;
