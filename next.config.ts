import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin workspace root so Next.js doesn't get confused by lockfiles further up the tree
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
