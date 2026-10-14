const assert = require('node:assert/strict')
const { dnsRecordNames, relativeDnsName } = require('../apps/web/src/lib/hosting/dns-records.ts')
for (const [hostname, zone, routingHost, ownershipHost, isRoot] of [
  ['childrensavingplan.ca', 'childrensavingplan.ca', '@', '_awb-verification', true],
  ['www.childrensavingplan.ca', 'childrensavingplan.ca', 'www', '_awb-verification.www', false],
  ['example.co.uk', 'example.co.uk', '@', '_awb-verification', true],
  ['shop.eu.example.co.uk', 'example.co.uk', 'shop.eu', '_awb-verification.shop.eu', false],
  ['customer.github.io', 'customer.github.io', '@', '_awb-verification', true],
]) {
  const result = dnsRecordNames(hostname)
  assert.deepEqual(result, { zone, routingHost, ownershipHost, isRoot })
  // The provider appends the zone; copied short names must reconstruct the
  // exact hostname that ownership and routing verification query.
  assert.equal(routingHost === '@' ? zone : `${routingHost}.${zone}`, hostname)
  assert.equal(`${ownershipHost}.${zone}`, `_awb-verification.${hostname}`)
}
assert.equal(relativeDnsName('_acme-challenge.www.example.co.uk.', 'example.co.uk'), '_acme-challenge.www')
assert.equal(relativeDnsName('validation.other.net', 'example.co.uk'), 'validation.other.net')
console.log('DNS Host guidance passed: roots, nested subdomains, co.uk, private suffixes and HTTPS TXT names.')
