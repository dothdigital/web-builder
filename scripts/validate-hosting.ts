import assert from 'node:assert/strict'
import vm from 'node:vm'
import JSZip from 'jszip'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { S3Client } from '@aws-sdk/client-s3'
import { normalizeHostname, hostingConfig, assertCustomerHostname } from '../apps/web/src/lib/hosting/config'
import { routingFunction, uploadRelease, activateRelease, ensureDistribution, releasePrefix } from '../apps/web/src/lib/hosting/aws'

async function main() {
  assert.equal(normalizeHostname('WWW.Example.COM.'), 'www.example.com')
  for (const value of ['https://example.com', 'example.com/path', '*.example.com', '127.0.0.1', 'localhost', 'bad.example:3000', 'foo.local', 'x\nexample.com']) assert.throws(() => normalizeHostname(value))
  assert.throws(() => assertCustomerHostname('app.webtummy.com'))
  assert.throws(() => releasePrefix('../other', 'release'))
  const route = (host: string, uri: string, primary?: string) => vm.runInNewContext(`${routingFunction(primary)};handler(event)`, { event: { request: { uri, headers: { host: { value: host } }, querystring: { utm_source: { value: 'mail' } } } } })
  assert.equal(route('example.com', '/about', 'example.com').uri, '/about/index.html')
  assert.equal(route('example.com', '/', 'example.com').uri, '/index.html')
  assert.equal(route('example.com', '/assets/photo.webp', 'example.com').uri, '/assets/photo.webp')
  const redirect = route('www.example.com', '/about', 'example.com')
  assert.equal(redirect.statusCode, 308)
  assert.equal(redirect.headers.location.value, 'https://example.com/about?utm_source=mail')
  assert.equal(route('temporary.cloudfront.net', '/about').uri, '/about/index.html')
  const envKeys = ['HOSTING_S3_BUCKET', 'HOSTING_AWS_REGION', 'HOSTING_CLOUDFRONT_OAC_ID', 'HOSTING_PUBLIC_API_URL'] as const
  const previous = envKeys.map((key) => [key, process.env[key]] as const)
  const oldCf = CloudFrontClient.prototype.send
  const oldS3 = S3Client.prototype.send
  const calls: Array<{ name: string; input: Record<string, unknown> }> = []
  try {
    for (const key of envKeys) delete process.env[key]
    assert.equal(hostingConfig().configured, false)
    Object.assign(process.env, { HOSTING_S3_BUCKET: 'test-published-bucket', HOSTING_AWS_REGION: 'ca-central-1', HOSTING_CLOUDFRONT_OAC_ID: 'oac-test', HOSTING_PUBLIC_API_URL: 'https://app.webtummy.com' })
    assert.equal(hostingConfig().configured, true)
    Object.assign(CloudFrontClient.prototype, { send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      calls.push({ name: command.constructor.name, input: command.input })
      switch (command.constructor.name) {
        case 'ListDistributionsCommand': return { DistributionList: { Items: [], IsTruncated: false } }
        case 'CreateDistributionCommand': return { Distribution: { Id: 'distribution-test', DomainName: 'test.cloudfront.net' } }
        case 'GetDistributionConfigCommand': return { ETag: 'etag', DistributionConfig: { Origins: { Items: [{ OriginPath: '/old' }] }, DefaultCacheBehavior: {} } }
        default: return {}
      }
    } })
    Object.assign(S3Client.prototype, { send: async (command: { input: Record<string, unknown> }) => { calls.push({ name: 'PutObjectCommand', input: command.input }); return {} } })
    const distribution = await ensureDistribution('project-one')
    assert.equal(distribution.id, 'distribution-test')
    const zip = new JSZip(); zip.file('index.html', '<h1>Home</h1>'); zip.file('about/index.html', '<h1>About</h1>')
    await uploadRelease('project-one', 'release-two', await zip.generateAsync({ type: 'nodebuffer' }))
    const uploads = calls.filter((call) => call.name === 'PutObjectCommand')
    assert.equal(uploads.length, 3)
    assert.ok(uploads.every((call) => String(call.input.Key).startsWith('sites/project-one/releases/release-two/')))
    assert.ok(uploads.some((call) => String(call.input.Key).endsWith('/404.html')))
    await activateRelease({ projectId: 'project-one', releaseId: 'release-two', distributionId: 'distribution-test', hosts: ['example.com'], certificateArn: 'cert-test', functionArn: 'function-test' })
    const update = calls.find((call) => call.name === 'UpdateDistributionCommand')!.input as { DistributionConfig: { Origins: { Items: Array<{ OriginPath: string }> }; Aliases: { Items: string[] }; ViewerCertificate: { ACMCertificateArn: string } } }
    assert.equal(update.DistributionConfig.Origins.Items[0]!.OriginPath, '/sites/project-one/releases/release-two')
    assert.deepEqual(update.DistributionConfig.Aliases.Items, ['example.com'])
    assert.equal(update.DistributionConfig.ViewerCertificate.ACMCertificateArn, 'cert-test')
  } finally {
    Object.assign(CloudFrontClient.prototype, { send: oldCf }); Object.assign(S3Client.prototype, { send: oldS3 })
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
  console.log('PASS: domain validation, reserved domains, routing/redirects, setup gating, isolated release uploads and distribution activation. AWS calls mocked.')
}
void main()
