module.exports = {
  images: {
    domains: ["utfs.io"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico|blocked).*)',
        headers: [
          {
            key: 'x-middleware-rewrite',
            value: '/blocked',
          },
        ],
        has: [
          {
            type: 'header',
            key: 'x-vercel-ip-country',
            value: '(KP|RU|IR|CH)', // North Korea, Russia, Iran, Switzerland
          },
        ],
      },
    ];
  },
};
