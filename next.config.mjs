/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@huggingface/transformers'],
};

export default nextConfig;
