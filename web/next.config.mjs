/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three/examples (exporters 等) を確実にトランスパイル
  transpilePackages: ['three'],
};

export default nextConfig;
