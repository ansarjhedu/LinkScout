/**
 * Test Suite: Field Builder
 * 
 * Tests provenance tracking, confidence validation, and field merging.
 */

import {
  buildField,
  mergeFields,
  fieldFromSchema,
  extractWithProvenance,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
  buildMissingField,
} from '../utils/fieldBuilder.js';

/**
 * Test 1: Basic field creation
 */
export function testBasicFieldCreation() {
  const field = buildField('Acme Inc', CONFIDENCE_LEVELS.VERIFIED, 'https://example.com', null, EVIDENCE_TYPES.SCHEMA);

  console.assert(field.value === 'Acme Inc', 'Should have correct value');
  console.assert(field.confidence === CONFIDENCE_LEVELS.VERIFIED, 'Should be VERIFIED');
  console.assert(field.evidenceType === EVIDENCE_TYPES.SCHEMA, 'Should be SCHEMA');
  console.log('✓ Test 1: Basic field creation PASSED');
}

/**
 * Test 2: VERIFIED only allowed for strong evidence
 */
export function testVerifiedEnforcement() {
  // This should auto-downgrade to INFERRED
  const field = buildField(
    'Acme Inc',
    CONFIDENCE_LEVELS.VERIFIED,
    'https://example.com',
    null,
    EVIDENCE_TYPES.PAGE_TEXT
  );

  console.assert(
    field.confidence === CONFIDENCE_LEVELS.INFERRED,
    'PAGE_TEXT evidence should downgrade VERIFIED to INFERRED'
  );
  console.log('✓ Test 2: VERIFIED enforcement PASSED');
}

/**
 * Test 3: INFERRED for weak evidence
 */
export function testInferredEvidence() {
  const field = buildField(
    'Acme Inc',
    CONFIDENCE_LEVELS.INFERRED,
    'https://example.com',
    null,
    EVIDENCE_TYPES.LINK_PATTERN
  );

  console.assert(field.confidence === CONFIDENCE_LEVELS.INFERRED, 'Should remain INFERRED');
  console.assert(field.evidenceType === EVIDENCE_TYPES.LINK_PATTERN, 'Evidence type preserved');
  console.log('✓ Test 3: INFERRED evidence PASSED');
}

/**
 * Test 4: MISSING always has reason
 */
export function testMissingWithReason() {
  const field = buildField(null, CONFIDENCE_LEVELS.MISSING, 'https://example.com', MISSING_REASONS.NOT_ON_WEBSITE);

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Should be MISSING');
  console.assert(field.reason === MISSING_REASONS.NOT_ON_WEBSITE, 'Should have reason');
  console.assert(field.value === null, 'Value should be null');
  console.log('✓ Test 4: MISSING with reason PASSED');
}

/**
 * Test 5: Empty array treated as MISSING
 */
export function testEmptyArrayMissing() {
  const field = buildField([], CONFIDENCE_LEVELS.VERIFIED);

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Empty array should be MISSING');
  console.assert(field.value === null, 'Value should be null');
  console.log('✓ Test 5: Empty array as MISSING PASSED');
}

/**
 * Test 6: Blank string treated as MISSING
 */
export function testBlankStringMissing() {
  const field = buildField('   ', CONFIDENCE_LEVELS.VERIFIED);

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Blank string should be MISSING');
  console.log('✓ Test 6: Blank string as MISSING PASSED');
}

/**
 * Test 7: Merge fields by priority
 */
export function testMergeFieldsByPriority() {
  const schemaField = buildField('Acme Corp', CONFIDENCE_LEVELS.VERIFIED, null, null, EVIDENCE_TYPES.SCHEMA);
  const textField = buildField('Acme Inc', CONFIDENCE_LEVELS.INFERRED, null, null, EVIDENCE_TYPES.PAGE_TEXT);

  const merged = mergeFields([textField, schemaField]);

  console.assert(merged.value === 'Acme Corp', 'Schema should win');
  console.assert(merged.evidenceType === EVIDENCE_TYPES.SCHEMA, 'Schema evidence type preserved');
  console.log('✓ Test 7: Field merge priority PASSED');
}

/**
 * Test 8: Merge empty array returns MISSING
 */
export function testMergeEmptyArray() {
  const merged = mergeFields([]);

  console.assert(merged.confidence === CONFIDENCE_LEVELS.MISSING, 'Should be MISSING');
  console.log('✓ Test 8: Merge empty array PASSED');
}

/**
 * Test 9: Merge filters null values
 */
export function testMergeFiltersNull() {
  const nullField = buildField(null);
  const validField = buildField('Valid', CONFIDENCE_LEVELS.INFERRED, null, null, EVIDENCE_TYPES.PAGE_TEXT);

  const merged = mergeFields([nullField, validField]);

  console.assert(merged.value === 'Valid', 'Should skip null values');
  console.log('✓ Test 9: Merge filters null PASSED');
}

/**
 * Test 10: Extract with provenance
 */
export function testExtractWithProvenance() {
  const field = extractWithProvenance(
    'Acme Inc',
    'https://example.com',
    EVIDENCE_TYPES.SCHEMA
  );

  console.assert(field.value === 'Acme Inc', 'Should have value');
  console.assert(field.confidence === CONFIDENCE_LEVELS.VERIFIED, 'Schema should be VERIFIED');
  console.assert(field.source === 'https://example.com', 'Should have source');
  console.log('✓ Test 10: Extract with provenance PASSED');
}

/**
 * Test 11: Extract null with provenance
 */
export function testExtractNullWithProvenance() {
  const field = extractWithProvenance(null, 'https://example.com', EVIDENCE_TYPES.SCHEMA);

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Should be MISSING');
  console.assert(field.reason === MISSING_REASONS.NOT_ON_WEBSITE, 'Should have reason');
  console.log('✓ Test 11: Extract null with provenance PASSED');
}

/**
 * Test 12: Field from schema with safe access
 */
export function testFieldFromSchema() {
  const schema = {
    name: 'Acme Inc',
    address: {
      streetAddress: '123 Main',
      city: 'Boston',
    },
  };

  const nameField = fieldFromSchema(schema, 'name', 'https://example.com');
  console.assert(nameField.value === 'Acme Inc', 'Should extract name');
  console.assert(nameField.confidence === CONFIDENCE_LEVELS.VERIFIED, 'Should be VERIFIED');

  const addressField = fieldFromSchema(schema, 'address.streetAddress', 'https://example.com');
  console.assert(addressField.value === '123 Main', 'Should extract nested value');
  console.log('✓ Test 12: Field from schema PASSED');
}

/**
 * Test 13: Field from schema with missing path
 */
export function testFieldFromSchemaMissing() {
  const schema = { name: 'Acme' };

  const field = fieldFromSchema(schema, 'address.country', 'https://example.com');

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Should be MISSING');
  console.assert(field.reason === MISSING_REASONS.SCHEMA_INCOMPLETE, 'Should have schema reason');
  console.log('✓ Test 13: Field from schema missing PASSED');
}

/**
 * Test 14: Metadata preservation
 */
export function testMetadataPreservation() {
  const field = buildField(
    'Acme Inc',
    CONFIDENCE_LEVELS.VERIFIED,
    'https://example.com',
    null,
    EVIDENCE_TYPES.SCHEMA,
    { schemaPath: 'Organization.name', detectedAt: 'h1' }
  );

  console.assert(field.metadata.schemaPath === 'Organization.name', 'Metadata preserved');
  console.assert(field.metadata.detectedAt === 'h1', 'Custom metadata preserved');
  console.log('✓ Test 14: Metadata preservation PASSED');
}

/**
 * Test 15: Build missing field helper
 */
export function testBuildMissingFieldHelper() {
  const field = buildMissingField(MISSING_REASONS.NOT_IN_SCHEMA);

  console.assert(field.confidence === CONFIDENCE_LEVELS.MISSING, 'Should be MISSING');
  console.assert(field.reason === MISSING_REASONS.NOT_IN_SCHEMA, 'Should have specified reason');
  console.log('✓ Test 15: Build missing field helper PASSED');
}

/**
 * Test 16: Non-MISSING field doesn't include reason
 */
export function testNonMissingNoReason() {
  const field = buildField(
    'Acme',
    CONFIDENCE_LEVELS.INFERRED,
    null,
    MISSING_REASONS.NOT_ON_WEBSITE  // This should be ignored
  );

  console.assert(field.reason === null, 'Reason should be ignored for non-MISSING');
  console.log('✓ Test 16: Non-MISSING field ignores reason PASSED');
}

/**
 * Test 17: Evidence type validation
 */
export function testEvidenceTypeValidation() {
  try {
    buildField('Test', CONFIDENCE_LEVELS.VERIFIED, null, null, 'INVALID_TYPE');
    console.assert(false, 'Should throw on invalid evidence type');
  } catch (err) {
    console.assert(err.message.includes('Invalid evidence type'), 'Should throw error');
    console.log('✓ Test 17: Evidence type validation PASSED');
  }
}

/**
 * Test 18: Confidence validation
 */
export function testConfidenceValidation() {
  try {
    buildField('Test', 'INVALID_CONFIDENCE');
    console.assert(false, 'Should throw on invalid confidence');
  } catch (err) {
    console.assert(err.message.includes('Invalid confidence'), 'Should throw error');
    console.log('✓ Test 18: Confidence validation PASSED');
  }
}

/**
 * Test 19: EXPLICIT_TAG allows VERIFIED
 */
export function testExplicitTagVerified() {
  const field = buildField(
    'Contact',
    CONFIDENCE_LEVELS.VERIFIED,
    'https://example.com',
    null,
    EVIDENCE_TYPES.EXPLICIT_TAG
  );

  console.assert(field.confidence === CONFIDENCE_LEVELS.VERIFIED, 'EXPLICIT_TAG should allow VERIFIED');
  console.log('✓ Test 19: EXPLICIT_TAG VERIFIED PASSED');
}

/**
 * Test 20: Field structure always consistent
 */
export function testFieldStructureConsistency() {
  const fields = [
    buildField('Value', CONFIDENCE_LEVELS.VERIFIED, 'url', null, EVIDENCE_TYPES.SCHEMA),
    buildField(null, CONFIDENCE_LEVELS.MISSING, 'url', MISSING_REASONS.NOT_ON_WEBSITE),
    buildField('', CONFIDENCE_LEVELS.INFERRED),
  ];

  for (const field of fields) {
    console.assert('value' in field, 'Should have value');
    console.assert('confidence' in field, 'Should have confidence');
    console.assert('evidenceType' in field, 'Should have evidenceType');
    console.assert('metadata' in field || field.confidence === CONFIDENCE_LEVELS.MISSING, 'Should have metadata or be MISSING');
  }

  console.log('✓ Test 20: Field structure consistency PASSED');
}

/**
 * Run all field builder tests
 */
export function runAllFieldBuilderTests() {
  console.log('\n=== Field Builder Test Suite ===\n');

  try {
    testBasicFieldCreation();
    testVerifiedEnforcement();
    testInferredEvidence();
    testMissingWithReason();
    testEmptyArrayMissing();
    testBlankStringMissing();
    testMergeFieldsByPriority();
    testMergeEmptyArray();
    testMergeFiltersNull();
    testExtractWithProvenance();
    testExtractNullWithProvenance();
    testFieldFromSchema();
    testFieldFromSchemaMissing();
    testMetadataPreservation();
    testBuildMissingFieldHelper();
    testNonMissingNoReason();
    testEvidenceTypeValidation();
    testConfidenceValidation();
    testExplicitTagVerified();
    testFieldStructureConsistency();

    console.log('\n=== All field builder tests PASSED ===\n');
  } catch (err) {
    console.error('\n=== Test FAILED ===');
    console.error(err);
  }
}

// Export for manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllFieldBuilderTests();
}
