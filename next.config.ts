import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.loca.lt',
    'localhost',
    '127.0.0.1',
  ],
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'top-right',
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@mantine/core',
      '@mantine/hooks',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
  turbopack: {},
  webpack: (config) => {
    if (config.watchOptions) {
      const existingIgnored = Array.isArray(config.watchOptions.ignored)
        ? config.watchOptions.ignored
        : config.watchOptions.ignored
        ? [config.watchOptions.ignored]
        : [];
      config.watchOptions.ignored = [
        ...existingIgnored,
        '**/data/**',
        '**/scratch/**',
        '**/*.json',
      ];
    } else {
      config.watchOptions = {
        ignored: ['**/data/**', '**/scratch/**', '**/*.json']
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'unload=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
