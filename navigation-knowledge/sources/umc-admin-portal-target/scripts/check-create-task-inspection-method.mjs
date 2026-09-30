import assert from 'node:assert/strict';
import { getInspectionMethodFromLookupInspection } from '../src/pages/InspectionTaskManagement/components/createTaskInspectionMethod.ts';

assert.equal(
  getInspectionMethodFromLookupInspection('digital_inspection'),
  'Digital Inspection',
);
assert.equal(
  getInspectionMethodFromLookupInspection('field_inspection'),
  'Field Inspection',
);
assert.equal(getInspectionMethodFromLookupInspection(null), undefined);
assert.equal(getInspectionMethodFromLookupInspection(undefined), undefined);
assert.equal(getInspectionMethodFromLookupInspection('Digital Inspection'), undefined);
assert.equal(getInspectionMethodFromLookupInspection('field'), undefined);

