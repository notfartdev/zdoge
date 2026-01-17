/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  
  // Enable static export for IPFS deployment (uncomment when needed)
  // output: 'export',
  
  // Security headers
  async headers() {
    return [
      {
        // Cache-busting for circuit files (zkey, wasm) - prevent stale cache issues
        // Also add Cross-Origin headers for SharedArrayBuffer (required for snarkjs)
        source: '/circuits/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // Required for SharedArrayBuffer in snarkjs
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        // Verification files - allow CORS for external verification
        source: '/build-hash.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600', // Cache for 1 hour
          },
        ],
      },
      {
        source: '/build-verification.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Content Security Policy
          // Note: 'unsafe-eval' and 'unsafe-inline' are required for:
          // - Next.js development mode
          // - snarkjs ZK proof generation (uses eval for WASM)
          // - Tailwind CSS inline styles
          // These are documented trade-offs for a client-side ZK application
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:", // Required for Next.js + snarkjs
              "worker-src 'self' blob:", // Required for snarkjs Web Workers
              "style-src 'self' 'unsafe-inline'", // Required for styled-components/tailwind
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.dogeos.com wss://*.dogeos.com http://localhost:* ws://localhost:* https://api.coingecko.com https://*.onrender.com",
              "frame-ancestors 'none'", // Prevents clickjacking
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests", // Force HTTPS for all resources
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
          // Enable XSS protection (legacy, but still useful)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Strict referrer policy for privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()',
          },
          // HTTPS only (HSTS)
          ...(process.env.NODE_ENV === 'production' 
            ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains; preload',
              }]
            : []),
          // Cross-Origin policies for enhanced security
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
}

export default nextConfig
