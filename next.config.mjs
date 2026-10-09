/** @type {import('next').NextConfig} */
const basePath = process.env.PAGES_BASE_PATH || '';
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/') || /[?#]/.test(basePath))) {
  throw new Error('PAGES_BASE_PATH must start with /, have no trailing slash, query or fragment');
}
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
};

export default nextConfig;
