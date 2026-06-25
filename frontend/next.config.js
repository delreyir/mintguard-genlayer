/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_CONTRACT_ADDRESS: "0x4fCBCbF376EBD5b56041A827497773817B5ba32d" },
};
module.exports = nextConfig;
