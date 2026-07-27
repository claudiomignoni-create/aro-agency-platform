export function getBuildShortSha() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "";

  return sha ? sha.slice(0, 7) : "local";
}
