const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { readJsonFile } = require('./lib/file_store');
const { dedupEntries } = require('./lib/posting_registry');

const TAXONOMY_PATH = paths.docsStrategy('SEO_TAXONOMY.json');
const QUEUE_PATH = paths.docsStrategy('ACTIVE_TOPIC_QUEUE.json');
const REGISTRY_PATH = paths.docsStrategy('POSTING_REGISTRY.json');
const CLASSIFICATION_STATUSES = new Set(['classified', 'unclassified', 'not_applicable']);

function unique(values) {
  return [...new Set(values)];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function loadTaxonomy(taxonomyPath = TAXONOMY_PATH) {
  return readJsonFile(taxonomyPath, null);
}

function listTableRows(source, requiredHeader) {
  if (!source || !Array.isArray(source.blocks)) return [];
  const block = source.blocks.find((candidate) => (
    candidate.type === 'table'
    && Array.isArray(candidate.header)
    && candidate.header.includes(requiredHeader)
  ));
  if (!block || !Array.isArray(block.rows)) return [];
  return block.rows.map((row) => Object.fromEntries(
    block.header.map((header, index) => [header, row[index] || ''])
  ));
}

function activeQueueIds(queuePath = QUEUE_PATH) {
  const source = readJsonFile(queuePath, null);
  return listTableRows(source, 'id').map((row) => row.id).filter(Boolean);
}

function cutoverPostNos(registryPath, cutoverPostNo) {
  return dedupEntries(registryPath)
    .map((entry) => entry.postNo)
    .filter((postNo) => Number.parseInt(postNo, 10) >= cutoverPostNo)
    .filter((postNo) => /^\d{3}$/.test(postNo));
}

function createIdMap(items, idField, label, errors) {
  const map = new Map();
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return map;
  }

  items.forEach((item, index) => {
    const id = item && item[idField];
    if (!isNonEmptyString(id)) {
      errors.push(`${label}[${index}] needs ${idField}`);
      return;
    }
    if (!isNonEmptyString(item.label)) {
      errors.push(`${label}[${index}] needs label`);
    }
    if (map.has(id)) {
      errors.push(`duplicate ${idField}: ${id}`);
      return;
    }
    map.set(id, item);
  });
  return map;
}

function arraysMatch(left, right) {
  const a = unique(left || []).sort();
  const b = unique(right || []).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function validateIdArray(assignmentId, assignment, field, validIds, errors, required) {
  const values = assignment[field];
  if (!Array.isArray(values)) {
    errors.push(`${assignmentId} ${field} must be an array`);
    return [];
  }
  if (required && values.length === 0) {
    errors.push(`${assignmentId} classified record needs ${field}`);
  }
  if (unique(values).length !== values.length) {
    errors.push(`${assignmentId} ${field} contains duplicates`);
  }
  values.forEach((value) => {
    if (!validIds.has(value)) {
      const idKind = field.replace(/_ids$/, '_id');
      errors.push(`${assignmentId} unknown ${idKind} ${value}`);
    }
  });
  return values;
}

function validateTaxonomy(options = {}) {
  const taxonomyPath = options.taxonomyPath || TAXONOMY_PATH;
  const queuePath = options.queuePath || QUEUE_PATH;
  const registryPath = options.registryPath || REGISTRY_PATH;
  const errors = [];
  const taxonomy = loadTaxonomy(taxonomyPath);

  if (!taxonomy || typeof taxonomy !== 'object') {
    return [`SEO taxonomy not found or invalid JSON: ${taxonomyPath}`];
  }
  if (taxonomy.schema_version !== 1) errors.push('SEO taxonomy schema_version must be 1');
  if (taxonomy.id !== 'seo_taxonomy') errors.push('SEO taxonomy id must be seo_taxonomy');
  if (!taxonomy.migration || !Number.isInteger(taxonomy.migration.cutover_post_no)) {
    errors.push('SEO taxonomy migration.cutover_post_no must be an integer');
  }

  const hubMap = createIdMap(taxonomy.hubs, 'hub_id', 'hubs', errors);
  const clusterMap = createIdMap(taxonomy.clusters, 'cluster_id', 'clusters', errors);
  const intentMap = createIdMap(taxonomy.intents, 'intent_id', 'intents', errors);
  const hubIds = new Set(hubMap.keys());
  const clusterIds = new Set(clusterMap.keys());
  const intentIds = new Set(intentMap.keys());

  if (!Array.isArray(taxonomy.rotation_hub_ids) || taxonomy.rotation_hub_ids.length === 0) {
    errors.push('rotation_hub_ids must be a non-empty array');
  } else {
    if (unique(taxonomy.rotation_hub_ids).length !== taxonomy.rotation_hub_ids.length) {
      errors.push('rotation_hub_ids contains duplicates');
    }
    taxonomy.rotation_hub_ids.forEach((hubId) => {
      if (!hubIds.has(hubId)) errors.push(`rotation_hub_ids references unknown hub_id ${hubId}`);
    });
  }

  clusterMap.forEach((cluster, clusterId) => {
    if (!Array.isArray(cluster.hub_ids) || cluster.hub_ids.length === 0) {
      errors.push(`${clusterId} needs non-empty hub_ids`);
      return;
    }
    cluster.hub_ids.forEach((hubId) => {
      if (!hubIds.has(hubId)) errors.push(`${clusterId} references unknown hub_id ${hubId}`);
    });
  });

  const assignments = taxonomy.assignments;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    errors.push('assignments must be an object');
    return errors;
  }

  const assignmentIds = new Set(Object.keys(assignments));
  const activeQueues = activeQueueIds(queuePath);
  const cutoverPostNo = taxonomy.migration && taxonomy.migration.cutover_post_no;
  const currentPosts = Number.isInteger(cutoverPostNo)
    ? cutoverPostNos(registryPath, cutoverPostNo)
    : [];

  activeQueues.forEach((queueId) => {
    const assignmentId = `queue:${queueId}`;
    if (!assignmentIds.has(assignmentId)) errors.push(`missing active queue assignment: ${queueId}`);
  });
  currentPosts.forEach((postNo) => {
    const assignmentId = `post:${postNo}`;
    if (!assignmentIds.has(assignmentId)) errors.push(`missing cutover post assignment: ${postNo}`);
  });

  Object.entries(assignments).forEach(([assignmentId, assignment]) => {
    if (!assignment || typeof assignment !== 'object' || Array.isArray(assignment)) {
      errors.push(`${assignmentId} must be an object`);
      return;
    }

    const queueMatch = assignmentId.match(/^queue:(Q-\d{3})$/);
    const postMatch = assignmentId.match(/^post:(\d{3})$/);
    if (!queueMatch && !postMatch) {
      errors.push(`${assignmentId} has an unsupported assignment id`);
      return;
    }
    const expectedEntityType = queueMatch ? 'queue' : 'post';
    if (assignment.entity_type !== expectedEntityType) {
      errors.push(`${assignmentId} entity_type must be ${expectedEntityType}`);
    }
    // Queue assignments also preserve lineage for boards that have rotated out.
    // Only the forward direction is strict: every active Q-ID must have taxonomy.
    if (postMatch && !currentPosts.includes(postMatch[1])) {
      errors.push(`${assignmentId} references a post outside the cutover set`);
    }

    const status = assignment.classification_status;
    if (!CLASSIFICATION_STATUSES.has(status)) {
      errors.push(`${assignmentId} has invalid classification_status ${status || '(empty)'}`);
    }
    const classified = status === 'classified';
    const hubs = validateIdArray(assignmentId, assignment, 'hub_ids', hubIds, errors, classified);
    const clusters = validateIdArray(assignmentId, assignment, 'cluster_ids', clusterIds, errors, classified);
    const intents = validateIdArray(assignmentId, assignment, 'intent_ids', intentIds, errors, classified);

    if (status === 'unclassified') {
      if (hubs.length || clusters.length || intents.length) {
        errors.push(`${assignmentId} unclassified record must have empty hub_ids, cluster_ids, intent_ids`);
      }
      if (!isNonEmptyString(assignment.unclassified_reason)) {
        errors.push(`${assignmentId} unclassified record needs unclassified_reason`);
      }
    }

    if (classified) {
      clusters.forEach((clusterId) => {
        const cluster = clusterMap.get(clusterId);
        if (cluster && !cluster.hub_ids.every((hubId) => hubs.includes(hubId))) {
          errors.push(`${assignmentId} cluster ${clusterId} is incompatible with hub_ids`);
        }
      });
    }

    if (!Array.isArray(assignment.source_refs)) {
      errors.push(`${assignmentId} source_refs must be an array`);
      return;
    }
    if (unique(assignment.source_refs).length !== assignment.source_refs.length) {
      errors.push(`${assignmentId} source_refs contains duplicates`);
    }
    assignment.source_refs.forEach((sourceRef) => {
      if (!assignmentIds.has(sourceRef)) {
        errors.push(`${assignmentId} source_ref not found: ${sourceRef}`);
      }
    });

    if (postMatch) {
      const queueRefs = assignment.source_refs.filter((sourceRef) => /^queue:Q-\d{3}$/.test(sourceRef));
      if (queueRefs.length === 0) {
        errors.push(`${assignmentId} needs a queue source_ref`);
      } else {
        queueRefs.forEach((sourceRef) => {
          const source = assignments[sourceRef];
          if (!source) return;
          const idsMatch = arraysMatch(hubs, source.hub_ids)
            && arraysMatch(clusters, source.cluster_ids)
            && arraysMatch(intents, source.intent_ids);
          if (!idsMatch && !isNonEmptyString(assignment.taxonomy_change_note)) {
            errors.push(`${assignmentId} differs from ${sourceRef} and needs taxonomy_change_note`);
          }
        });
      }
    }
  });

  return errors;
}

function getCoreHubLabels(taxonomyPath = TAXONOMY_PATH) {
  const taxonomy = loadTaxonomy(taxonomyPath);
  if (!taxonomy || !Array.isArray(taxonomy.hubs) || !Array.isArray(taxonomy.rotation_hub_ids)) return [];
  const labelById = new Map(taxonomy.hubs.map((hub) => [hub.hub_id, hub.label]));
  return taxonomy.rotation_hub_ids.map((hubId) => labelById.get(hubId)).filter(Boolean);
}

const CORE_HUB_LABELS = getCoreHubLabels();

function main() {
  const errors = validateTaxonomy();
  if (errors.length > 0) {
    console.error('FAIL: SEO taxonomy contract');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('ALLOW: SEO taxonomy contract');
}

if (require.main === module) main();

module.exports = {
  CORE_HUB_LABELS,
  TAXONOMY_PATH,
  activeQueueIds,
  cutoverPostNos,
  getCoreHubLabels,
  loadTaxonomy,
  validateTaxonomy,
};
