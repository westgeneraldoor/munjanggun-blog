const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const taxonomyPath = path.join(root, 'docs', 'strategy', 'SEO_TAXONOMY.json');
const {
  CORE_HUB_LABELS,
  validateTaxonomy,
  activeQueueIds,
} = require('../scripts/validate_seo_taxonomy');

// 실행판은 회전한다. 특정 Q-ID를 하드코딩하면 보드가 바뀔 때마다 테스트가 깨진다.
function sampleActiveQueueId() {
  const [queueId] = activeQueueIds();
  assert(queueId, 'ACTIVE_TOPIC_QUEUE.json에서 활성 queue id를 하나도 읽지 못했습니다.');
  return queueId;
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadLiveTaxonomy() {
  return JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
}

function withFixture(name, mutate, callback) {
  const dir = makeTempDir(`seo-taxonomy-${name}-`);
  try {
    const filePath = path.join(dir, 'SEO_TAXONOMY.json');
    const fixture = loadLiveTaxonomy();
    mutate(fixture);
    writeJson(filePath, fixture);
    callback(filePath);
  } finally {
    removeDir(dir);
  }
}

function testLiveTaxonomyPasses() {
  const errors = validateTaxonomy();
  assert.deepStrictEqual(errors, [], errors.join('\n'));
}

function testCoreHubLabelsComeFromTaxonomy() {
  assert.deepStrictEqual(CORE_HUB_LABELS, ['중문', '3연동중문', '현관중문', '방문교체', 'ABS도어']);
}

function testMissingActiveQueueAssignmentFails() {
  const queueId = sampleActiveQueueId();
  withFixture('missing-queue', (fixture) => {
    delete fixture.assignments[`queue:${queueId}`];
  }, (filePath) => {
    const errors = validateTaxonomy({ taxonomyPath: filePath });
    assert(errors.some((error) => error.includes(`missing active queue assignment: ${queueId}`)), errors.join('\n'));
  });
}

function testUnknownHubIdFails() {
  const queueId = sampleActiveQueueId();
  withFixture('unknown-hub', (fixture) => {
    fixture.assignments[`queue:${queueId}`].hub_ids = ['H999'];
  }, (filePath) => {
    const errors = validateTaxonomy({ taxonomyPath: filePath });
    assert(errors.some((error) => error.includes('unknown hub_id H999')), errors.join('\n'));
  });
}

function testPostLineageIsRequired() {
  withFixture('missing-lineage', (fixture) => {
    fixture.assignments['post:152'].source_refs = [];
  }, (filePath) => {
    const errors = validateTaxonomy({ taxonomyPath: filePath });
    assert(errors.some((error) => error.includes('post:152 needs a queue source_ref')), errors.join('\n'));
  });
}

function testUnclassifiedRecordCannotCarrySemanticIds() {
  withFixture('unclassified-ids', (fixture) => {
    const assignment = fixture.assignments['post:152'];
    assignment.classification_status = 'unclassified';
    assignment.unclassified_reason = 'fixture only';
  }, (filePath) => {
    const errors = validateTaxonomy({ taxonomyPath: filePath });
    assert(errors.some((error) => error.includes('post:152 unclassified record must have empty hub_ids, cluster_ids, intent_ids')), errors.join('\n'));
  });
}

function main() {
  testLiveTaxonomyPasses();
  testCoreHubLabelsComeFromTaxonomy();
  testMissingActiveQueueAssignmentFails();
  testUnknownHubIdFails();
  testPostLineageIsRequired();
  testUnclassifiedRecordCannotCarrySemanticIds();
  console.log('seo taxonomy tests passed');
}

main();
