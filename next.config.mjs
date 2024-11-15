/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push(...[
      '@napi-rs/canvas',
      '@napi-rs/canvas-android-arm64',
      '@napi-rs/canvas-darwin-arm64',
      '@napi-rs/canvas-darwin-x64',
      '@napi-rs/canvas-linux-arm-gnueabihf',
      '@napi-rs/canvas-linux-arm64-gnu',
      '@napi-rs/canvas-linux-arm64-musl',
      '@napi-rs/canvas-linux-x64-gnu',
      '@napi-rs/canvas-linux-x64-musl',
      '@napi-rs/canvas-win32-x64-msvc',
    ]);
    return config;
  },
};

export default nextConfig;
