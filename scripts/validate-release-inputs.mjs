import { assertChannel, assertConfigVersion, assertExactSemver } from './release-args.mjs'

assertExactSemver(process.env.OPENCODEX_VERSION)
assertConfigVersion(process.env.OPENCODEX_CONFIG_VERSION)
if (process.env.OPENCODEX_CHANNEL) {
  assertChannel(process.env.OPENCODEX_CHANNEL)
}
