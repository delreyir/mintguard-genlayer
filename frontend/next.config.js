/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_CONTRACT_ADDRESS: "0x0c66f72411a3E48E0afA95546D01428303145d84" },
};
module.exports = nextConfig;
