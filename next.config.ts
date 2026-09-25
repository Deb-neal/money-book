import type { NextConfig } from "next";

// GitHub Pages 프로젝트 저장소(<user>.github.io/money-book)로 배포할 때는
// NEXT_PUBLIC_BASE_PATH=/money-book 을 넣어 빌드한다. 로컬 개발에서는 비워둔다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
