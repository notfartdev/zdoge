/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable Turbopack for production builds (it has issues with binary files)
  experimental: {
    turbo: undefined,
  },
  // Exclude large binary files from webpack processing
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.(wasm|zkey)$/,
      type: 'asset/resource',
    });
    return config;
  },
  
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:", // Required for Next.js + snarkjs
              "worker-src 'self' blob:", // Required for snarkjs Web Workers
              "style-src 'self' 'unsafe-inline'", // Required for styled-components/tailwind
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.dogeos.com wss://*.dogeos.com http://localhost:* ws://localhost:* https://api.coingecko.com https://*.onrender.com https://dogenadocash.onrender.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HTTPS only (for production)
          ...(process.env.NODE_ENV === 'production' 
            ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains',
              }]
            : []),
        ],
      },
    ];
  },
}

export default nextConfig
