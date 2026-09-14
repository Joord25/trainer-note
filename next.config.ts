import type {NextConfig} from 'next';
// Hosting serves the exported client app; Firebase Functions handles authenticated AI calls.
const nextConfig:NextConfig={
 output:'export',
 ...(process.env.NODE_ENV==='development'?{async headers(){return [{source:'/:path*',headers:[{key:'Cross-Origin-Opener-Policy',value:'same-origin-allow-popups'}]}];}}:{}),
};
export default nextConfig;
