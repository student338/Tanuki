/** @type {import('next').NextConfig} */
const nextConfig = (() => {
  // When building for Tauri (static export), disable server features
  if (process.env.TAURI_BUILD === '1') {
    return {
      output: 'export',
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
    };
  }

  // Default: standalone server mode (Docker / self-hosted)
  return {
    output: 'standalone',
    serverExternalPackages: ['@huggingface/transformers'],
  };
})();

export default nextConfig;
