import { createHash } from 'node:crypto'
import { ACMClient, RequestCertificateCommand, DescribeCertificateCommand } from '@aws-sdk/client-acm'
import { CloudFrontClient, CreateDistributionCommand, GetDistributionCommand, GetDistributionConfigCommand, UpdateDistributionCommand, CreateFunctionCommand, DescribeFunctionCommand, UpdateFunctionCommand, PublishFunctionCommand, ListDistributionsCommand, CreateInvalidationCommand, GetInvalidationCommand, DeleteFunctionCommand } from '@aws-sdk/client-cloudfront'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import JSZip from 'jszip'
import { assertHostingConfigured } from './config'
const cf = () => new CloudFrontClient({ region: 'us-east-1', maxAttempts: 3 })
const acm = () => new ACMClient({ region: 'us-east-1', maxAttempts: 3 })
export const releasePrefix = (projectId: string, releaseId: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !/^[a-zA-Z0-9_-]+$/.test(releaseId)) throw new Error('Invalid release identifier')
  return `sites/${projectId}/releases/${releaseId}`
}
export function routingFunction(primary?: string) {
  const primaryJson = JSON.stringify(primary ?? '')
  return `function handler(event){var request=event.request;var primary=${primaryJson};var host=request.headers.host.value;if(primary&&host!==primary){var query=[];for(var key in request.querystring){var item=request.querystring[key];var values=item.multiValue||[item];for(var i=0;i<values.length;i++)query.push(key+'='+values[i].value);}return {statusCode:308,headers:{location:{value:'https://'+primary+request.uri+(query.length?'?'+query.join('&'):'')}}};}if(request.uri.endsWith('/'))request.uri+='index.html';else if(request.uri.split('/').pop().indexOf('.')<0)request.uri+='/index.html';return request;}`
}
export async function ensureRoutingFunction(projectId: string, releaseId: string, primary?: string) {
  const client = cf(); const Name = `wt-${projectId}-${releaseId}`
  const config = { Comment: `Webtummy ${projectId}`, Runtime: 'cloudfront-js-2.0' as const }
  let etag: string | undefined
  try { etag = (await client.send(new DescribeFunctionCommand({ Name, Stage: 'DEVELOPMENT' }))).ETag } catch (error) { if ((error as { name?: string }).name !== 'NoSuchFunctionExists') throw error }
  const code = Buffer.from(routingFunction(primary))
  const result = etag ? await client.send(new UpdateFunctionCommand({ Name, IfMatch: etag, FunctionCode: code, FunctionConfig: config })) : await client.send(new CreateFunctionCommand({ Name, FunctionCode: code, FunctionConfig: config }))
  const published = await client.send(new PublishFunctionCommand({ Name, IfMatch: result.ETag }))
  const arn = published.FunctionSummary?.FunctionMetadata?.FunctionARN
  if (!arn) throw new Error('CloudFront did not return a routing function.')
  return arn
}
export async function ensureDistribution(projectId: string) {
  const settings = assertHostingConfigured(); const client = cf()
  // Recover a distribution created before a platform process interrupted its DB save.
  let Marker: string | undefined
  do {
    const list = await client.send(new ListDistributionsCommand({ Marker }))
    const existing = list.DistributionList?.Items?.find((entry) => entry.Comment === `Webtummy ${projectId}`)
    if (existing?.Id && existing.DomainName) return { id: existing.Id, hostname: existing.DomainName }
    Marker = list.DistributionList?.IsTruncated ? list.DistributionList.NextMarker : undefined
  } while (Marker)
  const result = await client.send(new CreateDistributionCommand({ DistributionConfig: {
    CallerReference: `webtummy-${projectId}`, Comment: `Webtummy ${projectId}`, Enabled: true,
    DefaultRootObject: 'index.html', HttpVersion: 'http2and3', IsIPV6Enabled: true,
    Origins: { Quantity: 1, Items: [{ Id: 'site', DomainName: `${settings.bucket}.s3.${settings.region}.amazonaws.com`, OriginPath: `/sites/${projectId}/unpublished`, OriginAccessControlId: settings.oacId, S3OriginConfig: { OriginAccessIdentity: '' } }] },
    DefaultCacheBehavior: { TargetOriginId: 'site', ViewerProtocolPolicy: 'redirect-to-https', Compress: true, AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'], CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] } }, CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6' },
    ViewerCertificate: { CloudFrontDefaultCertificate: true },
    CustomErrorResponses: { Quantity: 2, Items: [{ ErrorCode: 403, ResponseCode: '404', ResponsePagePath: '/404.html', ErrorCachingMinTTL: 0 }, { ErrorCode: 404, ResponseCode: '404', ResponsePagePath: '/404.html', ErrorCachingMinTTL: 0 }] },
  } }))
  if (!result.Distribution?.Id || !result.Distribution.DomainName) throw new Error('CloudFront did not return a distribution.')
  return { id: result.Distribution.Id, hostname: result.Distribution.DomainName }
}
export async function certificateDetails(arn: string) {
  return (await acm().send(new DescribeCertificateCommand({ CertificateArn: arn }))).Certificate
}
export async function ensureCertificate(projectId: string, hosts: string[], existingArn?: string | null) {
  if (existingArn) { const existing = await certificateDetails(existingArn); if (hosts.every((host) => existing?.SubjectAlternativeNames?.includes(host)) && existing?.Status !== 'FAILED' && existing?.Status !== 'EXPIRED') return existingArn }
  const result = await acm().send(new RequestCertificateCommand({ DomainName: hosts[0], SubjectAlternativeNames: hosts.slice(1), ValidationMethod: 'DNS', IdempotencyToken: createHash('sha256').update(`${projectId}:${hosts.slice().sort().join(',')}`).digest('hex').slice(0, 32), Options: { CertificateTransparencyLoggingPreference: 'ENABLED' }, Tags: [{ Key: 'WebtummyProject', Value: projectId }] }))
  if (!result.CertificateArn) throw new Error('Certificate request did not return an ARN.')
  return result.CertificateArn
}
const contentTypes: Record<string, string> = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', json: 'application/json', xml: 'application/xml', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif', ico: 'image/x-icon', woff2: 'font/woff2' }
export async function uploadRelease(projectId: string, releaseId: string, archive: Buffer) {
  const settings = assertHostingConfigured(); const client = new S3Client({ region: settings.region })
  const zip = await JSZip.loadAsync(archive)
  if (!zip.file('404.html')) zip.file('404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found</title><h1>Page not found</h1><a href="/">Return home</a></html>')
  const files = Object.values(zip.files).filter((file) => !file.dir)
  if (!zip.file('index.html') || files.length > 10000) throw new Error('Invalid website archive.')
  for (let offset = 0; offset < files.length; offset += 8) {
    await Promise.all(files.slice(offset, offset + 8).map(async (file) => {
      if (file.name.startsWith('/') || file.name.split('/').includes('..') || file.name.includes('\\')) throw new Error('Invalid archive path.')
      await client.send(new PutObjectCommand({ Bucket: settings.bucket, Key: `${releasePrefix(projectId, releaseId)}/${file.name}`, Body: await file.async('nodebuffer'), ContentType: contentTypes[file.name.split('.').pop() ?? ''] ?? 'application/octet-stream', CacheControl: 'public,max-age=300' }))
    }))
  }
}
export async function activateRelease(input: { distributionId: string; projectId: string; releaseId: string; functionArn: string; hosts: string[]; certificateArn?: string | null }) {
  const client = cf()
  const { DistributionConfig: config, ETag } = await client.send(new GetDistributionConfigCommand({ Id: input.distributionId }))
  if (!config || !config.Origins?.Items?.[0] || !config.DefaultCacheBehavior) throw new Error('Hosting distribution configuration is missing.')
  config.Origins.Items[0].OriginPath = `/${releasePrefix(input.projectId, input.releaseId)}`
  config.DefaultCacheBehavior.FunctionAssociations = { Quantity: 1, Items: [{ EventType: 'viewer-request', FunctionARN: input.functionArn }] }
  config.Aliases = { Quantity: input.hosts.length, Items: input.hosts }
  config.ViewerCertificate = input.hosts.length ? { ACMCertificateArn: input.certificateArn!, SSLSupportMethod: 'sni-only', MinimumProtocolVersion: 'TLSv1.2_2021' } : { CloudFrontDefaultCertificate: true }
  await client.send(new UpdateDistributionCommand({ Id: input.distributionId, IfMatch: ETag, DistributionConfig: config }))
}
export async function distributionDetails(id: string) { return (await cf().send(new GetDistributionCommand({ Id: id }))).Distribution }

export async function ensureInvalidation(distributionId: string, releaseId: string) {
  const result = await cf().send(new CreateInvalidationCommand({ DistributionId: distributionId, InvalidationBatch: { CallerReference: `release-${releaseId}`, Paths: { Quantity: 1, Items: ['/*'] } } }))
  if (!result.Invalidation?.Id) throw new Error('Cache refresh could not be started.')
  return result.Invalidation.Id
}
export async function invalidationComplete(distributionId: string, id: string) {
  return (await cf().send(new GetInvalidationCommand({ DistributionId: distributionId, Id: id }))).Invalidation?.Status === 'Completed'
}

export async function deleteReleaseFunction(projectId: string, releaseId: string) {
  const client = cf(); const Name = `wt-${projectId}-${releaseId}`
  const current = await client.send(new DescribeFunctionCommand({ Name, Stage: 'DEVELOPMENT' }))
  await client.send(new DeleteFunctionCommand({ Name, IfMatch: current.ETag }))
}

export const TEMPORARY_SITE_PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Temporarily unavailable</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:15vh auto;padding:24px;color:#334155;background:#f8fafc}h1{font-size:28px}</style></head><body><h1>This website is temporarily unavailable</h1><p>Please check back later.</p></body></html>'
export function suspensionFunction() {
  return `function handler(event){return {statusCode:503,statusDescription:'Service Unavailable',headers:{'content-type':{value:'text/html; charset=utf-8'},'cache-control':{value:'no-store'},'retry-after':{value:'3600'},'x-robots-tag':{value:'noindex'},'content-security-policy':{value:"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}},body:{encoding:'text',data:${JSON.stringify(TEMPORARY_SITE_PAGE)}}};}`
}
async function ensureSuspensionFunction(projectId: string) {
  const client = cf(); const Name = `wt-${projectId}-billing`
  const FunctionConfig = { Comment: `Webtummy temporary availability ${projectId}`, Runtime: 'cloudfront-js-2.0' as const }
  let etag: string | undefined
  try { etag = (await client.send(new DescribeFunctionCommand({ Name, Stage: 'DEVELOPMENT' }))).ETag } catch (error) { if ((error as { name?: string }).name !== 'NoSuchFunctionExists') throw error }
  const FunctionCode = Buffer.from(suspensionFunction())
  const result = etag ? await client.send(new UpdateFunctionCommand({ Name, IfMatch: etag, FunctionCode, FunctionConfig })) : await client.send(new CreateFunctionCommand({ Name, FunctionCode, FunctionConfig }))
  const published = await client.send(new PublishFunctionCommand({ Name, IfMatch: result.ETag }))
  const arn = published.FunctionSummary?.FunctionMetadata?.FunctionARN
  if (!arn) throw new Error('Temporary availability function is unavailable.')
  return arn
}
export async function setBillingGate(input: { distributionId: string; projectId: string; suspended: boolean; functionArn: string | null }) {
  const client = cf()
  const { DistributionConfig: config, ETag } = await client.send(new GetDistributionConfigCommand({ Id: input.distributionId }))
  if (!config?.DefaultCacheBehavior) throw new Error('Hosting distribution configuration is missing.')
  if (input.suspended && config.DefaultCacheBehavior.FunctionAssociations?.Items?.some(item => item.EventType === 'viewer-request' && item.FunctionARN?.endsWith(`/wt-${input.projectId}-billing`))) return
  const functionArn = input.suspended ? await ensureSuspensionFunction(input.projectId) : input.functionArn
  config.DefaultCacheBehavior.FunctionAssociations = functionArn ? { Quantity: 1, Items: [{ EventType: 'viewer-request', FunctionARN: functionArn }] } : { Quantity: 0 }
  await client.send(new UpdateDistributionCommand({ Id: input.distributionId, IfMatch: ETag, DistributionConfig: config }))
}
